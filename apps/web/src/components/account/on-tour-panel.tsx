import { type BookingDetail, tripDayNumbers } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { LifeBuoyIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { DayText } from '@/components/account/day-text';
import { PanelCard, PanelKicker } from '@/components/account/panel-card';
import { type BookingTourData, tourMeetingPoint } from '@/lib/get-ready';

/**
 * Cột phải của đơn đang đi (spec P7 §2.3, §2.5): "Day d of D", lịch trình ĐÚNG ngày đó in
 * nguyên văn (không tách giờ — luật catalog), điểm hẹn, lối "Need help today? Contact us".
 * `today` là ngày lịch Việt Nam do server tính — một mốc với chip của thanh hành trình.
 */
export function OnTourPanel({
  booking,
  tour,
  today,
}: {
  booking: BookingDetail;
  tour: BookingTourData | null;
  today: string;
}) {
  const t = messages.bookingDetail;
  const { dayOfTrip, tripLength } = tripDayNumbers(booking, today);
  const day = tour?.itinerary.find((entry) => entry.dayNumber === dayOfTrip) ?? null;
  const meetingPoint = tourMeetingPoint(tour);

  return (
    <PanelCard aria-labelledby="on-tour-heading">
      <PanelKicker id="on-tour-heading">{t.onTour.heading}</PanelKicker>
      <p className="mt-1.5 font-heading text-[34px] leading-tight font-semibold">
        {t.journey.dayOf(dayOfTrip, tripLength)}
      </p>
      {day ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            {messages.tourDetail.itinerary.dayLabel(day.dayNumber)} · {day.title}
          </p>
          {day.description ? <DayText text={day.description} className="mt-2" /> : null}
        </div>
      ) : null}
      {meetingPoint ? (
        <div className="mt-4 flex items-start gap-2 text-[13px]">
          <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-emphasis" />
          {/* Điểm hẹn là chữ admin in nguyên văn — một link dán liền bẻ ở bất kỳ đâu, không đẩy
              trang cuộn ngang (review P7 S2). */}
          <div className="min-w-0">
            <p className="font-semibold">{t.details.meetingPoint}</p>
            <p className="text-muted-foreground [overflow-wrap:anywhere]">{meetingPoint}</p>
          </div>
        </div>
      ) : null}
      <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-muted pt-3 text-[13px] text-muted-foreground">
        <LifeBuoyIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{t.onTour.needHelp}</span>
        <Link
          href="/contact"
          className="font-semibold text-primary-emphasis underline-offset-4 hover:underline"
        >
          {messages.passportVisa.contactUs}
        </Link>
      </p>
    </PanelCard>
  );
}
