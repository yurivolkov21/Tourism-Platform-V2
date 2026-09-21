import {
  cancellationDeadline,
  isWithinDeadline,
  PAYMENT_EVENT_TYPES,
  refundOnCancel,
} from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { effectiveUnitPrice, totalAmount } from '../../../src/modules/bookings/pricing.js';
import { sinhLich } from '../catalog/departures-2026.js';
import { tours } from '../catalog/index.js';
import type { TourDepartureFixture } from '../catalog/types.js';
import {
  DAU_KHUNG,
  docMocHomNay,
  GIO_MS,
  isoGio,
  isoNgay,
  NGAY_MS,
  PHUT_MS,
} from '../khung-thoi-gian.js';
import { sinhKhach } from '../people/customers.js';
import {
  apDungKhachTuHuy,
  type BookingFixture,
  baoDamBookingDaDi,
  baoDamBookingQuaHan,
  type DuLieuVanHanh,
  sinhVanHanh,
  themGioBoDo,
} from './bookings.js';

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
      // Đường admin phát hành: seed ghi `admin_id` = admin, khác hẳn dòng hoàn khi khách tự huỷ.
      expect(hoan[0]?.issuedByAdmin, b.id).toBe(true);
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

  it('ADR-0043: sự kiện seed dùng đúng từ vựng type của app thật, và dòng hoàn khớp id cổng', () => {
    // Trước ADR-0043 seed ghi type THÔ của provider ("checkout.session.completed",
    // "charge.refunded") trong khi `beginEvent` ghi type TRUNG LẬP — nên dữ liệu
    // demo nằm ngoài bộ lọc type của admin và bất biến nghiệm thu không thể đúng
    // với dữ liệu thật. Đây là chốt chặn để nó không trôi lại.
    for (const e of kq.paymentEvents) {
      expect(PAYMENT_EVENT_TYPES, e.id).toContain(e.type);
    }
    for (const b of daTra) {
      const thu = kq.paymentEvents.filter(
        (e) => e.bookingId === b.id && e.payload.kind === 'capture',
      );
      expect(thu[0]?.type, b.id).toBe('payment.completed');
    }
    for (const r of kq.refunds) {
      const hoan = kq.paymentEvents.find(
        (e) => e.bookingId === r.bookingId && e.payload.kind === 'refund',
      );
      expect(hoan?.type, r.id).toBe('payment.refunded');
      // `eventId` mang id refund của CỔNG, y như app thật ghi.
      expect(hoan?.eventId, r.id).toBe(r.providerRefundId);
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

describe.each(MOC)('huỷ và hoàn với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  const kq = sinhVanHanh(homNay, lich, khach);
  const bangBooking = new Map(kq.bookings.map((b) => [b.id, b]));

  it('giỏ bỏ dở: CANCELLED, chưa trả, huỷ sau khi tạo 65–80 phút, không sự kiện, không refund', () => {
    const gio = kq.bookings.filter((b) => b.paidAt === null);
    expect(gio.length).toBeGreaterThanOrEqual(12);
    for (const b of gio) {
      expect(b.status, b.id).toBe('CANCELLED');
      expect(b.providerPaymentId, b.id).toBeNull();
      const lech = ms(b.cancelledAt) - ms(b.createdAt);
      expect(lech, b.id).toBeGreaterThanOrEqual(65 * PHUT_MS);
      expect(lech, b.id).toBeLessThanOrEqual(80 * PHUT_MS);
      expect(ms(b.cancelledAt), b.id).toBeLessThan(H);
      expect(ms(b.createdAt), b.id).toBeLessThan(ngay(b.departureStartDate) - NGAY_MS);
      expect(b.updatedAt).toBe(b.cancelledAt);
      expect(kq.paymentEvents.some((e) => e.bookingId === b.id)).toBe(false);
      expect(kq.refunds.some((r) => r.bookingId === b.id)).toBe(false);
      expect(kq.cancellationRequests.some((c) => c.bookingId === b.id)).toBe(false);
      // Giỏ bỏ dở là một lượt checkout THẬT, nên nó cũng phải nằm trong hạn đặt chỗ.
      expect(
        isWithinDeadline(new Date(b.createdAt), b.departureStartDate, b.departureEndDate),
        b.id,
      ).toBe(true);
    }
  });

  it('khách tự huỷ: yêu cầu REFUNDED do chính khách, mốc gửi = mốc quyết, hoàn đúng luật', () => {
    const huyDaTra = kq.bookings.filter((b) => b.status === 'CANCELLED' && b.paidAt !== null);
    let trongHan = 0;
    let quaHan = 0;
    for (const b of huyDaTra) {
      const yeuCau = kq.cancellationRequests.filter((c) => c.bookingId === b.id);
      expect(yeuCau, b.id).toHaveLength(1);
      const c = yeuCau[0];
      if (!c) continue;
      expect(c.status).toBe('REFUNDED');
      expect(c.userId).toBe(b.userId);
      // Lõi huỷ Task 6 ghi yêu cầu và dòng hoàn bằng CÙNG một `now()`; báo cáo (Hợp đồng D)
      // xếp loại trong/quá hạn bằng `createdAt` còn tiền tính tại mốc huỷ — hai mốc lệch
      // nhau là hai câu trả lời cho cùng một lần huỷ.
      expect(c.createdAt).toBe(c.decidedAt);
      expect(c.updatedAt).toBe(c.decidedAt);
      expect(b.cancelledAt).toBe(c.decidedAt);
      expect(b.updatedAt).toBe(c.decidedAt);
      expect(ms(c.createdAt), c.id).toBeGreaterThan(ms(b.paidAt));
      expect(ms(c.createdAt), c.id).toBeLessThan(Math.min(ngay(b.departureStartDate), H));
      const canHoan = refundOnCancel({
        now: new Date(c.createdAt),
        startDate: b.departureStartDate,
        endDate: b.departureEndDate,
        totalAmount: b.totalAmount,
        refundedTotal: '0.00',
      });
      const hoan = kq.refunds.filter((r) => r.bookingId === b.id);
      if (Number(canHoan) > 0) {
        trongHan++;
        expect(canHoan, b.id).toBe(b.totalAmount);
        expect(hoan, b.id).toHaveLength(1);
        expect(hoan[0]?.amount, b.id).toBe(canHoan);
        expect(hoan[0]?.reason, b.id).toBeNull();
        expect(hoan[0]?.issuedByAdmin, b.id).toBe(false);
        expect(hoan[0]?.createdAt, b.id).toBe(c.decidedAt);
        expect(
          kq.paymentEvents.filter((e) => e.bookingId === b.id && e.payload.kind === 'refund'),
          b.id,
        ).toHaveLength(1);
      } else {
        quaHan++;
        expect(hoan, b.id).toHaveLength(0);
        expect(
          kq.paymentEvents.some((e) => e.bookingId === b.id && e.payload.kind === 'refund'),
          b.id,
        ).toBe(false);
      }
    }
    expect(trongHan).toBeGreaterThanOrEqual(5);
    expect(quaHan).toBeGreaterThanOrEqual(3);
  });

  it('không còn yêu cầu DENIED hay REQUESTED; ca quá hạn nằm sau ngày chót và trước ngày đi', () => {
    for (const c of kq.cancellationRequests) expect(c.status, c.id).toBe('REFUNDED');
    const quaHan = kq.cancellationRequests.filter((c) => {
      const b = bangBooking.get(c.bookingId);
      if (!b) throw new Error(`yêu cầu ${c.id} trỏ booking không có thật`);
      return !isWithinDeadline(new Date(c.createdAt), b.departureStartDate, b.departureEndDate);
    });
    expect(quaHan.length).toBeGreaterThanOrEqual(3);
    for (const c of quaHan) {
      const b = bangBooking.get(c.bookingId);
      if (!b) continue;
      const chot = ngay(cancellationDeadline(b.departureStartDate, b.departureEndDate));
      expect(ms(c.createdAt), c.id).toBeGreaterThan(chot);
      // Huỷ online chỉ được TRƯỚC ngày khởi hành (`canCancelOnline`).
      expect(ms(c.createdAt), c.id).toBeLessThan(ngay(b.departureStartDate));
      // Tour 1 ngày có D = ngày đi − 1 nên khoảng (D, ngày đi) rỗng: ca quá hạn chỉ rơi
      // vào tour ≥ 2 ngày. Đây là hệ quả của luật, không phải thiếu sót của bộ sinh.
      expect(ngay(b.departureEndDate), c.id).toBeGreaterThan(ngay(b.departureStartDate));
    }
  });

  it('booking REFUNDED không có yêu cầu huỷ; mọi yêu cầu trỏ booking có thật; mã booking không trùng', () => {
    for (const b of kq.bookings.filter((x) => x.status === 'REFUNDED')) {
      expect(
        kq.cancellationRequests.some((c) => c.bookingId === b.id),
        b.id,
      ).toBe(false);
    }
    for (const c of kq.cancellationRequests) expect(bangBooking.has(c.bookingId), c.id).toBe(true);
    const ma = kq.bookings.map((b) => b.code);
    expect(new Set(ma).size).toBe(ma.length);
    for (const m of ma) expect(m).toMatch(/^BK-[A-Z0-9]{8}$/);
  });
});

describe.each(['2026-06-01', '2026-09-20'] as const)('bù booking đã đi với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  const bangKhach = new Map(khach.map((k) => [k.id, k]));
  const bangChuyen = new Map(lich.map((d) => [d.id, d]));
  /** Booking đã đi: PAID trên chuyến CLOSED kết thúc trước H ít nhất 3 ngày. */
  const daDi = (b: BookingFixture): boolean =>
    b.status === 'PAID' &&
    bangChuyen.get(b.departureId)?.status === 'CLOSED' &&
    ngay(b.departureEndDate) <= H - 3 * NGAY_MS;

  /** Luật đặt chỗ trên cả sổ: khoảng paid_at, không chồng lịch, không trùng chuyến, không vượt ghế. */
  function kiemLuatDatCho(bookings: BookingFixture[]): void {
    const theoKhach = new Map<string, BookingFixture[]>();
    for (const b of bookings) {
      if (b.paidAt === null) continue;
      const nguoi = bangKhach.get(b.userId);
      const chuyen = bangChuyen.get(b.departureId);
      if (!nguoi || !chuyen) throw new Error(`booking ${b.id} trỏ khách/chuyến không có thật`);
      const paid = ms(b.paidAt);
      expect(paid, b.id).toBeGreaterThanOrEqual(nguoi.createdAt.getTime() + NGAY_MS);
      expect(paid, b.id).toBeGreaterThanOrEqual(Date.parse(chuyen.createdAt));
      expect(paid, b.id).toBeLessThan(ngay(b.departureStartDate));
      expect(paid, b.id).toBeLessThan(H);
      theoKhach.set(b.userId, [...(theoKhach.get(b.userId) ?? []), b]);
    }
    for (const ds of theoKhach.values()) {
      for (const [i, a] of ds.entries()) {
        for (const c of ds.slice(i + 1)) {
          const chong =
            ngay(a.departureStartDate) <= ngay(c.departureEndDate) &&
            ngay(c.departureStartDate) <= ngay(a.departureEndDate);
          expect(chong, `${a.id} chồng ${c.id}`).toBe(false);
        }
      }
    }
    const cap = bookings.map((b) => `${b.userId}:${b.departureId}`);
    expect(new Set(cap).size).toBe(cap.length);
    const ghe = new Map<string, number>();
    for (const b of bookings) {
      if (b.status !== 'PAID') continue;
      ghe.set(b.departureId, (ghe.get(b.departureId) ?? 0) + b.numAdults + b.numChildren);
    }
    for (const [depId, soGhe] of ghe) {
      expect(soGhe, depId).toBeLessThanOrEqual(bangChuyen.get(depId)?.seatsTotal ?? 0);
    }
  }

  it('sổ trống: mỗi tour vừa đủ 3 booking đã đi, mỗi booking một sự kiện thu, chạy lại không thêm gì', () => {
    const kq: DuLieuVanHanh = {
      bookings: [],
      paymentEvents: [],
      refunds: [],
      cancellationRequests: [],
    };
    baoDamBookingDaDi(kq, H, lich, khach);
    for (const tour of tours) {
      const cua = kq.bookings.filter((b) => b.tourId === tour.id);
      expect(cua, tour.slug).toHaveLength(3);
      for (const b of cua) expect(daDi(b), b.id).toBe(true);
    }
    expect(kq.paymentEvents).toHaveLength(kq.bookings.length);
    expect(kq.refunds).toEqual([]);
    kiemLuatDatCho(kq.bookings);
    baoDamBookingDaDi(kq, H, lich, khach);
    expect(kq.bookings).toHaveLength(3 * tours.length);
  });

  it('sổ đã có booking: bù lại đúng phần bị lấy mất mà không đụng lịch kín sẵn có', () => {
    const tuNhien = sinhVanHanh(homNay, lich, khach);
    const kq: DuLieuVanHanh = {
      bookings: tuNhien.bookings.filter((b) => !daDi(b)),
      paymentEvents: [...tuNhien.paymentEvents],
      refunds: [...tuNhien.refunds],
      cancellationRequests: [...tuNhien.cancellationRequests],
    };
    const truoc = kq.bookings.length;
    baoDamBookingDaDi(kq, H, lich, khach);
    expect(kq.bookings).toHaveLength(truoc + 3 * tours.length);
    for (const tour of tours) {
      const cua = kq.bookings.filter((b) => b.tourId === tour.id && daDi(b));
      expect(cua, tour.slug).toHaveLength(3);
    }
    kiemLuatDatCho(kq.bookings);
  });

  it('hụt sàn thì ném lỗi, không âm thầm để tour thiếu booking đã đi', () => {
    const kq: DuLieuVanHanh = {
      bookings: [],
      paymentEvents: [],
      refunds: [],
      cancellationRequests: [],
    };
    // Không có khách nào để bốc: mọi lượt bù đều bỏ lượt.
    expect(() => baoDamBookingDaDi(kq, H, lich, [])).toThrow(/sàn booking đã đi/);
  });
});

describe('apDungKhachTuHuy trên sổ một booking tổng hợp', () => {
  const homNay = docMocHomNay('2026-09-20');
  const H = Date.UTC(2026, 8, 20);
  const tuNhien = sinhVanHanh(homNay, sinhLich(homNay), sinhKhach(homNay));
  // Mẫu là booking PAID trên tour 5 ngày: N = 7, đủ rộng để dựng được CẢ ca trong hạn lẫn
  // ca quá hạn chỉ bằng cách dời ngày khởi hành.
  const mau = (() => {
    const dai = new Map(tours.map((t) => [t.id, t.durationDays]));
    const b = tuNhien.bookings.find((x) => x.status === 'PAID' && (dai.get(x.tourId) ?? 0) === 5);
    if (!b) throw new Error('bộ sinh không có booking PAID trên tour 5 ngày');
    return b;
  })();
  const soNgayDi = ngay(mau.departureEndDate) - ngay(mau.departureStartDate);

  /** Sổ chỉ chứa đúng một booking PAID, clone từ `mau` rồi đổi id, ngày khởi hành và mốc trả tiền. */
  const soMotBooking = (id: string, khoiHanh: number, traLuc: number): DuLieuVanHanh => ({
    bookings: [
      {
        ...mau,
        id,
        status: 'PAID',
        cancelledAt: null,
        departureStartDate: isoNgay(khoiHanh),
        departureEndDate: isoNgay(khoiHanh + soNgayDi),
        paidAt: isoGio(traLuc),
      },
    ],
    paymentEvents: [],
    refunds: [],
    cancellationRequests: [],
  });

  it('(a) trong hạn: khởi hành H + 30 ngày, trả tiền trước 60 ngày → hoàn đủ, admin_id để trống', () => {
    const khoiHanh = H + 30 * NGAY_MS;
    const kq = soMotBooking('syn-huy-trong-han', khoiHanh, khoiHanh - 60 * NGAY_MS);
    apDungKhachTuHuy(kq, H);
    expect(kq.cancellationRequests).toHaveLength(1);
    const c = kq.cancellationRequests[0];
    expect(c?.status).toBe('REFUNDED');
    expect(c?.createdAt).toBe(c?.decidedAt);
    expect(kq.bookings[0]?.status).toBe('CANCELLED');
    expect(kq.refunds).toHaveLength(1);
    expect(kq.refunds[0]?.amount).toBe(mau.totalAmount);
    expect(kq.refunds[0]?.issuedByAdmin).toBe(false);
    expect(kq.paymentEvents).toHaveLength(1);
  });

  it('(b) quá hạn: trả tiền ĐÚNG ngày chót, khởi hành H + 3 ngày → REFUNDED mà không dòng hoàn nào', () => {
    // D = khởi hành − 7 = H − 4. Trả tiền đúng ngày D nên cửa sổ TRONG HẠN rỗng (mốc huỷ
    // sớm nhất là D + 1 ngày, đã quá hạn) và chỉ còn nhánh quá hạn: [D + 1, H − 1].
    const khoiHanh = H + 3 * NGAY_MS;
    const kq = soMotBooking('syn-huy-qua-han', khoiHanh, khoiHanh - 7 * NGAY_MS + 5 * GIO_MS);
    apDungKhachTuHuy(kq, H);
    expect(kq.cancellationRequests).toHaveLength(1);
    expect(kq.cancellationRequests[0]?.status).toBe('REFUNDED');
    expect(kq.bookings[0]?.status).toBe('CANCELLED');
    expect(kq.refunds).toEqual([]);
    expect(kq.paymentEvents).toEqual([]);
  });

  it('(c) cửa sổ rỗng: trả tiền hôm qua cho chuyến khởi hành đúng ngày H → không huỷ ai', () => {
    // Mốc huỷ sớm nhất của cả hai nhánh là ngày sau ngày trả tiền, tức chính H; mà mọi mốc
    // giao dịch phải < H và mọi lần huỷ phải trước ngày khởi hành (`canCancelOnline`). Mốc
    // trả tiền ở đây cố tình nằm ngoài trần "≤ ngày chót" của `datMotBooking`: sổ tổng hợp
    // chỉ kiểm nhánh của `apDungKhachTuHuy`, không kiểm luật đặt chỗ.
    const kq = soMotBooking('syn-huy-rong', H, H - NGAY_MS + 5 * GIO_MS);
    apDungKhachTuHuy(kq, H);
    expect(kq.cancellationRequests).toEqual([]);
    expect(kq.refunds).toEqual([]);
    expect(kq.bookings[0]?.status).toBe('PAID');
  });
});

describe.each(MOC)('sàn booking quá hạn với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  /** Chuyến còn bán đã qua hạn chót tại H mà chưa khởi hành. */
  const quaHan = lich.filter(
    (d) =>
      d.status === 'OPEN' &&
      ngay(d.startDate) > H &&
      ngay(cancellationDeadline(d.startDate, d.endDate)) < H,
  );
  const soTrong = (kq: DuLieuVanHanh): number => {
    const hopLe = new Set(quaHan.map((d) => d.id));
    return kq.bookings.filter((b) => b.status === 'PAID' && hopLe.has(b.departureId)).length;
  };

  it('sổ trống: bù vừa đủ sàn, chạy lại không thêm gì', () => {
    const kq: DuLieuVanHanh = {
      bookings: [],
      paymentEvents: [],
      refunds: [],
      cancellationRequests: [],
    };
    baoDamBookingQuaHan(kq, H, lich, khach);
    expect(soTrong(kq)).toBeGreaterThanOrEqual(3);
    const soDong = kq.bookings.length;
    baoDamBookingQuaHan(kq, H, lich, khach);
    expect(kq.bookings).toHaveLength(soDong);
  });

  it('hụt sàn thì ném lỗi, không âm thầm để seed thiếu ca demo huỷ quá hạn', () => {
    const kq: DuLieuVanHanh = {
      bookings: [],
      paymentEvents: [],
      refunds: [],
      cancellationRequests: [],
    };
    expect(() => baoDamBookingQuaHan(kq, H, lich, [])).toThrow(/sàn booking quá hạn/);
  });
});

