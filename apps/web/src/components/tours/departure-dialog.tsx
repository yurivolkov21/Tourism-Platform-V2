'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import { departureMonths } from '@/lib/tour-detail';
import { departureStatus, formatDate, formatDateRange, formatMoney } from '@/lib/tours';

/**
 * `"2026-09"` (khoá tháng của `departureMonths`) → `"September 2026"`.
 * `timeZone: 'UTC'` BẮT BUỘC: không có nó, `Intl` diễn giải mốc theo giờ máy
 * chạy và có thể lùi một tháng ở múi giờ ÂM — cùng bẫy mà `formatDateRange`
 * (`lib/tours.ts`) đã né bằng cách tách chuỗi thay vì `new Date(dateOnlyString)`.
 */
const MONTH_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return MONTH_LABEL_FMT.format(new Date(Date.UTC(year, m - 1, 1)));
}

/**
 * Thời lượng suy ra từ khoảng ngày CỦA CHÍNH ĐỢT, KHÔNG phải `tour.durationDays`.
 * `DepartureDialog` không nhận prop (chữ ký cuối là `<DepartureDialog />`, chỉ
 * đọc `useDepartureSelection()`) nên không có đường nào nhận `tour` như
 * `DeparturesTableConnected` — tính thẳng từ `startDate`/`endDate` ra cùng một
 * con số vì mọi đợt của một tour dài bằng nhau. Cả hai mốc quy về UTC nên hiệu
 * ngày không phụ thuộc múi giờ máy chạy test/production.
 */
function departureDurationDays(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number) as [number, number, number];
  const [ey, em, ed] = endDate.split('-').map(Number) as [number, number, number];
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Modal "All dates" (spec §5.1) — nơi khách xem HẾT mọi đợt khởi hành, nhóm
 * theo tháng, và chọn một đợt.
 *
 * KHÔNG nhận prop: trạng thái mở/đóng sống Ở DUY NHẤT `DepartureSelectionProvider`
 * (Task 4) vì cả `TourMediaPanel` lẫn tab Departures (Task 9) đều cần mở CÙNG
 * một modal mà trang chỉ render một instance — thêm state `open` cục bộ ở đây
 * sẽ tạo ra hai nguồn sự thật.
 *
 * Bộ lọc "only open" NGƯỢC LẠI là state cục bộ: nó không phải thứ nơi khác cần
 * đọc chung, chỉ lọc hiển thị phía client trên `departures` đang có trong context.
 */
