'use client';

import { type Booking, bookingPhase, tripDayNumbers } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { Badge } from '@tourism/ui/components/badge';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { IconTile } from '@tourism/ui/components/reui/icon-tile';
import { PlaneIcon } from 'lucide-react';
import Link from 'next/link';
import { RevealItem } from '@/components/motion/reveal-item';
import { bookingPass, bookingTotalLabel, bookingView } from '@/lib/booking-vm';
import { formatBookingMoney } from '@/lib/checkout';
import { STAGGER } from '@/lib/motion';
import { formatDateRange } from '@/lib/tours';

/**
 * Danh sách booking dạng ACCORDION xổ-inline (vòng 12/08 — user tham khảo
 * pattern "coupon manager" của ReUI, dựng lại bằng đồ nhà, KHÔNG cài block
 * trả phí): mỗi booking một row bo tròn — icon tile + tên tour + badge
 * trạng thái chấm màu + dòng mã mono/đếm ngược/ngày + tổng tiền; bấm xổ ra
 * thẻ chi tiết (lưới nhãn IATA + hàng action theo trạng thái). Row ĐẦU mở
 * sẵn — sort của trang đã đặt chuyến khẩn nhất lên đầu.
 *
 * Mọi phân nhánh đi qua `bookingView` (một nguồn, không if/else status thô)
 * — kế thừa nguyên luật của JourneyRow mà nó thay thế; flow phức tạp (hủy,
 * review) vẫn ở trang chi tiết, ở đây chỉ có thông tin + lối vào.
 *
 * Dòng phụ ("In N days" / "Ends …"), nút Pay now và link Review đọc giai đoạn qua
 * `bookingPhase` của contract (ADR-0054 §1) — cùng luật API dùng để xếp danh sách; link View
 * voucher theo `bookingPass` của giai đoạn ấy, cùng luật với trang chi tiết đơn và voucher.
 *
 * `today` là ngày lịch VIỆT NAM do server truyền xuống (`todayDateString`,
 * chuỗi `YYYY-MM-DD`, so lexicographic) — client KHÔNG tự lấy giờ máy để tránh
 * lệch hydration qua nửa đêm, và để started/ended/đếm ngược đổi cùng lúc với
 * cổng huỷ online và giai đoạn chuyến của admin (ADR-0041 §7, ADR-0046).
 */

/** Chấm màu trong badge theo tone — tra bảng, thiếu thì rơi về muted. */
const DOT_CLASS: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  muted: 'bg-muted-foreground/60',
  destructive: 'bg-muted-foreground/60',
};

const BADGE_TONE: Record<string, string> = {
  success: 'border-success/40 text-success',
  warning: 'border-warning/50 text-warning',
  muted: 'text-muted-foreground',
  destructive: 'text-muted-foreground',
};

