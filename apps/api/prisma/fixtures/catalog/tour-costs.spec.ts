import { describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import {
  derivedCostPrice,
  perDepartureTotal,
  perPersonTotal,
} from '../../../src/modules/catalog/tour-costs.js';
import { tours } from './index.js';
import { stableId, tourCostItems } from './tour-costs.js';

/**
 * Giá vốn seed cho 30 tour — sinh từ một mô hình, nên phải có chỗ CHỨNG MINH
 * mô hình ấy cho ra số hợp lý.
 *
 * Đây là lý do fixture dùng mô hình thay vì 130 con số gõ tay: một mô hình
 * kiểm được bằng một bộ test, còn 130 con số rời thì không ai đối chiếu nổi
 * khi biên gộp của một tour trông lạ.
 *
 * ⚠️ Bộ này canh DẢI, không canh từng con số. Chốt cứng "tour #7 có giá vốn
 * 41.58" sẽ đỏ mỗi lần ai đó chỉnh một tỉ lệ — mà chỉnh tỉ lệ đúng là việc
 * người ta được phép làm với một mô hình. Thứ KHÔNG được phép trôi là dải
 * biên gộp.
 *
 * Dải khoá dưới đây RỘNG hơn đích ngành một chút ở hai đầu (38–50% và 24–36%
 * thay vì 40–50% và 25–35%), và đó là cố ý: biên của từng tour phụ thuộc giá
 * bán so với chi phí cố định theo ngày, nên tour rẻ nhất tự nhiên mỏng hơn —
 * ép mọi tour vào một dải hẹp sẽ làm mô hình KÉM thật hơn. Bảng phân bố đo
 * được nằm ở JSDoc của `tour-costs.ts`.
 */
const decimalItems = (tourId: string) =>
  tourCostItems
    .filter((item) => item.tourId === tourId)
    .map((item) => ({ amount: new Prisma.Decimal(item.amount), basis: item.basis }));

describe('fixture giá vốn', () => {
  it('phủ ĐỦ mọi tour trong catalogue, không sót cái nào', () => {
    const covered = new Set(tourCostItems.map((item) => item.tourId));

    // 29 chứ không phải 30: Bắc 12 + Trung 9 + Nam 8. Roster spec cấp cho
    // miền Nam dải #22–30 (9 tour) nhưng `tours-south.ts` chỉ có 8 — một lỗ
    // dữ liệu CÓ TỪ TRƯỚC đợt này, phát hiện lúc viết test ở đây. Khoá con số
    // thật để nếu tour thứ 30 được thêm vào thì test đỏ và ai đó nhớ rà lại.
    expect(tours).toHaveLength(29);
    expect(covered.size).toBe(29);
  });

  it('id tĩnh: hợp lệ UUID, không trùng, và không đổi giữa hai lần dựng', () => {
    // Seed chạy lại được nhờ `createMany({ skipDuplicates })` đụng đúng PK
    // cũ. Bảng không có `@@unique` nào khác, nên id trôi giữa hai lượt seed
    // là mỗi lượt nhân đôi 130 dòng trên DB dùng chung (vòng vá review 05/09).
    const ids = tourCostItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    // Cùng tour + cùng sortOrder phải cho cùng id — đó là toàn bộ ý nghĩa của
    // "tĩnh"; đổi một trong hai là id khác.
    expect(stableId('tour-a', 0)).toBe(stableId('tour-a', 0));
    expect(stableId('tour-a', 0)).not.toBe(stableId('tour-a', 1));
    expect(stableId('tour-a', 0)).not.toBe(stableId('tour-b', 0));
  });

  it('mỗi tour có ít nhất một dòng theo khách VÀ một dòng theo chuyến', () => {
    // Thiếu vế nào cũng làm mô hình mất nghĩa: không có dòng theo chuyến thì
    // `cogsFixed` của báo cáo luôn 0 và luật huỷ (§4) không có gì để chứng
    // minh; không có dòng theo khách thì `cogsVariable` luôn 0.
    for (const tour of tours) {
      const items = decimalItems(tour.id);
      expect(perPersonTotal(items).gt(0)).toBe(true);
      expect(perDepartureTotal(items).gt(0)).toBe(true);
    }
  });

  it('tour NGÀY rơi vào dải biên gộp 38–50%', () => {
    const dayTours = tours.filter((tour) => tour.durationDays === 1);
    expect(dayTours.length).toBeGreaterThan(0);

    for (const tour of dayTours) {
      const cost = derivedCostPrice(decimalItems(tour.id), tour.maxGroupSize);
      const margin = 1 - cost.toNumber() / Number(tour.basePrice);
      expect(margin, `${tour.slug} biên ${(margin * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(
        0.38,
      );
      expect(margin, `${tour.slug} biên ${(margin * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.5);
    }
  });

  it('tour NHIỀU NGÀY rơi vào dải 24–36% — khách sạn ăn mất phần biên', () => {
    const multiDay = tours.filter((tour) => tour.durationDays > 1);
    expect(multiDay.length).toBeGreaterThan(0);

    for (const tour of multiDay) {
      const cost = derivedCostPrice(decimalItems(tour.id), tour.maxGroupSize);
      const margin = 1 - cost.toNumber() / Number(tour.basePrice);
      expect(margin, `${tour.slug} biên ${(margin * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(
        0.24,
      );
      expect(margin, `${tour.slug} biên ${(margin * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.36);
    }
  });

  it('chỉ tour qua đêm mới có dòng khách sạn', () => {
    for (const tour of tours) {
      const hasHotel = tourCostItems.some(
        (item) => item.tourId === tour.id && item.category === 'ACCOMMODATION',
      );
      expect(hasHotel, tour.slug).toBe(tour.durationDays > 1);
    }
  });

  it('không dòng nào âm — CHECK của DB sẽ từ chối, nhưng đỏ ở đây rẻ hơn', () => {
    for (const item of tourCostItems) {
      expect(Number(item.amount), `${item.tourId} ${item.label}`).toBeGreaterThanOrEqual(0);
    }
  });
});
