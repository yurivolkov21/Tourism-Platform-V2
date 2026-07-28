'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tourism/ui/components/table';
import { cn } from '@tourism/ui/lib/utils';
import { departureStatus, formatDateRange, formatMoney } from '@/lib/tours';
import type { MockTourDeparture } from '@/mocks/types';

/**
 * Bảng đợt đầy đủ giữa trang. Dải chip trên hero chỉ hiện 4–6 đợt gần nhất; đây
 * là chỗ xem hết. Chọn ở đâu cũng đồng bộ cả ba nơi (dải · bảng · rail booking).
 */
export function DeparturesTable({
  departures,
  currency,
  durationDays,
  selectedId,
  onSelect,
}: {
  departures: MockTourDeparture[];
  currency: string;
  durationDays: number;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const t = messages.tourDetail;

  if (departures.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
        <p className="font-medium text-foreground">{t.departures.none}</p>
        <p className="mt-2 text-pretty text-muted-foreground">{t.departures.noneBody}</p>
        <ButtonLink variant="outline" className="mt-6" href="/contact">
          {t.booking.ask}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      {/* data-lenis-prevent ở NGOÀI: Table tự bọc mình trong một div
          overflow-x-auto, mà Lenis tìm thuộc tính này bằng closest() từ phần tử
          nhận wheel đi lên, nên đặt ở ancestor là đủ. */}
      <div data-lenis-prevent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.departures.columns.dates}</TableHead>
              <TableHead>{t.departures.columns.length}</TableHead>
              <TableHead>{t.departures.columns.availability}</TableHead>
              <TableHead className="text-right">{t.departures.columns.price}</TableHead>
              {/* Cột nút không có tiêu đề nhìn thấy — nhưng vẫn phải có tên cho
                  trình đọc màn hình, không thì nó đọc một ô trống. */}
              <TableHead className="text-right">
                <span className="sr-only">{t.departures.selectLabel}</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {departures.map((departure) => {
              const status = departureStatus(departure.seatsLeft);
              const soldOut = status === 'sold-out';
              const selected = departure.id === selectedId;
              const range = formatDateRange(departure.startDate, departure.endDate);

              return (
                <TableRow
                  key={departure.id}
                  // data-selected để chọn bằng CSS ở chỗ khác nếu cần, và để
                  // test/QA soi được hàng nào đang chọn mà không dựa vào màu.
                  data-selected={selected || undefined}
                  className={cn(
                    selected && !soldOut && 'bg-accent',
                    soldOut && 'text-muted-foreground opacity-60',
                  )}
                >
                  <TableCell className="font-medium whitespace-nowrap">{range}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.durationValue(durationDays)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span
                      className={cn(
                        status === 'limited' && 'font-medium text-warning',
                        soldOut && 'text-muted-foreground',
                      )}
                    >
                      {soldOut
                        ? t.departures.soldOut
                        : status === 'limited'
                          ? t.departures.seatsLimited(departure.seatsLeft)
                          : t.departures.seatsAvailable(departure.seatsLeft)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {departure.compareAtPrice ? (
                      <>
                        <span className="sr-only">
                          {t.wasPrice(formatMoney(departure.compareAtPrice, currency))}
                        </span>
                        <span
                          aria-hidden="true"
                          className="mr-1.5 text-xs text-price-compare tabular-nums line-through"
                        >
                          {formatMoney(departure.compareAtPrice, currency)}
                        </span>
                      </>
                    ) : null}
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        soldOut && 'text-muted-foreground line-through',
                      )}
                    >
                      {formatMoney(departure.effectivePrice, currency)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      disabled={soldOut}
                      aria-pressed={selected}
                      aria-label={t.departures.select(range)}
                      onClick={() => onSelect(departure.id)}
                    >
                      {selected ? t.departures.selected : t.departures.selectLabel}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Câu sandbox DÀI đặt ở chân bảng — nơi con số xuất hiện dày nhất
          (spec §6.5). Câu ngắn nằm sát nút Reserve trong rail booking. */}
      <p className="mt-4 text-xs text-muted-foreground">{t.booking.sandboxNote}</p>
    </div>
  );
}
