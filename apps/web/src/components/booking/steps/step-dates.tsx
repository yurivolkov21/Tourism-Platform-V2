import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import type { DepartureVM } from '@/lib/api/tours';
import { departureStatus, formatDateRange, formatMoney } from '@/lib/tours';
import { FieldError } from '../form-parts';
import type { StepShared } from './types';

/**
 * Bước 1 — chọn đợt khởi hành.
 *
 * List thẻ-lựa-chọn này KHÔNG phải dựng mới: nó chuyển gần nguyên từ
 * `booking-form.tsx` cũ, vì bản cũ vốn đã hội tụ đúng mẫu mà wireframe chốt
 * (ngày bên trái, "còn N chỗ" dưới ngày, giá bên phải kèm giá gạch). Thay đổi
 * duy nhất là vỏ: bỏ card bọc ngoài, vì bước này giờ ĐÃ là một màn riêng nên
 * card lồng trong màn là một lớp khung thừa.
 *
 * Đợt hết chỗ vẫn hiện nhưng `disabled` — biến mất thì khách tưởng mình nhớ
 * nhầm ngày, còn hiện mà bấm được thì dẫn vào ngõ cụt.
 */
export function StepDates({
  state,
  errors,
  set,
  currency,
  departures,
}: StepShared & { departures: DepartureVM[] }) {
  const t = messages.booking.wizard.dates;
  const tp = messages.booking.page;

  return (
    <div>
      <h2 className="font-semibold">{t.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.sub}</p>

      <ul className="mt-4 flex flex-col gap-2">
        {departures.map((d) => {
          const soldOut = departureStatus(d.seatsLeft) === 'sold-out';
          const isSelected = d.id === state.departureId;
          return (
            <li key={d.id}>
              <button
                type="button"
                disabled={soldOut}
                aria-pressed={isSelected}
                onClick={() => set('departureId', d.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors',
                  isSelected && 'border-primary ring-1 ring-primary',
                  soldOut && 'cursor-default opacity-60',
                  !soldOut && !isSelected && 'hover:bg-muted/50',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded-full border',
                    isSelected ? 'border-primary bg-primary' : 'border-input bg-background',
                  )}
                >
                  {isSelected ? (
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium tabular-nums">
                    {formatDateRange(d.startDate, d.endDate)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {soldOut
                      ? messages.tourDetail.departures.soldOut
                      : departureStatus(d.seatsLeft) === 'limited'
                        ? messages.tourDetail.departures.seatsLimited(d.seatsLeft)
                        : messages.tourDetail.departures.seatsAvailable(d.seatsLeft)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {d.compareAtPrice ? (
                    <span className="mr-1.5 text-xs text-price-compare line-through tabular-nums">
                      {formatMoney(d.compareAtPrice, currency)}
                    </span>
                  ) : null}
                  <span className="font-heading text-lg font-semibold tabular-nums">
                    {formatMoney(d.effectivePrice, currency)}
                  </span>
                  <span className="block text-xs text-muted-foreground">{tp.perAdult}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {errors.departureId ? <FieldError>{errors.departureId}</FieldError> : null}
    </div>
  );
}
