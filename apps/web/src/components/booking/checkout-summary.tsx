'use client';

import type { MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DepartureVM } from '@/lib/api/tours';
import { computeBookingTotal } from '@/lib/checkout';
import { SPRING } from '@/lib/motion';
import { formatChipDate, formatDateRange, formatMoney } from '@/lib/tours';

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
 * Dòng hạn chót dưới CTA — in thẳng `bookingDeadline` của đợt đang chọn, do
 * server tính theo ngày Việt Nam (ADR-0041 §7). Web KHÔNG tự trừ N ngày và
 * KHÔNG so với giờ trình duyệt, nên chỉnh đồng hồ máy không đổi được câu này
 * (spec §2 Q7); cũng không có biến thể "until today" — luôn là một ngày cụ thể.
 *
 * Link `/cancellation-policy` là đích DUY NHẤT, không bịa link riêng cho từng
 * tour: chính sách thật sống ở đó.
 */
export function CancellationDeadlineLine({ departure }: { departure: DepartureVM }): ReactNode {
  const t = messages.cancellationDeadline;
  return (
    <p className="text-xs text-muted-foreground">
      {t.full(formatChipDate(departure.bookingDeadline))}{' '}
      <Link
        href="/cancellation-policy"
        className="underline underline-offset-4 hover:text-foreground"
      >
        {t.policyLink}
      </Link>
    </p>
  );
}

/**
 * Card tóm tắt đơn ở cột phải trang `/tours/[slug]/book` (checkout hướng B —
 * marketplace). KHÔNG `'use client'`: thuần render, để `BookingWizard` (client)
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
  /**
   * Nút hành động đặt ngay dưới bảng giá — TUỲ CHỌN từ 19/08.
   *
   * Wizard 4 bước đặt CTA ở thanh chân của cột trái (đúng wireframe), nên nó
   * không truyền `cta`; các chỗ dùng cũ vẫn truyền như thường. Để bắt buộc thì
   * wizard phải nhét vào một `<></>` rỗng — một prop giả để làm vừa lòng type,
   * và đó là kiểu nói dối nhỏ mà về sau không ai hiểu vì sao có.
   */
  cta?: ReactNode;
}): ReactNode {
  const t = messages.checkoutSummary;

  // Luật giá của hệ: trẻ em CÙNG đơn giá người lớn — `effectivePrice × n`,
  // không có mức giá riêng cho trẻ em. Cùng luật đã áp ở `booking-form.tsx`
  // (API: totalAmount(unitPrice, adults + children)).
  const unit = departure ? Number(departure.effectivePrice) : null;
  const adultsAmount = unit === null ? null : (unit * numAdults).toFixed(2);
  const childrenAmount = unit === null ? null : (unit * numChildren).toFixed(2);
  // NHÓM 5 (final review): MỘT nguồn cho Total, dùng CHUNG với nhãn CTA của
  // `booking-form.tsx` — xem `computeBookingTotal`.
  const totalAmount = departure
    ? computeBookingTotal(departure.effectivePrice, numAdults, numChildren)
    : null;

  return (
    // KHÔNG khung card (đổi 19/08): wizard đặt cột này trong một `<aside>` đã có
    // `border-l` làm ranh giới, nên card lồng vào là hai lớp khung chồng nhau —
    // thấy rõ ở ảnh nghiệm thu bước 1. Ảnh bìa tự bo góc thay vì nhờ
    // `overflow-hidden` của thẻ cha.
    <div>
      {tour.cover ? (
        // `<img>` thường, KHÔNG `next/image`: `next.config.ts` chưa khai
        // `images.remotePatterns` cho host media thật (vd res.cloudinary.com)
        // — `next/image` sẽ ném lỗi cứng cho ảnh ở host chưa khai báo. Đổi
        // sang `next/image` khi hạ tầng ảnh được cấu hình (ngoài phạm vi Task 2).
        // biome-ignore lint/performance/noImgElement: lý do ở comment trên.
        <img
          src={tour.cover.url}
          alt={tour.cover.alt ?? ''}
          className="aspect-16/9 w-full rounded-xl object-cover"
        />
      ) : null}

      <div className="flex flex-col gap-4 pt-4">
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

        {/* Badge outline shadcn chuẩn + chấm trạng thái nhỏ — thay pill nền
            màu loè tự chế (góp ý user: "nhìn giống AI"). Chữ giữ
            `text-foreground` mặc định của variant outline, chấm màu là tín
            hiệu trạng thái duy nhất (mẫu "status badge" shadcnspace.com). */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <span aria-hidden className="size-1.5 rounded-full bg-success" />
            {t.freeCancellation}
          </Badge>
          <Badge variant="outline">
            <span aria-hidden className="size-1.5 rounded-full bg-info" />
            {t.instantConfirmation}
          </Badge>
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
                {/* `key` theo số tiền: mỗi lần tổng đổi (thêm người, đổi đợt) con số
                    mới trượt lên 6px vào chỗ — đủ để mắt bắt được "đã cập nhật"
                    (nhóm motion 2, 19/08). Không opacity — số có trong HTML SSR. */}
                <motion.span
                  key={totalAmount}
                  initial={{ y: 6 }}
                  animate={{ y: 0 }}
                  transition={SPRING}
                  className="inline-block text-lg font-semibold text-foreground"
                >
                  {formatMoney(totalAmount, currency)}
                </motion.span>
              </div>
              <p className="text-xs text-muted-foreground">{t.taxesNote}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.pickDeparture}</p>
          )}
        </div>

        {cta ?? null}

        {/* Ngày chót ngay dưới CTA — chỉ hiện khi đã chọn đợt; `departure: null`
            không có ngày nào để in và cũng không được bịa ra. */}
        {departure ? <CancellationDeadlineLine departure={departure} /> : null}

        <p className="border-t pt-4 text-xs text-muted-foreground">{t.trustRow}</p>
      </div>
    </div>
  );
}
