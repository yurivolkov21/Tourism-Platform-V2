'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import type { DepartureVM } from '@/lib/api/tours';
import { departureMonths, monthLabel } from '@/lib/tour-detail';
import { departureStatus, formatDialogDate, formatMoney } from '@/lib/tours';

/** Chấm trạng thái ghế — cùng ba mức với dải chip ở panel. */
const DOT_TONE: Record<ReturnType<typeof departureStatus>, string> = {
  available: 'bg-success',
  limited: 'bg-warning',
  'sold-out': 'bg-muted-foreground',
};

/**
 * Modal "All dates" — dựng bám markup `.dlg` / `.dlg-box` / `.drow` của wireframe
 * đã duyệt; số đo trích bằng máy, xem spec §2.5.
 *
 * KHÔNG nhận prop `open`: trạng thái mở/đóng sống Ở DUY NHẤT
 * `DepartureSelectionProvider` vì hai chỗ khác nhau cùng mở nó — ô "All N dates"
 * ở panel đặt chỗ và nút "See all dates" ở tab Departures — mà trang chỉ render
 * MỘT instance. Thêm state `open` cục bộ ở đây là tạo ra hai nguồn sự thật.
 *
 * Bộ lọc "only open" thì NGƯỢC LẠI là state cục bộ: không nơi nào khác cần đọc,
 * nó chỉ lọc hiển thị trên `departures` đang có trong context.
 */
