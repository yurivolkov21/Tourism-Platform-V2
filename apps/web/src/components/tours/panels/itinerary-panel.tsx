'use client';

import { messages } from '@tourism/i18n';
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@tourism/ui/components/reui/timeline';
import { CheckIcon, ChevronRightIcon, MapPinIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import type { TourDetailVM } from '@/lib/api/tours';
import { itineraryDayDate, itineraryDayState, parseItineraryStops } from '@/lib/tour-detail';

/**
 * Tab 2 — lịch trình theo ngày, dựng trên Timeline của ReUI (cùng primitive với
 * nhật ký hành trình ở trang passport, nên hình học node/đường nối giống hệt).
 *
 * HAI CHẾ ĐỘ, và mặc định là chế độ xem trước:
 *
 * - **Xem trước** (mọi khách): node hiện SỐ NGÀY, badge hiện ngày thật suy từ
 *   đợt đang chọn. Không tick, không spinner, không làm mờ.
 * - **Live** (`live=true`): chỉ bật khi session có booking `PAID` ở ĐÚNG đợt
 *   này. Ngày đã qua tick "Done", hôm nay quay "Today" và tự xổ nội dung, ngày
 *   chưa tới thì mờ.
 *
 * Vì sao không áp luật live cho mọi người: trang tour là trang CÔNG KHAI và đợt
 * khách chọn thường ở tương lai — áp nguyên xi thì cả 4 ngày đều "chưa diễn ra",
 * toàn bộ timeline mờ đi và đọc ra như trang hỏng. Xem ADR-0022.
 *
 * `today` truyền vào chứ không đọc `new Date()` trong component: để test bơm
 * được ngày cố định, và để server/client không lệch nhau khi hydrate.
 */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `Mon 14 Sep` — đọc theo UTC, cùng quy ước với `itineraryDayState`. */
function formatDayBadge(date: Date): string {
  return `${DOW[date.getUTCDay()]} ${date.getUTCDate()} ${MON[date.getUTCMonth()]}`;
}

export function ItineraryPanel({
  tour,
  live,
  today,
}: {
  tour: TourDetailVM;
  live: boolean;
  today: Date;
}) {
  const t = messages.tourDetail;
  const { departures, selectedId } = useDepartureSelection();
  const departure = departures.find((d) => d.id === selectedId);

  // Lưu ĐÈ của người dùng chứ không lưu "danh sách đang mở": mục tự xổ mà không
  // có chỗ ghi "đã bị đóng tay" thì bấm vào nó không đóng được — nó rơi lại về
  // mặc định ngay ở lần render kế.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const days = tour.itinerary.map((day) => {
    const date = departure ? itineraryDayDate(departure.startDate, day.dayNumber) : null;
    return { day, date, state: date ? itineraryDayState(date, today, live) : 'preview' } as const;
  });

  // Timeline của ReUI chỉ nhận MỘT con số: mọi mục có `step <= activeStep` được
  // đánh dấu hoàn tất (node tô đậm, đoạn nối phía trên chuyển màu primary). Ở
  // chế độ xem trước để 0 — không mục nào "hoàn tất", cả dải giữ nguyên màu.
  const activeStep = live
    ? days.reduce(
        (acc, d) => (d.state === 'done' || d.state === 'active' ? d.day.dayNumber : acc),
        0,
      )
    : 0;

  function isOpen(dayNumber: number, state: string) {
    const override = overrides[dayNumber];
    if (override !== undefined) return override;
    // Ngày đang diễn ra tự xổ; ở chế độ xem trước thì ngày đầu tự xổ.
    return state === 'active' || (!live && dayNumber === days[0]?.day.dayNumber);
  }

  return (
    <div className="max-w-3xl">
      {tour.meetingPoint ? (
        <div className="mb-7 flex items-start gap-2.5 rounded-xl border border-dashed border-border px-3.5 py-3">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary-emphasis" aria-hidden="true" />
          <p className="text-sm leading-[20px] font-medium">{tour.meetingPoint}</p>
        </div>
      ) : null}

      <Timeline value={activeStep}>
        {days.map(({ day, date, state }) => {
          const stops = parseItineraryStops(day.description);
          const open = isOpen(day.dayNumber, state);
          const first = stops[0];
          const last = stops[stops.length - 1];

          return (
            <TimelineItem
              key={day.dayNumber}
              step={day.dayNumber}
              className="pb-7 last:pb-0 group-data-[orientation=vertical]/timeline:ms-10"
            >
              <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
              <TimelineIndicator
                className={`flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-7 ${
                  state === 'preview'
                    ? 'bg-muted font-mono text-[11px] leading-none text-primary-emphasis tabular-nums'
                    : 'bg-muted text-muted-foreground group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground'
                }`}
              >
                {state === 'done' ? (
                  <CheckIcon className="size-3.5" />
                ) : state === 'active' ? (
                  <span className="size-2.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
                ) : state === 'upcoming' ? null : (
                  String(day.dayNumber).padStart(2, '0')
                )}
              </TimelineIndicator>

              <TimelineHeader className="flex min-h-6 flex-wrap items-center gap-2">
                <TimelineTitle
                  className={`font-heading text-base leading-[22px] font-medium ${
                    state === 'upcoming' ? 'opacity-55' : ''
                  }`}
                >
                  {day.title}
                </TimelineTitle>
                {date ? (
                  <span className="inline-flex h-[22px] items-center rounded-full border border-input px-2.5 font-mono text-[11px] leading-none">
                    {formatDayBadge(date)}
                  </span>
                ) : null}
                {state === 'done' ? (
                  <span className="inline-flex h-[22px] items-center rounded-full border border-success/55 bg-success/15 px-2.5 text-[11px] leading-none font-medium text-success">
                    {t.itinerary.done}
                  </span>
                ) : null}
                {state === 'active' ? (
                  <span className="inline-flex h-[22px] items-center rounded-full bg-primary px-2.5 text-[11px] leading-none font-medium text-primary-foreground">
                    {t.itinerary.today}
                  </span>
                ) : null}
              </TimelineHeader>

              <TimelineContent
                className={`mt-2.5 rounded-xl border border-border bg-muted p-1 ${
                  state === 'upcoming' ? 'opacity-55' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOverrides((prev) => ({ ...prev, [day.dayNumber]: !open }))}
                  aria-expanded={open}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPinIcon
                      className="size-3 shrink-0 text-primary-emphasis"
                      aria-hidden="true"
                    />
                    <span className="truncate text-xs leading-[20px] font-medium text-muted-foreground">
                      {first?.time && last?.time
                        ? t.itinerary.stopsSummary(
                            day.dayNumber,
                            stops.length,
                            first.time,
                            last.time,
                          )
                        : t.itinerary.dayLabel(day.dayNumber)}
                    </span>
                  </span>
                  <ChevronRightIcon
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      open ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {open ? (
                  <div className="px-3 pt-2.5 pb-1.5">
                    {stops.map((stop) => (
                      <div
                        key={`${stop.time ?? ''}-${stop.text}`}
                        className="grid grid-cols-[60px_1fr] items-baseline gap-3.5 border-t border-border/45 py-1.5 first:border-t-0"
                      >
                        <time className="font-mono text-xs leading-[20px] font-medium tabular-nums text-foreground">
                          {stop.time}
                        </time>
                        {/* Mô tả là MARKDOWN: **đậm** cho địa danh và bữa ăn,
                            *nghiêng* cho ghi chú mềm. Markdown thoái hoá êm nên
                            nội dung cũ không có ký hiệu nào vẫn render y như chữ
                            thường — không cần migration dữ liệu. */}
                        <div className="text-sm leading-[22px] text-foreground [&_em]:text-muted-foreground [&_strong]:font-semibold">
                          <Markdown remarkPlugins={[remarkGfm]}>{stop.text}</Markdown>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>

      {tour.included.length > 0 || tour.excluded.length > 0 ? (
        <div className="mt-6 grid gap-7 border-t border-border pt-6 sm:grid-cols-2">
          {tour.included.length > 0 ? (
            <div>
              <p className="mb-3 font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
                {t.itinerary.included}
              </p>
              <ul className="flex flex-col gap-2">
                {tour.included.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-[20px]">
                    <CheckIcon
                      className="mt-0.5 size-3.5 shrink-0 text-primary-emphasis"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {tour.excluded.length > 0 ? (
            <div>
              <p className="mb-3 font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
                {t.itinerary.excluded}
              </p>
              <ul className="flex flex-col gap-2 text-muted-foreground">
                {tour.excluded.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-[20px]">
                    <XIcon className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