export function BookingAccordion({ bookings, today }: { bookings: Booking[]; today: string }) {
  const tb = messages.accountBookings;
  const bl = messages.booking.list;
  const tv = messages.passportVisa;
  const first = bookings[0]?.code;
  return (
    <Accordion multiple={false} defaultValue={first ? [first] : []} className="gap-3">
      {bookings.map((booking, bookingIndex) => {
        const view = bookingView(booking);
        // Giai đoạn qua MỘT luật dùng chung với API (ADR-0054 §1), trên CHÍNH ngày API đã dùng để
        // xếp (`today` của kết quả `bookings.mine`): dòng phụ và vị trí của hàng không nói hai
        // điều khác nhau, kể cả sát 00:00 giờ Việt Nam.
        const phase = bookingPhase(booking, today);
        const detailHref = `/account/bookings/${booking.code}`;
        const lead =
          phase === 'on_tour'
            ? tb.endsOn(formatDateRange(booking.departureEndDate, booking.departureEndDate))
            : phase === 'upcoming' || phase === 'awaiting_payment'
              ? tb.inDays(tripDayNumbers(booking, today).daysToGo)
              : null;
        // Quá hạn chót mà chưa trả là `lapsed`: chuyến đã hết nhận đặt (ADR-0041 §3) và cổng trả
        // tiền của API đóng cùng mốc, nên không mời trả tiền nữa và nhãn nói thẳng điều ấy.
        const lapsed = phase === 'lapsed';
        const canPay = phase === 'awaiting_payment' && view.actions.includes('payNow');
        const badgeTone = lapsed ? 'muted' : view.tone;
        // Hôm sau ngày về theo giờ VN thì ngày UTC ít nhất đã tới ngày về, nên
        // cổng review (UTC) của API chắc chắn đã mở — link không dẫn tới form
        // bị từ chối. Review chỉ dành cho đơn PAID (`reviewSlot`).
        const canReview = phase === 'travelled' && booking.status === 'PAID';
        // Cùng luật voucher với trang chi tiết đơn và chính trang voucher (ADR-0054 AMEND 1 §5):
        // theo giai đoạn, không chỉ PAID — đơn hoàn một phần hay hoàn thiện chí vẫn đi.
        const hasVoucher = bookingPass(booking, phase).voucher;

        return (
          // Từng mục trồi lên bậc thang (nhóm motion 3, 19/08); wrapper ngoài
          // AccordionItem — Base UI nối item qua context nên không đòi là con trực tiếp.
          <RevealItem
            key={booking.code}
            enter="rise"
            delay={Math.min(bookingIndex, 4) * STAGGER.grid}
          >
            <AccordionItem
              key={booking.id}
              value={booking.code}
              className="rounded-2xl border border-border bg-card px-4 not-last:border-b md:px-5"
            >
              {/* `min-w-0`: nút trigger là flex item `flex-1`; thiếu nó thì bề rộng tối thiểu
                  bằng cả dòng tên tour không ngắt, `truncate` không có tác dụng và tên dài đẩy
                  trang rộng ra ở khổ điện thoại (soi bằng CSS build thật, P7 Task A11). */}
              <AccordionTrigger className="min-w-0 items-center gap-3 py-3.5 hover:no-underline">
                <IconTile variant="frame" size="default" aria-hidden="true">
                  <PlaneIcon />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-heading text-[15px] font-semibold">
                      {booking.tourTitle}
                    </span>
                    <Badge
                      variant="outline"
                      className={`gap-1.5 ${BADGE_TONE[badgeTone] ?? BADGE_TONE.muted}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${DOT_CLASS[badgeTone] ?? DOT_CLASS.muted}`}
                      />
                      {lapsed ? tb.lapsedBadge : bl.status[booking.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                    <span className="font-mono text-xs">{booking.code}</span>
                    {' · '}
                    {lead ? `${lead} · ` : ''}
                    {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
                  </p>
                </div>
                <span className="mr-1 hidden flex-none font-mono text-[13px] font-semibold tabular-nums sm:block">
                  {formatBookingMoney(booking, booking.totalAmount)}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 [&_a]:no-underline">
                {/* Thẻ chi tiết trắng lồng trong row — đảo nền như mẫu coupon
                  (row nhạt, ruột đậm tương phản). */}
                <div className="rounded-xl border border-border/70 bg-background p-4 md:p-5">
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
                    <div>
                      <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {tv.labels.dates}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">
                        {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {tv.labels.travellers}
                      </dt>
                      <dd className="mt-0.5 text-[14px] font-semibold">
                        {tb.travellers(booking.numAdults, booking.numChildren)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {tv.labels.reference}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[14px] font-semibold">{booking.code}</dd>
                    </div>
                    <div>
                      <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {bookingTotalLabel(booking)}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">
                        {formatBookingMoney(booking, booking.totalAmount)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dashed border-border pt-4">
                    {canPay ? (
                      <ButtonLink size="sm" href={detailHref}>
                        {messages.accountBookingDetail.actions.payNow}
                      </ButtonLink>
                    ) : null}
                    <ButtonLink variant="outline" size="sm" href={detailHref}>
                      {bl.viewDetails}
                    </ButtonLink>
                    {hasVoucher ? (
                      <Link
                        href={`/checkout/success?code=${booking.code}`}
                        className="text-[13px] font-semibold text-primary-emphasis hover:underline"
                      >
                        {tv.viewVoucher}
                      </Link>
                    ) : null}
                    {canReview ? (
                      <Link
                        href={`${detailHref}#review`}
                        className="text-[13px] font-semibold text-primary-emphasis hover:underline"
                      >
                        {messages.passportHome.journeyReview}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </RevealItem>
        );
      })}
    </Accordion>
  );
}
