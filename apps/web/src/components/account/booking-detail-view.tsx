import { type BookingDetail, type BookingPhase, bookingPhase } from '@tourism/contract';
import { AwaitingPaymentPanel } from '@/components/account/awaiting-payment-panel';
import { BookingDetailsPanel } from '@/components/account/booking-details-panel';
import { BookingTicket } from '@/components/account/booking-ticket';
import { GetReadyPanel } from '@/components/account/get-ready-panel';
import { OnTourPanel } from '@/components/account/on-tour-panel';
import { ReviewPanel, TripThanksPanel } from '@/components/account/review-panel';
import { TripClosedPanel } from '@/components/account/trip-closed-panel';
import { TripJourney } from '@/components/account/trip-journey';
import { journeyMilestones } from '@/lib/booking-journey';
import { type BookingView, bookingView } from '@/lib/booking-vm';
import {
  type BookingTourData,
  getReadySteps,
  needsTourData,
  tourMeetingPoint,
} from '@/lib/get-ready';
import { hasReviewArea, type ReviewSlot, reviewSlot } from '@/lib/review';

/**
 * Thân trang chi tiết đơn, dưới hero (spec P7 §5.1, bản vẽ `.x-page`): vé → thanh hành trình →
 * hai cột `minmax(0,1.08fr) minmax(0,1fr)` — trái là thông tin đơn, phải đổi theo giai đoạn.
 *
 * Lề ngang trùng `ContentHero` (`px-4 md:px-16 lg:px-24 xl:px-32` quanh `max-w-7xl`) để mép
 * vé thẳng hàng với tiêu đề hero. Điện thoại một cột: khối giai đoạn lên TRƯỚC thông tin đơn
 * bằng `order-first`; DOM giữ trái trước phải sau nên trình đọc màn hình đọc theo thứ tự cột
 * (đánh đổi đã ghi ở spec §12).
 *
 * Giai đoạn đọc qua `bookingPhase` với `today` do server tính — một mốc cho cả vé, hành trình,
 * đếm ngược và ngày trong chuyến. Nút huỷ chỉ theo cờ SERVER (`cancellation`, ADR-0041 §7).
 *
 * Cột phải: khối của giai đoạn, rồi khu review khi cổng review của API có gì để nói
 * (`hasReviewArea`) — theo cổng chứ không theo giai đoạn (ADR-0054 AMEND 1 §5), nên khu review
 * có thể đứng dưới "Today's plan" (ngày về, từ 07:00 giờ VN) hay dưới khối đóng (đơn đã có review
 * rồi bị hoàn, huỷ). `slot` tính MỘT lần ở đây cho cả hai chỗ đọc.
 */
export function BookingDetailView({
  booking,
  tour,
  today,
}: {
  booking: BookingDetail;
  tour: BookingTourData | null;
  today: string;
}) {
  const phase = bookingPhase(booking, today);
  const view = bookingView(booking, booking.cancellation);
  const slot = reviewSlot(booking);

  return (
    <div className="w-full px-4 pt-7 pb-16 md:px-16 md:pb-20 lg:px-24 xl:px-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <BookingTicket booking={booking} phase={phase} />
        <TripJourney journey={journeyMilestones(booking, today)} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
          <BookingDetailsPanel
            booking={booking}
            view={view}
            phase={phase}
            // Điểm hẹn chỉ ở hai giai đoạn đọc dữ liệu tour (`needsTourData`) — cùng luật trang dùng
            // để quyết có gọi API catalog không.
            meetingPoint={needsTourData(phase) ? tourMeetingPoint(tour) : null}
          />
          <div data-slot="phase-panel" className="order-first flex flex-col gap-5 lg:order-none">
            <PhasePanel
              phase={phase}
              booking={booking}
              view={view}
              tour={tour}
              today={today}
              slot={slot}
            />
            {hasReviewArea(slot) ? <ReviewPanel booking={booking} slot={slot} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bảng giai đoạn → khối cột phải (spec §2.5). Khu review không ở đây — xem `BookingDetailView`. */
function PhasePanel({
  phase,
  booking,
  view,
  tour,
  today,
  slot,
}: {
  phase: BookingPhase;
  booking: BookingDetail;
  view: BookingView;
  tour: BookingTourData | null;
  today: string;
  slot: ReviewSlot;
}) {
  switch (phase) {
    case 'awaiting_payment':
      return <AwaitingPaymentPanel booking={booking} view={view} />;
    case 'upcoming':
      return (
        <GetReadyPanel view={getReadySteps(booking, tour, today)} bookingCode={booking.code} />
      );
    case 'on_tour':
      return <OnTourPanel booking={booking} tour={tour} today={today} />;
    case 'travelled':
      // Chuyến đã đi thì khu review (nếu có) LÀ cột phải. Không có (`hidden` — vd hoàn một phần)
      // thì lời cảm ơn thay cột trống. `tooEarly` không tới được đây: ngày về trước hôm nay giờ VN
      // thì ngày UTC cũng đã tới ngày về (review P7 B7).
      return slot === 'hidden' ? <TripThanksPanel /> : null;
    case 'cancelled':
      return <TripClosedPanel booking={booking} view={view} kind="cancelled" />;
    case 'lapsed':
      return <TripClosedPanel booking={booking} view={view} kind="lapsed" />;
  }
}
