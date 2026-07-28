'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { departureStatus, discountPercent, formatDateRange, formatMoney } from '@/lib/tours';
import type { MockTourDeparture } from '@/mocks/types';

/**
 * Rail booking — nơi đợt đang chọn được nói lại bằng con số, cộng CTA.
 *
 * `Reserve` là <button> KHÔNG điều hướng: luồng đặt chỗ (`/tours/[slug]/book`)
 * chưa tồn tại, và luật của cụm là không đẩy người dùng vào 404. Đúng tiền lệ nút
 * `Book a tour` trên navbar. CTA phụ `Ask about this trip` → /contact (có thật).
 */
export function BookingRail({
  departure,
  currency,
  basePrice,
  durationDays,
  maxGroupSize,
  variant,
}: {
  /** Đợt đang chọn; `undefined` khi tour chưa mở đợt nào. */
  departure: MockTourDeparture | undefined;
  currency: string;
  /** Giá mặc định khi chưa có đợt — hero cũng in "from" giá này. */
  basePrice: string;
  durationDays: number;
  /** Mẫu số của thanh mức ghế. Xem comment ở SeatMeter. */
  maxGroupSize: number;
  /** `rail` = cột phải dính (từ lg). `bar` = bar dính đáy (dưới lg). */
  variant: 'rail' | 'bar';
}) {
  const t = messages.tourDetail;

  // ── Bar đáy mobile ──
  // Một hàng gọn: giá · ngày · dòng sandbox bên trái, nút bên phải. KHÔNG nhồi
  // thanh ghế và CTA phụ vào đây — bar đáy là lối vào hành động, không phải bản
  // thu nhỏ của cả rail.
  //
  // `pr-20` chừa đúng góc dưới-phải cho nút scroll-to-top: nó là
  // `fixed right-5 bottom-6 size-11` cùng `z-(--z-sticky)`, tức nằm ĐÈ lên bar
  // và đã che mất nút Reserve (đo được ở ảnh mobile vòng đầu). Không hạ z-index
  // của nó: cùng lớp thì thứ tự DOM quyết định, và dù có thắng thì nút tròn vẫn
  // phủ lên chữ. Chừa chỗ là cách duy nhất không phá component toàn cục —
  // `scroll-to-top.tsx` cũng đã có tiền lệ lùi vị trí khi góc đó bị chiếm.
  if (variant === 'bar') {
    return (
      <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t bg-background/95 px-4 py-3 pr-20 backdrop-blur lg:hidden">
        {departure ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-baseline gap-1.5">
                <span className="font-heading text-xl font-semibold text-foreground tabular-nums">
                  {formatMoney(departure.effectivePrice, currency)}
                </span>
                <span className="text-xs text-muted-foreground">{t.booking.perPerson}</span>
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {formatDateRange(departure.startDate, departure.endDate)}
              </p>
              {/* Dòng sandbox chuyển sang cột TRÁI: đặt dưới nút thì nó nong cột
                  phải ra và bóp chính cái nút. Vẫn nằm trong cùng một bar cao
                  ~64px nên vẫn ở ngay cạnh chỗ người dùng sắp bấm. */}
              <p className="truncate text-[0.6875rem] text-muted-foreground">
                {t.booking.testMode}
              </p>
            </div>
            <Button type="button" className="shrink-0">
              {t.booking.reserve}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">{t.departures.none}</p>
            <ButtonLink variant="outline" className="shrink-0" href="/contact">
              {t.booking.ask}
            </ButtonLink>
          </div>
        )}
      </div>
    );
  }

  // ── Rail dính (từ lg) ──
  return (
    <div className={cn('rounded-2xl border bg-card p-5', 'lg:sticky lg:top-28')}>
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        {t.departures.railLabel}
      </p>

      {departure ? (
        <>
          <p className="mt-3 font-heading text-lg font-medium text-foreground">
            {formatDateRange(departure.startDate, departure.endDate)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.durationValue(durationDays)} · {t.groupSize(maxGroupSize)}
          </p>

          <PriceBlock departure={departure} currency={currency} />
          <SeatMeter seatsLeft={departure.seatsLeft} maxGroupSize={maxGroupSize} />

          <Button type="button" className="mt-5 w-full">
            {t.booking.reserve}
          </Button>
          {/* Câu sandbox NGẮN đặt sát nút — chỗ người dùng thật sự phân vân trước
              khi bấm (spec §6.5). Câu dài ở chân bảng đợt. Không banner đỏ. */}
          <p className="mt-3 text-xs text-muted-foreground">{t.booking.testMode}</p>

          <ButtonLink variant="ghost" className="mt-2 w-full" href="/contact">
            {t.booking.ask}
          </ButtonLink>
        </>
      ) : (
        <>
          {/* Chưa mở đợt nào: BỎ HẲN giá và nút Reserve. Hiện giá "from" cạnh một
              nút không đặt được là mời người dùng bấm vào chỗ không có gì. */}
          <p className="mt-3 font-medium text-foreground">{t.departures.none}</p>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">{t.departures.noneBody}</p>
          <p className="mt-4 flex items-baseline gap-1.5 text-sm text-muted-foreground">
            <span>{t.fromPrice}</span>
            <span className="font-heading text-lg font-semibold text-foreground tabular-nums">
              {formatMoney(basePrice, currency)}
            </span>
            <span className="text-xs">{t.booking.perPerson}</span>
          </p>
          <ButtonLink className="mt-5 w-full" href="/contact">
            {t.booking.ask}
          </ButtonLink>
        </>
      )}
    </div>
  );
}