describe('themGioBoDo trên lịch một chuyến tổng hợp', () => {
  const homNay = docMocHomNay('2026-09-20');
  const H = homNay.getTime();
  const mauChuyen = (() => {
    const d = sinhLich(homNay)[0];
    if (!d) throw new Error('bộ sinh không ra chuyến nào');
    return d;
  })();
  // Khách thật đăng ký sớm nhất (đợt ra mắt đầu tháng 1): đầu cửa sổ tạo giỏ luôn là lúc chuyến mở bán.
  const khachSom = [...sinhKhach(homNay)]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 1);
  const soNgayDi = ngay(mauChuyen.endDate) - ngay(mauChuyen.startDate);
  const soRong = (): DuLieuVanHanh => ({
    bookings: [],
    paymentEvents: [],
    refunds: [],
    cancellationRequests: [],
  });
  /** Clone chuyến thật, đổi id, trạng thái, ngày khởi hành và lúc mở bán. */
  const chuyenTongHop = (
    id: string,
    status: TourDepartureFixture['status'],
    khoiHanh: number,
    moBan: number,
  ): TourDepartureFixture => ({
    ...mauChuyen,
    id,
    status,
    startDate: isoNgay(khoiHanh),
    endDate: isoNgay(khoiHanh + soNgayDi),
    createdAt: isoGio(moBan),
  });

  it('(a) trùng cặp: một khách, một chuyến OPEN → đúng một giỏ bỏ dở, mọi lượt sau lượt đầu bỏ qua vì cặp đã có', () => {
    const kq = soRong();
    const chuyen = chuyenTongHop(
      'syn-c4-trung-cap',
      'OPEN',
      H + 40 * NGAY_MS,
      Date.UTC(2026, 2, 1),
    );
    themGioBoDo(kq, H, [chuyen], khachSom);
    expect(kq.bookings).toHaveLength(1);
    const cap = kq.bookings.map((b) => `${b.userId}:${b.departureId}`);
    expect(new Set(cap).size).toBe(cap.length);
  });

  // Chuyến khởi hành H − 40 ngày, mở bán 10 ngày trước đó: cửa sổ tạo giỏ là [mở bán, khởi hành − đệm].
  const khoiHanhCu = H - 40 * NGAY_MS;

  it('(b) chuyến công ty huỷ: đệm 15 ngày làm cửa sổ rỗng → 0 giỏ bỏ dở', () => {
    const kq = soRong();
    const chuyen = chuyenTongHop(
      'syn-c4-chuyen-cu',
      'CANCELLED',
      khoiHanhCu,
      khoiHanhCu - 10 * NGAY_MS,
    );
    themGioBoDo(kq, H, [chuyen], khachSom);
    expect(kq.bookings).toEqual([]);
  });

  it('(c) đối chứng của (b): cùng chuyến nhưng CLOSED, đệm chỉ 2 ngày → có giỏ bỏ dở', () => {
    const kq = soRong();
    const chuyen = chuyenTongHop(
      'syn-c4-chuyen-cu',
      'CLOSED',
      khoiHanhCu,
      khoiHanhCu - 10 * NGAY_MS,
    );
    themGioBoDo(kq, H, [chuyen], khachSom);
    expect(kq.bookings.length).toBeGreaterThanOrEqual(1);
  });
});