export function DepartureDialog() {
  const t = messages.tourDetail;
  const { departures, selectedId, select, currency, allDatesOpen, closeAllDates } =
    useDepartureSelection();
  const [onlyOpen, setOnlyOpen] = useState(false);
  // `htmlFor`/`id` tường minh — KHÔNG chỉ bọc `<label>` suông: Biome
  // (`noLabelWithoutControl`) đọc TSX tĩnh nên không thấy `<Checkbox>` render
  // ra `<input>` ẩn bên trong; cùng khuôn `tours-filters.tsx` đã dùng.
  const onlyOpenId = useId();

  const visible = onlyOpen ? departures.filter((d) => d.seatsLeft > 0) : departures;
  const months = departureMonths(visible);
  const selected = departures.find((d) => d.id === selectedId);

  return (
    <Dialog
      open={allDatesOpen}
      onOpenChange={(open) => {
        // Escape, click nền, hay nút X đều đi qua đây — một cửa duy nhất về
        // context, không rẽ nhánh xử lý riêng cho từng cách đóng.
        if (!open) closeAllDates();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-[640px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <DialogTitle className="font-heading text-base leading-[20px] font-medium">
            {t.dialogs.allDatesTitle}
          </DialogTitle>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t.dialogs.close}>
                <XIcon />
              </Button>
            }
          />
        </div>

        <div className="border-b border-border px-4 py-3">
          <label
            htmlFor={onlyOpenId}
            className="flex cursor-pointer items-center gap-2 text-sm leading-[20px] text-foreground"
          >
            <Checkbox
              id={onlyOpenId}
              checked={onlyOpen}
              onCheckedChange={(checked) => setOnlyOpen(checked === true)}
            />
            {t.dialogs.onlyOpen}
          </label>
        </div>

        {/* data-lenis-prevent: Lenis chặn wheel trên cả tài liệu nên lăn chuột
            trong vùng cuộn lồng lại cuộn TRANG CHÍNH — cùng luật đã áp cho
            `DeparturesTable`/`TourReviews`. */}
        <div data-lenis-prevent className="max-h-[60vh] overflow-y-auto">
          {months.length === 0 ? (
            // Không đợt nào khớp bộ lọc (hoặc tour không có đợt nào) → nói
            // thẳng, KHÔNG để danh sách trống trơn không giải thích.
            <p className="px-4 py-10 text-center text-sm leading-[20px] text-muted-foreground">
              {t.dialogs.noMatch}
            </p>
          ) : (
            months.map((group) => (
              <div key={group.month}>
                {/* Dính khi cuộn + NỀN ĐẶC: không có nền thì chữ tháng chồng
                    lên hàng đang cuộn qua phía dưới nó. */}
                <p className="sticky top-0 z-10 border-b border-border bg-popover px-4 py-2 text-xs leading-[16px] font-medium tracking-wide text-muted-foreground uppercase">
                  {monthLabel(group.month)}
                </p>
                <ul>
                  {group.items.map((departure) => {
                    const status = departureStatus(departure.seatsLeft);
                    const soldOut = status === 'sold-out';
                    const isSelected = departure.id === selectedId;
                    const duration = departureDurationDays(departure.startDate, departure.endDate);

                    return (
                      <li key={departure.id}>
                        <button
                          type="button"
                          // Hết chỗ phải DISABLED THẬT, không chỉ mờ bằng CSS —
                          // luật hiển thị của spec.
                          disabled={soldOut}
                          aria-pressed={isSelected}
                          onClick={() => {
                            select(departure.id);
                            closeAllDates();
                          }}
                          className={cn(
                            'flex w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0',
                            !soldOut && 'cursor-pointer hover:bg-muted/50',
                            soldOut && 'cursor-not-allowed opacity-60',
                            isSelected && !soldOut && 'bg-primary/10',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden="true"
                              className={cn(
                                'size-2 shrink-0 rounded-full',
                                status === 'available' && 'bg-success',
                                status === 'limited' && 'bg-warning',
                                soldOut && 'bg-muted-foreground',
                              )}
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-sm leading-[20px] font-medium text-foreground">
                                {formatDate(departure.startDate)} → {formatDate(departure.endDate)}
                              </span>
                              <span className="text-xs leading-[16px] text-muted-foreground">
                                {t.durationValue(duration)} ·{' '}
                                {soldOut
                                  ? t.departures.soldOut
                                  : t.mediaPanel.seatsLeft(departure.seatsLeft)}
                              </span>
                            </span>
                          </span>

                          <span className="flex shrink-0 items-center gap-4">
                            <span className="flex flex-col items-end gap-0.5">
                              {departure.compareAtPrice ? (
                                <>
                                  <span className="sr-only">
                                    {t.wasPrice(formatMoney(departure.compareAtPrice, currency))}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    className="text-xs leading-[16px] text-price-compare tabular-nums line-through"
                                  >
                                    {formatMoney(departure.compareAtPrice, currency)}
                                  </span>
                                </>
                              ) : null}
                              <span
                                className={cn(
                                  'text-sm leading-[20px] font-medium tabular-nums',
                                  soldOut
                                    ? 'text-muted-foreground line-through'
                                    : 'text-foreground',
                                )}
                              >
                                {formatMoney(departure.effectivePrice, currency)}
                              </span>
                            </span>

                            <span
                              className={cn(
                                'flex items-center gap-1 text-xs leading-[16px] font-medium',
                                isSelected ? 'text-primary' : 'text-muted-foreground',
                              )}
                            >
                              {isSelected ? (
                                <>
                                  <CheckIcon aria-hidden="true" className="size-3.5" />
                                  {t.dialogs.selected}
                                </>
                              ) : (
                                t.dialogs.select
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Chân modal hiện đợt đang chọn (luật hiển thị của brief). Có thể
            không có gì để hiện: mọi đợt hết chỗ thì `selectedId` là undefined. */}
        {selected ? (
          <div className="border-t border-border px-4 py-3 text-sm leading-[20px] text-foreground">
            <span className="text-muted-foreground">{t.dialogs.selected}: </span>
            {formatDateRange(selected.startDate, selected.endDate)} ·{' '}
            {formatMoney(selected.effectivePrice, currency)}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