function PriceBlock({ departure, currency }: { departure: MockTourDeparture; currency: string }) {
  const t = messages.tourDetail;
  // Giảm giá tính theo giá CỦA ĐỢT, không phải basePrice của tour: đợt có
  // priceOverride riêng nên hai con số có thể khác nhau.
  const discount = discountPercent(departure.effectivePrice, departure.compareAtPrice);

  return (
    <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-heading text-3xl font-semibold text-foreground tabular-nums">
        {formatMoney(departure.effectivePrice, currency)}
      </span>
      <span className="text-xs text-muted-foreground">{t.booking.perPerson}</span>
      {departure.compareAtPrice ? (
        <>
          <span className="sr-only">
            {t.wasPrice(formatMoney(departure.compareAtPrice, currency))}
          </span>
          <span aria-hidden="true" className="text-sm text-price-compare tabular-nums line-through">
            {formatMoney(departure.compareAtPrice, currency)}
          </span>
        </>
      ) : null}
      {discount !== null ? (
        <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-white">
          −{discount}%
        </span>
      ) : null}
    </div>
  );
}

/**
 * Thanh mức ghế. Mẫu số là `maxGroupSize` của tour — contract KHÔNG có sức chứa
 * riêng từng đợt, nên đây là xấp xỉ tốt nhất từ dữ liệu có thật, và nó vẫn đúng
 * về mặt ý nghĩa: "còn N trong tối đa M khách".
 *
 * Thanh là `aria-hidden`: nghĩa đã nằm trọn trong dòng chữ ngay dưới nó, thêm
 * một nhãn nữa cho trình đọc màn hình chỉ là nói hai lần.
 */
function SeatMeter({ seatsLeft, maxGroupSize }: { seatsLeft: number; maxGroupSize: number }) {
  const t = messages.tourDetail;
  const status = departureStatus(seatsLeft);
  // Kẹp về [0,100]: dữ liệu lệch (seatsLeft > maxGroupSize) không được vẽ ra
  // thanh tràn khỏi khung.
  const filled = Math.max(0, Math.min(100, Math.round((seatsLeft / maxGroupSize) * 100)));

  return (
    <div className="mt-4">
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            status === 'limited' ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${filled}%` }}
        />
      </div>
      <p
        className={cn(
          'mt-2 text-xs',
          status === 'limited' ? 'font-medium text-warning' : 'text-muted-foreground',
        )}
      >
        {status === 'limited'
          ? t.departures.seatsLimited(seatsLeft)
          : t.departures.seatsAvailable(seatsLeft)}
      </p>
    </div>
  );
}
