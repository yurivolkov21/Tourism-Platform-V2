import { z } from 'zod';
import { fromCents, toCents } from './refund-policy.js';

/**
 * Giá vốn của một tour (ADR-0033 §2) — THUẦN, không đụng DB.
 *
 * ## Ba hàm chứ không một
 *
 * `perPersonTotal` và `perDepartureTotal` là hai vế mà BÁO CÁO dùng tách riêng:
 * khách huỷ thì chi phí theo khách đi theo họ, còn chi phí theo chuyến ở lại —
 * xe vẫn chạy (ADR-0033 §4). `derivedCostPrice` gộp cả hai thành con số BÁN
 * HÀNG (`Tour.costPrice`), chỉ để đặt giá và xem biên lời. Gộp ba thành một là
 * mất đúng cái phân biệt đắt giá nhất của mô hình.
 *
 * ## Vì sao ở contract
 *
 * Dời từ `apps/api` lên đây ở F17 (ADR-0047 §8): màn Costs của admin tính tổng
 * ngay khi gõ, còn API tính lúc ghi — hai bên phải ra CÙNG một con số, nên chỉ
 * được có một bản.
 *
 * Tính trên CENT NGUYÊN như `refund-policy.ts`: tiền không bao giờ đi qua số
 * thực. Ba chuỗi trả về luôn có đúng hai chữ số lẻ ("135.50").
 */

/** Gương enum Prisma `TourCostCategory` — báo cáo nhóm theo hạng mục nên là enum đóng. */
export const TourCostCategorySchema = z.enum([
  'TRANSPORT',
  'ACCOMMODATION',
  'MEALS',
  'GUIDE',
  'ACTIVITIES',
  'PERMITS',
  'INSURANCE',
  'OTHER',
]);
export type TourCostCategory = z.output<typeof TourCostCategorySchema>;

/** Gương enum Prisma `TourCostBasis`. */
export const TourCostBasisSchema = z.enum(['PER_PERSON', 'PER_DEPARTURE']);
export type TourCostBasis = z.output<typeof TourCostBasisSchema>;

/** Hai field là đủ để cộng. `amount` là chuỗi thập phân như cột `Decimal(14,2)`. */
export interface CostItemLike {
  amount: string;
  basis: TourCostBasis;
}

function sumCents(items: readonly CostItemLike[], basis: TourCostBasis): number {
  return items.reduce((sum, item) => (item.basis === basis ? sum + toCents(item.amount) : sum), 0);
}

/** Σ dòng theo ĐẦU KHÁCH — nhân với số ghế của một booking, biến mất cùng khách khi họ huỷ. */
export function perPersonTotal(items: readonly CostItemLike[]): string {
  return fromCents(sumCents(items, 'PER_PERSON'));
}

/** Σ dòng theo CHUYẾN — tính MỘT lần cho mỗi chuyến đã chạy, không nhân ghế. */
export function perDepartureTotal(items: readonly CostItemLike[]): string {
  return fromCents(sumCents(items, 'PER_DEPARTURE'));
}

/**
 * `Tour.costPrice` — *chi phí theo chuyến ÷ số khách tối đa + chi phí theo khách*,
 * làm tròn nửa cent đi lên (HALF_UP) như bản `Prisma.Decimal` cũ.
 *
 * Mẫu số là `maxGroupSize`, tức cách đọc LẠC QUAN: chuyến bán nửa ghế thì giá
 * vốn thật mỗi khách cao hơn con số này (ADR-0033 §Giới hạn #1). Báo cáo không
 * dùng hàm này mà dùng hai vế tách riêng ở trên.
 *
 * `maxGroupSize <= 0` không xảy ra với dữ liệu hợp lệ; gặp thì bỏ phần theo
 * chuyến — con số thấp hơn sự thật, không phải một lỗi chia cho 0 giữa đường
 * tạo booking.
 */
export function derivedCostPrice(items: readonly CostItemLike[], maxGroupSize: number): string {
  const variable = sumCents(items, 'PER_PERSON');
  if (maxGroupSize <= 0) return fromCents(variable);
  const fixed = sumCents(items, 'PER_DEPARTURE');
  // HALF_UP trên số nguyên: ⌊(2·fixed + n) / 2n⌋ bằng fixed/n làm tròn nửa lên.
  const fixedShare = Math.floor((2 * fixed + maxGroupSize) / (2 * maxGroupSize));
  return fromCents(variable + fixedShare);
}
