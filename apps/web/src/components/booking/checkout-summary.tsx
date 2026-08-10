import type { MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { ReactNode } from 'react';
import type { DepartureVM } from '@/lib/api/tours';
import { formatDateRange, formatMoney } from '@/lib/tours';

/** Dữ liệu tour cần cho card tóm tắt — CHỈ những field card này thật sự vẽ,
    không phải toàn bộ `TourDetailVM` (tránh siết component vào một shape lớn
    hơn nó cần). */
export interface CheckoutSummaryTour {
  title: string;
  cover: MediaItem | null;
  durationDays: number;
  destinationNames: string[];
  ratingAvg: number | null;
  ratingCount: number;
}

/**
 * Card tóm tắt đơn ở cột phải trang `/tours/[slug]/book` (checkout hướng B —
 * marketplace). KHÔNG `'use client'`: thuần render, để `BookingForm` (client)
 * import và bọc `cta` (nút submit) vào form của chính nó — `cta` nằm TRONG
 * `<form>` cha, component này không tự dựng `<form>`/`<button>` submit riêng.
 *
 * `departure: null` (chưa chọn đợt khởi hành) → breakdown hiện
 * `pickDeparture`, không có dòng giá/total nào — tránh hiện số tiền bịa khi
 * chưa có đợt để tính.
 */
export function CheckoutSummary({
  tour,
  departure,
  numAdults,
  numChildren,
  currency,
  cta,
}: {
  tour: CheckoutSummaryTour;
  departure: DepartureVM | null;
  numAdults: number;
  numChildren: number;
  currency: string;
  cta: ReactNode;
}): ReactNode {
  const t = messages.checkoutSummary;

  // Luật giá của hệ: trẻ em CÙNG đơn giá người lớn — `effectivePrice × n`,
  // không có mức giá riêng cho trẻ em. Cùng luật đã áp ở `booking-form.tsx`
  // (API: totalAmount(unitPrice, adults + children)).
  const unit = departure ? Number(departure.effectivePrice) : null;
  const adultsAmount = unit === null ? null : (unit * numAdults).toFixed(2);
  const childrenAmount = unit === null ? null : (unit * numChildren).toFixed(2);
  const totalAmount = unit === null ? null : (unit * (numAdults + numChildren)).toFixed(2);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {tour.cover ? (
        // `<img>` thường, KHÔNG `next/image`: `next.config.ts` chưa khai
        // `images.remotePatterns` cho host media thật (vd res.cloudinary.com)
        // — `next/image` sẽ ném lỗi cứng cho ảnh ở host chưa khai báo. Đổi
        // sang `next/image` khi hạ tầng ảnh được cấu hình (ngoài phạm vi Task 2).
        // biome-ignore lint/performance/noImgElement: lý do ở comment trên.
        <img
          src={tour.cover.url}
          alt={tour.cover.alt ?? ''}
          className="aspect-16/9 w-full object-cover"
        />
      ) : null}

      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{t.heading}</h2>
          <p className="mt-2 font-medium text-foreground">{tour.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {messages.tourDetail.durationValue(tour.durationDays)} ·{' '}
            {tour.destinationNames.join(' · ')}
            {tour.ratingAvg !== null ? (
              <>
                {' · '}
                <span className="text-rating">★</span> {tour.ratingAvg.toFixed(1)} (
                {tour.ratingCount})
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
            {t.freeCancellation}
          </span>
          <span className="rounded-full bg-info/10 px-2.5 py-1 text-xs font-medium text-info">
            {t.instantConfirmation}
          </span>
        </div>

        <div className="border-t pt-4">
          {departure && unit !== null && adultsAmount !== null && totalAmount !== null ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                {formatDateRange(departure.startDate, departure.endDate)}
              </p>
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-muted-foreground">{t.adultsLine(numAdults)}</span>
                <span className="text-foreground">{formatMoney(adultsAmount, currency)}</span>
              </div>
              {numChildren > 0 && childrenAmount !== null ? (
                <div className="flex items-center justify-between tabular-nums">
                  <span className="text-muted-foreground">{t.childrenLine(numChildren)}</span>
                  <span className="text-foreground">{formatMoney(childrenAmount, currency)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t pt-3 tabular-nums">
                <span className="text-lg font-semibold text-foreground">{t.totalLabel}</span>
                <span className="text-lg font-semibold text-foreground">
                  {formatMoney(totalAmount, currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{t.taxesNote}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.pickDeparture}</p>
          )}
        </div>

        {cta}

        <p className="border-t pt-4 text-xs text-muted-foreground">{t.trustRow}</p>
      </div>
    </div>
  );
}