export function DepartureDialog({
  tourTitle,
  currency,
  durationDays,
  maxGroupSize,
}: {
  tourTitle: string;
  currency: string;
  durationDays: number;
  maxGroupSize: number;
}) {
  const t = messages.tourDetail.dialogs;
  const { departures, selectedId, select, allDatesOpen, closeAllDates } = useDepartureSelection();
  const [onlyOpen, setOnlyOpen] = useState(false);
  const filterId = useId();

  const visible = onlyOpen ? departures.filter((d) => d.seatsLeft > 0) : departures;
  const months = departureMonths(visible);
  const picked = departures.find((d) => d.id === selectedId);

  function pick(departure: DepartureVM) {
    select(departure.id);
    // Chọn xong ĐÓNG NGAY: để modal mở tiếp thì người dùng phải tự đi tìm nút
    // đóng, và họ không biết cú bấm vừa rồi đã ăn hay chưa.
    closeAllDates();
  }

  return (
    <Dialog
      open={allDatesOpen}
      onOpenChange={(next) => {
        if (!next) closeAllDates();
      }}
    >
      {/* `.dlg-box`: 640 rộng, cao tối đa 760, radius lg (16 với base 1rem). */}
      <DialogContent
        showCloseButton={false}
        // `[--radius:1rem]` PHẢI đặt ở đây: dialog portal ra `body` nên nó nằm
        // NGOÀI container trang, không thừa hưởng base bo góc của wireframe và
        // rơi về 0.375rem của site. Viền 1px là của `.dlg-box`, thiếu nó thì
        // hàng bên trong rộng 640 thay vì 638.
        className="flex max-h-[min(760px,100%)] w-full flex-col gap-0 rounded-lg border border-border p-0 [--radius:1rem] sm:max-w-160"
      >
        {/* `.dlg-head` — pad 20/24/16, viền đáy. `relative` để nút ✕ neo góc. */}
        <div className="relative border-b border-border px-6 pt-5 pb-4">
          <DialogTitle className="font-heading text-xl leading-[26px] font-medium">
            {t.allDatesTitle}
          </DialogTitle>
          <p className="mt-1 text-[13px] leading-[20px] text-muted-foreground">
            {t.allDatesSubtitle(tourTitle, durationDays, maxGroupSize)}
          </p>
          <DialogClose
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t.close}
                className="absolute top-4 right-4 size-8 rounded-sm"
              >
                <XIcon />
              </Button>
            }
          />
          <label
            htmlFor={filterId}
            className="mt-3.5 flex h-4 cursor-pointer items-center gap-2 text-[13px] leading-4 text-muted-foreground"
          >
            <Checkbox
              id={filterId}
              checked={onlyOpen}
              onCheckedChange={(next) => setOnlyOpen(next === true)}
              className="size-4"
            />
            {t.onlyOpen}
          </label>
        </div>

        {/* `.dlg-scroll` — pad 8/24/16.
            data-lenis-prevent: Lenis chặn wheel trên cả tài liệu nên lăn chuột
            trong vùng cuộn lồng lại cuộn TRANG CHÍNH. */}
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-4">
          {months.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.noMatch}</p>
          ) : (
            months.map((group) => (
              <div key={group.month}>
                {/* Nhãn tháng DÍNH khi cuộn — danh sách dài thì người đọc luôn
                    biết mình đang ở tháng nào. */}
                <p className="sticky top-0 bg-background pt-4 pb-2 font-mono text-[11px] leading-[14px] tracking-[0.12em] text-muted-foreground uppercase">
                  {monthLabel(group.month)}
                </p>
                {/* Hàng đợt cao 62 (đệm 24 + viền 2 + ngày 20 + 2 + meta 14).
                    Wireframe đo ra 86 vì ở đó lớp `.dates` bị TRÙNG TÊN: nó vừa
                    là lưới 4 cột của ô ngày ở panel, vừa là dòng ngày trong
                    modal, nên `display:grid` rò sang và đội dòng ngày từ 20 lên
                    44. Bám theo 86 là chép lại đúng cái lỗi đó, nên ở đây dùng
                    chiều cao ĐÚNG Ý của bản thiết kế. */}
                {group.items.map((d) => {
                  const status = departureStatus(d.seatsLeft);
                  const soldOut = status === 'sold-out';
                  const selected = d.id === selectedId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => pick(d)}
                      className={cn(
                        'mb-2 grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-4 rounded-md border border-border bg-card p-3 text-left transition-colors',
                        selected &&
                          'border-primary bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))]',
                        soldOut && 'cursor-not-allowed opacity-55',
                      )}
                    >
                      <span>
                        <span className="block text-sm leading-[20px] font-medium tabular-nums">
                          {t.dateRange(formatDialogDate(d.startDate), formatDialogDate(d.endDate))}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs leading-[14px] text-muted-foreground">
                          <i
                            aria-hidden="true"
                            className={cn('size-[7px] rounded-full', DOT_TONE[status])}
                          />
                          {t.rowMeta(
                            soldOut ? t.soldOut : t.seatsOf(d.seatsLeft, maxGroupSize),
                            durationDays,
                          )}
                        </span>
                      </span>
                      <span className="text-right text-[15px] leading-[20px] font-semibold text-price tabular-nums">
                        {formatMoney(d.effectivePrice, currency)}
                        {d.compareAtPrice ? (
                          <s className="block text-xs leading-4 font-normal text-price-compare">
                            {formatMoney(d.compareAtPrice, currency)}
                          </s>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-1 text-xs leading-none font-medium whitespace-nowrap text-primary-emphasis">
                        {soldOut ? null : selected ? (
                          <>
                            <CheckIcon className="size-3" />
                            {t.selected}
                          </>
                        ) : (
                          t.select
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* `.dlg-foot` — pad 16/24, hai đầu. */}
        <div
          data-testid="dlg-foot"
          className="flex items-center justify-between gap-4 border-t border-border px-6 py-4"
        >
          <p className="text-sm text-muted-foreground">
            {picked ? (
              <>
                {t.currentPick}:{' '}
                <b className="font-medium text-foreground tabular-nums">
                  {t.dateRange(
                    formatDialogDate(picked.startDate),
                    formatDialogDate(picked.endDate),
                  )}
                </b>{' '}
                · {formatMoney(picked.effectivePrice, currency)}
              </>
            ) : null}
          </p>
          <DialogClose
            render={
              <Button variant="outline" className="h-9 rounded-sm px-5">
                {t.close}
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
