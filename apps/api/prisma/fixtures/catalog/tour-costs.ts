import { createHash } from 'node:crypto';
import { tours as centralTours } from './tours-central.js';
import { tours as northTours } from './tours-north.js';
import { tours as southTours } from './tours-south.js';
import type { TourCostItemFixture, TourFixture } from './types.js';

/**
 * Giá vốn seed cho cả 30 tour (ADR-0033 §2).
 *
 * ## ⚠️ Đây là dữ liệu DỰNG, không phải báo giá nhà cung cấp thật
 *
 * Nó được SINH ra từ một mô hình khai tường minh ngay dưới đây, chứ không phải
 * 130 con số gõ tay. Lý do không phải là lười: một mô hình nhìn thấy được thì
 * đối chiếu được — khi biên gộp của một tour trông lạ, người đọc lần ngược về
 * ba hằng số ở đây và biết ngay vì sao. 130 con số rời thì không ai kiểm nổi,
 * và cũng không ai dám sửa.
 *
 * Đổi lại, mô hình phải TRUNG THỰC về việc nó là mô hình: mọi con số dưới đây
 * là ước lượng theo dải ngành, không phải hợp đồng với ai.
 *
 * ## Tỉ lệ chọn thế nào, và dải nó THẬT SỰ cho ra
 *
 * Đích là dải biên gộp thật của ngành: tour NGÀY 40–50%, tour nhiều ngày
 * 25–35% (đắt hơn vì có khách sạn). Ba hằng dưới đây đặt để rơi vào đó khi
 * chuyến đầy ghế. Đo lại trên 29 tour của catalogue (`tour-costs.spec.ts` khoá
 * bằng test):
 *
 * | Nhóm | Thấp nhất | Trung vị | Cao nhất |
 * | --- | --- | --- | --- |
 * | Tour ngày (14) | 39.4% | 45.5% | 49.8% |
 * | Nhiều ngày (15) | 25.9% | 31.8% | 34.9% |
 *
 * Tour ngày rẻ nhất tụt xuống 39.4%, dưới đích một chút, và đó là **đúng chứ
 * không phải lệch**: chi phí cố định theo NGÀY (xe, hướng dẫn) đè nặng hơn lên
 * một tour $35 so với một tour $79. Ngoài đời cũng vậy — tour rẻ sống bằng số
 * lượng, không bằng biên.
 *
 * Chuyến vơi ghế thì biên thật còn thấp hơn mọi con số ở đây, vì `costPrice`
 * chia chi phí cố định cho `maxGroupSize` (ADR-0033 §Giới hạn #1). Bảng trên
 * là cận TRÊN.
 */

/** Phần giá bán đi vào chi phí THEO KHÁCH của một tour trong ngày. */
const DAY_TOUR_VARIABLE_RATIO = 0.42;

/** Tour nhiều ngày tốn hơn vì có khách sạn — biên gộp vì thế mỏng hơn. */
const MULTI_DAY_VARIABLE_RATIO = 0.61;

/**
 * Chi phí CỐ ĐỊNH mỗi chuyến, quy theo số ghế tối đa: xe và hướng dẫn không
 * đổi theo số khách, nhưng một tour 30 chỗ thì thuê xe to hơn tour 8 chỗ.
 * Nhân thêm số ngày với tour dài — tài xế và hướng dẫn ăn lương theo ngày.
 */
const FIXED_PER_SEAT = 6.5;

/** Làm tròn về 2 chữ số, dạng chuỗi — khớp cột `Decimal(14,2)`. */
const money = (value: number): string => value.toFixed(2);

/**
 * UUID v5 dẫn xuất từ `tourId` + `sortOrder` — id TĨNH mà không phải gõ tay.
 *
 * Seed chạy lại được nhờ `createMany({ skipDuplicates })`, và phép bỏ qua ấy
 * chỉ có tác dụng khi có một khoá để đụng. `tour_cost_items` không có
 * `@@unique` nào ngoài PK, nên PK phải ổn định qua các lượt seed; để Prisma tự
 * sinh là mỗi lượt thêm 130 dòng mới trên DB dùng chung dev/prod.
 */
export function stableId(tourId: string, sortOrder: number): string {
  const hex = createHash('sha1').update(`tour-cost:${tourId}:${sortOrder}`).digest('hex');
  const bytes = hex.slice(0, 32).split('');
  bytes[12] = '5';
  bytes[16] = ['8', '9', 'a', 'b'][Number.parseInt(bytes[16] ?? '0', 16) & 0b11] ?? '8';
  const h = bytes.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function itemsForTour(tour: TourFixture): TourCostItemFixture[] {
  const price = Number(tour.basePrice);
  const multiDay = tour.durationDays > 1;
  const variable = price * (multiDay ? MULTI_DAY_VARIABLE_RATIO : DAY_TOUR_VARIABLE_RATIO);
  const fixed = tour.maxGroupSize * FIXED_PER_SEAT * (multiDay ? tour.durationDays : 1);

  const rows: TourCostItemFixture[] = [
    {
      id: stableId(tour.id, 0),
      tourId: tour.id,
      category: 'TRANSPORT',
      label: 'Vehicle hire and fuel',
      amount: money(fixed * 0.62),
      basis: 'PER_DEPARTURE',
      sortOrder: 0,
    },
    {
      id: stableId(tour.id, 1),
      tourId: tour.id,
      category: 'GUIDE',
      label: multiDay ? 'Guide fee for the whole trip' : 'Guide fee',
      amount: money(fixed * 0.38),
      basis: 'PER_DEPARTURE',
      sortOrder: 1,
    },
    {
      id: stableId(tour.id, 2),
      tourId: tour.id,
      category: 'MEALS',
      label: 'Meals and drinks',
      amount: money(variable * (multiDay ? 0.34 : 0.55)),
      basis: 'PER_PERSON',
      sortOrder: 2,
    },
    {
      id: stableId(tour.id, 3),
      tourId: tour.id,
      category: 'ACTIVITIES',
      label: 'Entrance and activity tickets',
      amount: money(variable * (multiDay ? 0.2 : 0.45)),
      basis: 'PER_PERSON',
      sortOrder: 3,
    },
  ];

  // Khách sạn chỉ tồn tại với tour qua đêm — thêm một dòng rỗng cho tour ngày
  // sẽ là một dòng `0.00` mà người đọc phải tự hiểu là "không áp dụng".
  if (multiDay) {
    rows.push({
      id: stableId(tour.id, 4),
      tourId: tour.id,
      category: 'ACCOMMODATION',
      label: `Hotel nights (${tour.durationDays - 1})`,
      amount: money(variable * 0.46),
      basis: 'PER_PERSON',
      sortOrder: 4,
    });
  }

  return rows;
}

export const tourCostItems: TourCostItemFixture[] = [
  ...northTours,
  ...centralTours,
  ...southTours,
].flatMap(itemsForTour);
