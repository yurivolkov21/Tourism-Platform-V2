import { describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { effectiveUnitPrice, totalAmount } from '../../../src/modules/bookings/pricing.js';
import { sinhLich } from '../catalog/departures-2026.js';
import { tours } from '../catalog/index.js';
import { DAU_KHUNG, docMocHomNay, NGAY_MS } from '../khung-thoi-gian.js';
import { sinhKhach } from '../people/customers.js';
import { sinhVanHanh } from './bookings.js';

const MOC = ['2026-09-20', '2026-11-03'] as const;
const ngay = (s: string): number => Date.parse(`${s}T00:00:00.000Z`);
const ms = (s: string | null): number => (s === null ? Number.NaN : Date.parse(s));

describe.each(MOC)('tầng vận hành với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  const kq = sinhVanHanh(homNay, lich, khach);
  const bangKhach = new Map(khach.map((k) => [k.id, k]));
  const bangChuyen = new Map(lich.map((d) => [d.id, d]));
  const bangTour = new Map(tours.map((t) => [t.id, t]));
  const daTra = kq.bookings.filter((b) => b.paidAt !== null);

  it('tất định: cùng H sinh hai lần ra y hệt', () => {
    expect(sinhVanHanh(homNay, lich, khach)).toEqual(kq);
  });

  it('không còn PENDING — chỉ PAID, REFUNDED, CANCELLED', () => {
    for (const b of kq.bookings) expect(['PAID', 'REFUNDED', 'CANCELLED']).toContain(b.status);
  });

  it('paid_at sau ngày khách đăng ký và ngày mở bán, trước khởi hành và trước H', () => {
    expect(daTra.length).toBeGreaterThan(300);
    for (const b of daTra) {
      const nguoi = bangKhach.get(b.userId);
      const chuyen = bangChuyen.get(b.departureId);
      if (!nguoi || !chuyen) throw new Error(`booking ${b.id} trỏ khách/chuyến không có thật`);
      const paid = ms(b.paidAt);
      expect(paid, b.id).toBeGreaterThanOrEqual(nguoi.createdAt.getTime() + NGAY_MS);
      expect(paid, b.id).toBeGreaterThanOrEqual(Date.parse(chuyen.createdAt));
      expect(paid, b.id).toBeLessThan(ngay(b.departureStartDate));
      expect(paid, b.id).toBeLessThan(H);
      expect(ms(b.createdAt), b.id).toBeLessThanOrEqual(paid);
      expect(ms(b.createdAt), b.id).toBeGreaterThanOrEqual(DAU_KHUNG);
    }
  });

  it('đơn giá, tổng tiền và snapshot khớp pricing.ts và chuyến', () => {
    for (const b of kq.bookings) {
      const tour = bangTour.get(b.tourId);
      const chuyen = bangChuyen.get(b.departureId);
      if (!tour || !chuyen) throw new Error(`booking ${b.id} trỏ tour/chuyến không có thật`);
      const donGia = effectiveUnitPrice(
        new Prisma.Decimal(tour.basePrice),
        chuyen.priceOverride === null ? null : new Prisma.Decimal(chuyen.priceOverride),
      );
      expect(b.unitPrice).toBe(donGia.toFixed(2));
      expect(b.totalAmount).toBe(totalAmount(donGia, b.numAdults + b.numChildren).toFixed(2));
      expect(b.departureStartDate).toBe(chuyen.startDate);
      expect(b.departureEndDate).toBe(chuyen.endDate);
      expect(b.tourTitle).toBe(tour.title);
    }
  });

  it('không khách nào có hai booking đã trả chồng ngày; không ai đặt hai lần một chuyến', () => {
    const theoKhach = new Map<string, typeof daTra>();
    for (const b of daTra) theoKhach.set(b.userId, [...(theoKhach.get(b.userId) ?? []), b]);
    for (const ds of theoKhach.values()) {
      for (let i = 0; i < ds.length; i++) {
        for (let j = i + 1; j < ds.length; j++) {
          const a = ds[i];
          const c = ds[j];
          if (!a || !c) continue;
          const chong =
            ngay(a.departureStartDate) <= ngay(c.departureEndDate) &&
            ngay(c.departureStartDate) <= ngay(a.departureEndDate);
          expect(chong, `${a.id} chồng ${c.id}`).toBe(false);
        }
      }
    }
    const cap = kq.bookings.map((b) => `${b.userId}:${b.departureId}`);
    expect(new Set(cap).size).toBe(cap.length);
  });

  it('ghế: tổng ghế booking PAID không vượt sức chứa và gheDaDat khớp', () => {
    const tong = new Map<string, number>();
    for (const b of kq.bookings.filter((x) => x.status === 'PAID')) {
      tong.set(b.departureId, (tong.get(b.departureId) ?? 0) + b.numAdults + b.numChildren);
    }
    expect(kq.gheDaDat).toEqual(tong);
    for (const [depId, ghe] of tong) {
      expect(ghe, depId).toBeLessThanOrEqual(bangChuyen.get(depId)?.seatsTotal ?? 0);
    }
  });

  it('chuyến công ty huỷ: REFUNDED, một refund bằng tổng tiền có lý do, không yêu cầu huỷ, không cancelled_at', () => {
    const trenChuyenHuy = daTra.filter(
      (b) => bangChuyen.get(b.departureId)?.status === 'CANCELLED',
    );
    expect(trenChuyenHuy.length).toBeGreaterThan(0);
    for (const b of trenChuyenHuy) {
      expect(b.status, b.id).toBe('REFUNDED');
      expect(b.cancelledAt, b.id).toBeNull();
      const hoan = kq.refunds.filter((r) => r.bookingId === b.id);
      expect(hoan, b.id).toHaveLength(1);
      expect(hoan[0]?.amount).toBe(b.totalAmount);
      expect(hoan[0]?.reason).toBeTruthy();
      const luc = ms(hoan[0]?.createdAt ?? null);
      expect(luc, b.id).toBeGreaterThan(ms(b.paidAt));
      expect(luc, b.id).toBeLessThan(ngay(b.departureStartDate));
      expect(b.updatedAt).toBe(hoan[0]?.createdAt);
      expect(kq.cancellationRequests.some((c) => c.bookingId === b.id)).toBe(false);
    }
    expect(kq.bookings.filter((b) => b.status === 'REFUNDED')).toHaveLength(trenChuyenHuy.length);
  });

  it('mỗi booking đã trả có đúng một sự kiện thu; mỗi refund có đúng một sự kiện hoàn cùng số tiền và mốc', () => {
    for (const b of daTra) {
      const thu = kq.paymentEvents.filter(
        (e) => e.bookingId === b.id && e.payload.kind === 'capture',
      );
      expect(thu, b.id).toHaveLength(1);
      expect(thu[0]?.processedAt).toBe(b.paidAt);
      expect(thu[0]?.amount).toBe(b.totalAmount);
    }
    for (const r of kq.refunds) {
      const hoan = kq.paymentEvents.filter(
        (e) => e.bookingId === r.bookingId && e.payload.kind === 'refund',
      );
      expect(hoan, r.id).toHaveLength(1);
      expect(hoan[0]?.amount).toBe(r.amount);
      expect(hoan[0]?.processedAt).toBe(r.createdAt);
    }
  });

  it('tổng hoàn của mỗi booking không vượt tổng tiền', () => {
    for (const b of kq.bookings) {
      const daHoan = kq.refunds
        .filter((r) => r.bookingId === b.id)
        .reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0);
      expect(daHoan, b.id).toBeLessThanOrEqual(Math.round(Number(b.totalAmount) * 100));
    }
  });

  it('tháng nào trước tháng của H cũng có booking; cửa sổ 7 và 28 ngày trước H có booking', () => {
    for (let thang = 0; thang < new Date(H).getUTCMonth(); thang++) {
      expect(
        daTra.some((b) => new Date(ms(b.paidAt)).getUTCMonth() === thang),
        `tháng ${thang + 1}`,
      ).toBe(true);
    }
    expect(daTra.some((b) => ms(b.paidAt) >= H - 7 * NGAY_MS)).toBe(true);
    expect(daTra.filter((b) => ms(b.paidAt) >= H - 28 * NGAY_MS).length).toBeGreaterThanOrEqual(10);
  });
});
