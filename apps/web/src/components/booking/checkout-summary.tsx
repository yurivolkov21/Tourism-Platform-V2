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

/** Ba mức trấn an hủy/hoàn tiền — đối chiếu ĐÚNG mốc thật của
    `legal/cancellation.ts` (§ "Refund guidelines"), không bịa số khác. */
export type CancellationAssuranceKind = 'full' | 'partial' | 'closeWindow';

export interface CancellationAssurance {
  kind: CancellationAssuranceKind;
  /** Ngày cắt (YYYY-MM-DD) cho `full`/`partial`; `null` ở `closeWindow` —
   *  không có mốc nào để nói, câu closeWindow không mang ngày. */
  cutoffDate: string | null;
}

/** Số ngày lịch từ 00:00 UTC tới một mốc `y-m-d` — dùng làm trục chung để trừ
    hai ngày lịch mà không dính múi giờ/DST (`Date.UTC` không có DST). */
function utcDayIndex(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Trừ N ngày khỏi một chuỗi ngày `YYYY-MM-DD`, trả về cùng khuôn dạng. Tách
    riêng thay vì `new Date(dateStr)`: chuỗi date-only bị hiểu là UTC rồi hiển
    thị theo giờ máy (bẫy đã ghi ở `formatDateRange`) — ở đây luôn thao tác
    trên trục UTC nên không dính bẫy đó. */
function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d) - days * 86_400_000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Mốc trấn an hủy/hoàn tiền, tính từ `startDate` của đợt đang chọn — hàm
 * THUẦN, `now` truyền vào được để test không phụ thuộc đồng hồ thật (cùng
 * khuôn `pendingExpiry` ở `lib/checkout.ts`).
 *
 * Ba nhánh đúng "Refund guidelines" của `legal/cancellation.ts`:
 * - `diffDays >= 30` → `full`, cắt ở `startDate − 30 ngày`.
 * - `diffDays >= 15` → `partial` (khoảng 15–29 ngày của policy), cắt ở
 *   `startDate − 15 ngày`.
 * - còn lại (< 15 ngày, gồm cả mốc 14 ngày mà policy để lửng giữa "15–29" và
 *   "fewer than 14") → `closeWindow` — KHÔNG hứa số, an toàn hơn là đoán.
 *
 * `now` lấy theo giờ ĐỊA PHƯƠNG của khách (`getFullYear/Month/Date`, không
 * phải `getUTCFullYear`) — đó là ngày lịch khách đang thấy trên máy mình;
 * `startDate` (date-only) lại luôn đọc theo UTC (theo quy ước
 * `formatDateRange`). Quy cả hai về trục `utcDayIndex` trước khi trừ để phép
 * trừ ra đúng số ngày lịch, không lệch theo offset múi giờ.
 */
export function computeCancellationAssurance(
  startDate: string,
  now: Date = new Date(),
): CancellationAssurance {
  const [sy, sm, sd] = startDate.split('-').map(Number) as [number, number, number];
  const startDay = utcDayIndex(sy, sm, sd);
  const todayDay = utcDayIndex(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const diffDays = startDay - todayDay;

  if (diffDays >= 30) return { kind: 'full', cutoffDate: subtractDays(startDate, 30) };
  if (diffDays >= 15) return { kind: 'partial', cutoffDate: subtractDays(startDate, 15) };
  return { kind: 'closeWindow', cutoffDate: null };
}

/** Dòng trấn an dưới CTA — lắp câu từ `messages` + link `cancellation policy`
    trỏ `/cancellation-policy`, KHÔNG bịa link riêng cho từng nhánh (một đích
    duy nhất, đúng chính sách thật đang sống ở đó). */
export function CancellationAssuranceLine({ departure }: { departure: DepartureVM }) {
  const t = messages.checkoutSummary.cancellationAssurance;
  const assurance = computeCancellationAssurance(departure.startDate);

  const prefix =
    assurance.kind === 'full' && assurance.cutoffDate !== null
      ? t.full(formatDateRange(assurance.cutoffDate, assurance.cutoffDate))
      : assurance.kind === 'partial' && assurance.cutoffDate !== null
        ? t.partial(formatDateRange(assurance.cutoffDate, assurance.cutoffDate))
        : t.closeWindow;

  return (
    <p className="text-xs text-muted-foreground">
      {prefix}{' '}
      <Link
        href="/cancellation-policy"
        className="underline underline-offset-4 hover:text-foreground"
      >
        {t.policyLinkLabel}
      </Link>
      {assurance.kind === 'closeWindow' ? ` ${t.closeWindowSuffix}` : ''}
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
            {t.flexibleCancellation}
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

        {/* Trấn an TRUNG THỰC ngay dưới CTA — chỉ hiện khi đã có đợt để tính
            mốc thật; `departure: null` không bịa mốc. */}
        {departure ? <CancellationAssuranceLine departure={departure} /> : null}

        <p className="border-t pt-4 text-xs text-muted-foreground">{t.trustRow}</p>
      </div>
    </div>
  );
}
