'use client';

import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { useEffect } from 'react';
import type { DepartureVM } from '@/lib/api/tours';
import { bookHref, formatDateRange, formatMoney } from '@/lib/tours';

/**
 * Bar đặt chỗ dính đáy (dưới lg) — nơi đợt đang chọn được nói lại bằng giá và
 * ngày, cộng CTA. Từ lg trở lên việc đặt chỗ nằm ở panel cạnh gallery
 * (`TourMediaPanel`), nên bar ẩn bằng CSS.
 *
 * Biến thể `rail` (cột phải dính từ lg) đã xoá 20/10 (review L2-10): trang tour
 * chỉ dựng bar từ khi panel đặt chỗ ra đời, nên nhánh rail cùng `PriceBlock` và
 * `SeatMeter` của nó không còn call-site nào. Tên component giữ nguyên để không
 * đổi import của trang và các spec.
 *
 * `Reserve` điều hướng tới `/tours/{slug}/book?departure={id}` — mang theo đợt
 * đang chọn để wizard chọn sẵn đúng đợt ấy (`bookHref`, W-02). Không còn đợt đặt
 * được thì CTA là `Ask about this trip` → `/tours/{slug}/enquire` (đổi 19/08, trước
 * là `/contact`): form liên hệ chung không biết khách đang hỏi tour nào, nên đội
 * vận hành phải hỏi lại vòng nữa.
 */
export function BookingRail({
  slug,
  departure,
  currency,
}: {
  /** Slug tour — dựng href trang book cho nút Reserve (`bookHref`). */
  slug: string;
  /** Đợt đang chọn; `undefined` khi tour không còn đợt nào đặt được. */
  departure: DepartureVM | undefined;
  currency: string;
}) {
  const t = messages.tourDetail;

  // Bar đáy đang có mặt thì báo cho hai nút nổi (scroll-to-top, "Plan your trip") qua
  // `<body data-booking-bar>` để chúng đứng lên trên bar (biến thể `in-data-booking-bar`).
  // Bar ẩn từ `lg` bằng CSS, nên hai nút chỉ đọc cờ này dưới `lg`.
  useEffect(() => {
    document.body.dataset.bookingBar = '';
    return () => {
      delete document.body.dataset.bookingBar;
    };
  }, []);

  // Một hàng gọn: giá · ngày · dòng sandbox bên trái, nút bên phải. KHÔNG nhồi
  // thanh ghế và CTA phụ vào đây — bar đáy là lối vào hành động, không phải bản
  // thu nhỏ của panel đặt chỗ.
  //
  // Trước P6 bar chừa `pr-20` cho nút scroll-to-top nằm đè góc phải (nó từng che mất nút
  // Reserve). Nay hai nút nổi đọc `data-booking-bar` ở trên và đứng hẳn lên trên bar, nên
  // góc phải trống và bar dùng đủ bề ngang.
  return (
    <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
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
            <p className="truncate text-[0.6875rem] text-muted-foreground">{t.booking.testMode}</p>
          </div>
          <ButtonLink className="shrink-0" href={bookHref(slug, departure.id)}>
            {t.booking.reserve}
          </ButtonLink>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-muted-foreground">{t.departures.none}</p>
          <ButtonLink variant="outline" className="shrink-0" href={`/tours/${slug}/enquire`}>
            {t.booking.ask}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
