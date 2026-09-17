import { cancellationDeadline } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { CUOI_KHUNG, DAU_KHUNG, docMocHomNay, NGAY_MS } from '../khung-thoi-gian.js';
import { sinhLich } from './departures-2026.js';
import { tours } from './index.js';

const MOC = ['2026-09-20', '2026-11-03'] as const;
const ngay = (s: string): number => Date.parse(`${s}T00:00:00.000Z`);

describe.each(MOC)('lịch khởi hành với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const lich = sinhLich(homNay);
  const bangTour = new Map(tours.map((t) => [t.id, t]));
  const lichSu = lich.filter((d) => d.status !== 'OPEN');
  const conBan = lich.filter((d) => d.status === 'OPEN');

  it('id không trùng và cùng H sinh hai lần ra y hệt', () => {
    expect(new Set(lich.map((d) => d.id)).size).toBe(lich.length);
    expect(sinhLich(homNay)).toEqual(lich);
  });

  it('mỗi tour có ≥ 3 chuyến lịch sử và đúng 4 chuyến còn bán', () => {
    for (const tour of tours) {
      expect(lichSu.filter((d) => d.tourId === tour.id).length, tour.slug).toBeGreaterThanOrEqual(
        3,
      );
      expect(
        conBan.filter((d) => d.tourId === tour.id),
        tour.slug,
      ).toHaveLength(4);
    }
  });

  it('chuyến lịch sử khởi hành từ 08/01 và kết thúc trước H ít nhất 2 ngày', () => {
    for (const d of lichSu) {
      expect(ngay(d.startDate), d.id).toBeGreaterThanOrEqual(Date.UTC(2026, 0, 8));
      expect(ngay(d.endDate), d.id).toBeLessThanOrEqual(H - 2 * NGAY_MS);
    }
  });

  it('chuyến còn bán khởi hành từ H + 2 ngày và kết thúc muộn nhất 31/12/2026', () => {
    for (const d of conBan) {
      expect(ngay(d.startDate), d.id).toBeGreaterThanOrEqual(H + 2 * NGAY_MS);
      expect(ngay(d.endDate), d.id).toBeLessThanOrEqual(CUOI_KHUNG);
    }
  });

  it('ngày kết thúc khớp số ngày tour; sức chứa bằng maxGroupSize; ghế đặt để 0', () => {
    for (const d of lich) {
      const tour = bangTour.get(d.tourId);
      if (!tour) throw new Error(`chuyến ${d.id} trỏ tour không có thật`);
      expect(ngay(d.endDate) - ngay(d.startDate)).toBe((tour.durationDays - 1) * NGAY_MS);
      expect(d.seatsTotal).toBe(tour.maxGroupSize);
      expect(d.seatsBooked).toBe(0);
    }
  });

  it('có chuyến bị công ty huỷ trong lịch sử', () => {
    expect(lichSu.some((d) => d.status === 'CANCELLED')).toBe(true);
  });

  it('mỗi tháng của năm 2026 có ít nhất 10 chuyến', () => {
    for (let thang = 0; thang < 12; thang++) {
      const so = lich.filter((d) => new Date(ngay(d.startDate)).getUTCMonth() === thang).length;
      expect(so, `tháng ${thang + 1}`).toBeGreaterThanOrEqual(10);
    }
  });

  it('giảm giá: priceOverride < compareAtPrice = giá gốc; có chuyến giảm giá còn bán từ 15/11', () => {
    const coKM = lich.filter((d) => d.priceOverride !== null);
    expect(coKM.length).toBeGreaterThan(0);
    for (const d of coKM) {
      expect(Number(d.priceOverride)).toBeLessThan(Number(d.compareAtPrice));
      expect(Number(d.compareAtPrice)).toBe(Number(bangTour.get(d.tourId)?.basePrice));
    }
    for (const d of lich.filter((x) => x.priceOverride === null))
      expect(d.compareAtPrice).toBeNull();
    expect(
      conBan.some((d) => d.priceOverride !== null && ngay(d.startDate) >= Date.UTC(2026, 10, 15)),
    ).toBe(true);
  });

  it('mở bán trong [01/01/2026, H), trước ngày khởi hành; updatedAt = createdAt', () => {
    for (const d of lich) {
      const moBan = Date.parse(d.createdAt);
      expect(moBan, d.id).toBeGreaterThanOrEqual(DAU_KHUNG);
      expect(moBan, d.id).toBeLessThan(H);
      expect(moBan, d.id).toBeLessThan(ngay(d.startDate));
      expect(d.updatedAt).toBe(d.createdAt);
    }
  });

  it('mỗi tour ≥ 4 ngày có chuyến OPEN đã qua hạn chót mà chưa khởi hành tại H', () => {
    // H là nửa đêm UTC của ngày mốc, tức 07:00 cùng ngày ở Việt Nam, nên ngày Việt Nam
    // của H bằng đúng `isoNgay(H)` — so hạn chót bằng mốc ms là đủ, không cần đổi múi.
    const daiNgay = tours.filter((t) => t.durationDays >= 4);
    expect(daiNgay).toHaveLength(6);
    for (const tour of daiNgay) {
      const quaHan = conBan.filter(
        (d) =>
          d.tourId === tour.id &&
          ngay(d.startDate) > H &&
          ngay(cancellationDeadline(d.startDate, d.endDate)) < H,
      );
      expect(quaHan.length, tour.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it('không hai chuyến nào của cùng một tour rơi vào cùng một ngày', () => {
    const cap = lich.map((d) => `${d.tourId}:${d.startDate}`);
    expect(new Set(cap).size).toBe(cap.length);
  });
});
