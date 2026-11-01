import type { TourNextDeparture } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ALMOST_FULL_THRESHOLD, formatDepartureDate } from '@/features/tour-detail/departures';
import { formatMoney } from '@/lib/format-money';

/** Phần giá và dòng đợt mà thẻ tour (`TourListCard`) cần — chung cho Explore và Saved. */
export interface TourCardPriceInput {
  priceFrom: string;
  basePrice: string;
  currency: string;
  nextDeparture: TourNextDeparture | null;
}

export interface TourCardLabels {
  priceLabel: string;
  compareAtPriceLabel: string | null;
  /** "−15%" trên góc ảnh — chỉ khi có giá gạch (cùng điều kiện). */
  discountLabel: string | null;
  departureLabel: string;
  seatsLabel: string | null;
  almostFull: boolean;
}

/**
 * Nhãn giá và dòng đợt của một thẻ tour (khung B2 của bản vẽ app 19/10). Explore đọc từ
 * `TourCard`, Saved đọc từ `WishlistItem` — hai lược đồ cùng mang `priceFrom` và
 * `nextDeparture` tính theo một luật (ADR-0058 §1), nên hai thẻ phải in như nhau (review M2-14).
 * Giá gạch CHỈ khi có khuyến mãi thật (luật 15/09 của web): giá "from" dưới giá gốc.
 */
export function tourCardLabels(tour: TourCardPriceInput): TourCardLabels {
  const { nextDeparture } = tour;
  const showCompare = Number(tour.priceFrom) < Number(tour.basePrice);
  return {
    priceLabel: formatMoney(tour.priceFrom, tour.currency),
    compareAtPriceLabel: showCompare ? formatMoney(tour.basePrice, tour.currency) : null,
    discountLabel: showCompare
      ? messages.mobile.explore.discountBadge(discountPercent(tour.basePrice, tour.priceFrom))
      : null,
    departureLabel:
      nextDeparture === null
        ? messages.mobile.explore.datesOnRequest
        : messages.mobile.tourDetail.nextDeparture(formatDepartureDate(nextDeparture.startDate)),
    seatsLabel:
      nextDeparture === null ? null : messages.mobile.tourDetail.seatsLeft(nextDeparture.seatsLeft),
    almostFull: nextDeparture !== null && nextDeparture.seatsLeft <= ALMOST_FULL_THRESHOLD,
  };
}

/**
 * Phần trăm giảm, làm tròn xuống — cùng công thức `discountPercent` của web: tính trên SỐ XU NGUYÊN
 * để `(35 − 28.35) / 35` ra đúng 19 chứ không phải 18,999… rồi cắt còn 18.
 */
export function discountPercent(basePrice: string, price: string): number {
  const base = Math.round(Number(basePrice) * 100);
  const now = Math.round(Number(price) * 100);
  return Math.floor(((base - now) * 100) / base);
}
