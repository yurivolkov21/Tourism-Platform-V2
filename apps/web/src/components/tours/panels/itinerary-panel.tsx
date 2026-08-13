'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon, ChevronRightIcon, MapPinIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import type { TourDetailVM } from '@/lib/api/tours';
import { itineraryDayDate, itineraryDayState, parseItineraryStops } from '@/lib/tour-detail';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `Mon 14 Sep` — khuôn `fmt()` của wireframe. Đọc theo UTC, cùng quy ước với
    `itineraryDayState` để ngày và trạng thái không bao giờ lệch nhau. */
function formatDayBadge(date: Date): string {
  return `${DOW[date.getUTCDay()]} ${date.getUTCDate()} ${MON[date.getUTCMonth()]}`;
}

/**
 * Tab 2 — lịch trình theo ngày. Dựng bám `.tl-item` / `.tl-node` / `.tl-frame`
 * của wireframe; số đo trích bằng máy.
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
export function ItineraryPanel({
  tour,
  live,
  today,
}: {
  tour: TourDetailVM;
  live: boolean;
  today: Date;
}) {
  const t = messages.tourDetail.itinerary;
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

  const nights = tour.durationDays - 1;
  const firstDate = days[0]?.date;
  const ended = live && days.every((d) => d.state === 'done');
  const inProgress = live && days.some((d) => d.state === 'active');

  function isOpen(dayNumber: number, state: string) {
    const override = overrides[dayNumber];
    if (override !== undefined) return override;
    // Ngày đang diễn ra tự xổ; ở chế độ xem trước thì ngày đầu tự xổ.
    return state === 'active' || (!live && dayNumber === days[0]?.day.dayNumber);
  }

  return (
    <div>
      {/* `.note` — viền ĐỨT, radius md, pad 12/14, gap 10, canh đỉnh. */}
      {tour.meetingPoint ? (
        <div
          data-slot="note"
          className="mb-6 flex items-start gap-2.5 rounded-md border border-dashed border-border px-3.5 py-3"
        >
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary-emphasis" aria-hidden="true" />
          <div>
            <div className="font-medium">{tour.meetingPoint}</div>
            {firstDate ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {t.meta(formatDayBadge(firstDate), tour.durationDays, nights)}
                {inProgress ? ` · ${t.metaLive}` : ended ? ` · ${t.metaEnded}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* `.tl` — mỗi mục thụt trái 44 để chừa chỗ cho node 24 + đường nối. */}
      <div className="relative">
        {days.map(({ day, date, state }, index) => {
          const stops = parseItineraryStops(day.description);
          const open = isOpen(day.dayNumber, state);
          const isLast = index === days.length - 1;
          const dim = state === 'upcoming';
          const first = stops[0];
          const last = stops[stops.length - 1];

          return (
            <div
              key={day.dayNumber}
              data-slot="tl-item"
              className={cn('relative pl-11', isLast ? 'pb-0' : 'pb-7')}
            >
              {/* `.tl-line` — left 11.5 để trùng tâm node 24px; bỏ ở mục cuối,
                  nếu không nó thò xuống thành một vạch cụt. */}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-7 bottom-1 left-[11.5px] w-px',
                    state === 'done' ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}

              {/* `.tl-node` — 24×24 tròn, mono 11. */}
              <span
                className={cn(
                  'absolute top-0 left-0 flex size-6 items-center justify-center rounded-full font-mono text-[11px] leading-none font-medium',
                  state === 'done' && 'bg-primary text-primary-foreground',
                  state === 'active' &&
                    'bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_20%,transparent)]',
                  state === 'upcoming' && 'border-[1.5px] border-border text-muted-foreground',
                  state === 'preview' && 'bg-muted text-muted-foreground',
                )}
              >
                {state === 'done' ? (
                  <CheckIcon className="size-3" strokeWidth={3.5} />
                ) : state === 'active' ? (
                  <span
                    aria-hidden="true"
                    className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                  />
                ) : state === 'upcoming' ? null : (
                  String(day.dayNumber).padStart(2, '0')
                )}
              </span>

              {/* `.tl-head` — tiêu đề + badge ngày + badge trạng thái. */}
              <div className="flex min-h-6 flex-wrap items-center gap-2">
                <h3
                  className={cn(
                    'font-heading text-base leading-[22px] font-medium',
                    dim && 'opacity-55',
                  )}
                >
                  {day.title}
                </h3>
                {date ? (
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-input px-[9px] font-mono text-[11px] leading-none font-medium">
                    {formatDayBadge(date)}
                  </span>
                ) : null}
                {state === 'done' ? (
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--success)_55%,transparent)] bg-[color-mix(in_oklab,var(--success)_18%,transparent)] px-[9px] text-[11px] leading-none font-medium text-success">
                    <CheckIcon className="size-3" strokeWidth={3.5} />
                    {t.done}
                  </span>
                ) : null}
                {state === 'active' ? (
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-primary bg-primary px-[9px] text-[11px] leading-none font-medium text-primary-foreground">
                    <span aria-hidden="true" className="size-2 rounded-full bg-current" />
                    {t.today}
                  </span>
                ) : null}
              </div>

              {/* `.tl-frame` — viền, radius md, nền muted, pad 4. */}
              <div
                className={cn(
                  'mt-2.5 rounded-md border border-border bg-muted p-1',
                  dim && 'opacity-55',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOverrides((prev) => ({ ...prev, [day.dayNumber]: !open }))}
                  aria-expanded={open}
                  // `.tl-trigger` — radius `md − 4` để lồng vào frame pad 4.
                  // Tính từ `var(--radius)` chứ KHÔNG `var(--radius-md)`: bậc
                  // `--radius-md` đã chốt giá trị ở `:root` theo base 0.375rem
                  // của site nên không ăn theo `[--radius:1rem]` của trang —
                  // viết `calc(var(--radius-md)-4px)` cho ra 0.8px thay vì 8.8.
                  // (Utility `rounded-md` thì lại ăn đúng, nên `.tl-frame` ở
                  // trên vẫn ra 12.8 — khác nhau đúng ở chỗ đó.)
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--radius)*0.8-4px)] border border-border bg-card px-2.5 py-2 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-primary-emphasis">
                      <MapPinIcon className="size-3" aria-hidden="true" />
                    </span>
                    <span className="line-clamp-2 text-muted-foreground">
                      {first?.time && last?.time
                        ? t.stopsSummary(day.dayNumber, stops.length, first.time, last.time)
                        : t.dayLabel(day.dayNumber)}
                    </span>
                  </span>
                  <ChevronRightIcon
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      open && 'rotate-90',
                    )}
                    aria-hidden="true"
                  />
                </button>

                {open ? (
                  <div className="px-3 pt-2.5 pb-1.5">
                    {stops.map((stop) => (
                      <div
                        key={`${stop.time ?? ''}-${stop.text}`}
                        // `.stop` — lưới 60px | 1fr, gap 14, canh baseline.
                        className="grid grid-cols-[60px_1fr] items-baseline gap-3.5 border-t border-[color-mix(in_oklab,var(--border)_45%,transparent)] py-[7px] first:border-t-0"
                      >
                        <time className="font-mono text-xs font-medium text-foreground tabular-nums">
                          {stop.time}
                        </time>
                        {/* Mô tả là MARKDOWN: **đậm** cho địa danh và bữa ăn,
                            *nghiêng* cho ghi chú mềm. Markdown thoái hoá êm nên
                            nội dung cũ không có ký hiệu nào vẫn render y như chữ
                            thường — không cần migration dữ liệu. */}
                        <div className="text-foreground [&_em]:text-muted-foreground [&_strong]:font-semibold">
                          <Markdown remarkPlugins={[remarkGfm]}>{stop.text}</Markdown>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {tour.included.length > 0 || tour.excluded.length > 0 ? (
        <>
          <div aria-hidden="true" className="mt-2 mb-6 h-px bg-border" />
          <div className="grid gap-7 sm:grid-cols-2">
            {tour.included.length > 0 ? (
              <div>
                <div className="mb-3 font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
                  {t.included}
                </div>
                <ul className="flex flex-col gap-2 text-[13px] text-muted-foreground">
                  {tour.included.map((item) => (
                    <li key={item} className="flex gap-2">
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
                <div className="mb-3 font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
                  {t.excluded}
                </div>
                <ul className="flex flex-col gap-2 text-[13px] text-muted-foreground">
                  {tour.excluded.map((item) => (
                    <li key={item} className="flex gap-2">
                      <XIcon className="mt-0.5 size-3.5 shrink-0 opacity-50" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
