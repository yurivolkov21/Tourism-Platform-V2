import { Prisma } from '../../generated/prisma/client.js';
import { TourCostBasis } from '../../generated/prisma/enums.js';

/**
 * Cộng giá vốn của một tour (ADR-0033 §2) — THUẦN, không đụng Prisma client,
 * nên mọi biên làm tròn test được mà không cần DB.
 *
 * ## Ba hàm chứ không một
 *
 * `perPersonTotal` và `perDepartureTotal` là hai vế mà BÁO CÁO dùng TÁCH
 * RIÊNG, và sự tách ấy chính là thứ khiến luật huỷ nói được thành câu
 * (ADR-0033 §4): khách huỷ thì chi phí biến đổi đi theo họ, còn chi phí cố
 * định ở lại — xe vẫn chạy. `derivedCostPrice` thì gộp cả hai thành con số
 * BÁN HÀNG (`Tour.costPrice`), thứ chỉ dùng để đặt giá và xem biên.
 *
 * Gộp ba thành một là mất đúng cái phân biệt đắt giá nhất của mô hình.
 *
 * ## Vì sao ở `apps/api` chứ không ở contract
 *
 * Hôm nay CHỈ api tính những con số này (đường tạo booking và seed). Luật của
 * `review-policy.ts` được đưa lên contract vì API dùng nó làm CỔNG còn web
 * dùng nó để QUYẾT HIỂN THỊ — hai bên đọc cùng một luật. Ở đây chưa có bên
 * thứ hai. Khi phase `/tours` dựng form nhập giá vốn và cần tính lại
 * `costPrice` ngay trên màn hình, đó là lúc nâng lên contract — không phải
 * bây giờ.
 */

/** Chỉ hai field này là đủ để cộng — nhận rộng để seed và service cùng gọi được. */
export interface CostItemLike {
  amount: Prisma.Decimal;
  basis: TourCostBasis;
}

const ZERO = new Prisma.Decimal(0);

function sumWhere(items: readonly CostItemLike[], basis: TourCostBasis): Prisma.Decimal {
  return items.reduce((sum, item) => (item.basis === basis ? sum.add(item.amount) : sum), ZERO);
}

/**
 * Σ dòng theo ĐẦU KHÁCH — tiền này nhân với số ghế của một booking, và biến
 * mất cùng khách khi họ huỷ.
 */
export function perPersonTotal(items: readonly CostItemLike[]): Prisma.Decimal {
  return sumWhere(items, TourCostBasis.PER_PERSON);
}

/**
 * Σ dòng theo CHUYẾN — tính MỘT lần cho mỗi chuyến đã chạy, không nhân ghế và
 * không giảm khi khách huỷ.
 */
export function perDepartureTotal(items: readonly CostItemLike[]): Prisma.Decimal {
  return sumWhere(items, TourCostBasis.PER_DEPARTURE);
}

/**
 * `Tour.costPrice` — công thức operator thật: *chi phí cố định ÷ số khách +
 * chi phí biến đổi mỗi khách*.
 *
 * Mẫu số là `maxGroupSize`, tức cách đọc LẠC QUAN: chuyến bán nửa ghế thì giá
 * vốn thật mỗi khách cao hơn con số này. Giới hạn đã ghi ở ADR-0033 §Giới hạn
 * #1, và nó KHÔNG chảy vào báo cáo — báo cáo dùng hai vế tách riêng ở trên,
 * không dùng hàm này.
 *
 * `maxGroupSize <= 0` không thể xảy ra với dữ liệu hợp lệ, nhưng chia cho 0
 * trong `Prisma.Decimal` NÉM LỖI — và một tour cấu hình sai không được phép
 * làm chết đường TẠO BOOKING. Bỏ qua phần cố định là cách hỏng an toàn: con
 * số thấp hơn sự thật, không phải một exception giữa transaction đang giữ
 * advisory lock ghế.
 */
export function derivedCostPrice(
  items: readonly CostItemLike[],
  maxGroupSize: number,
): Prisma.Decimal {
  const variable = perPersonTotal(items);
  if (maxGroupSize <= 0) return variable.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return variable
    .add(perDepartureTotal(items).div(maxGroupSize))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
