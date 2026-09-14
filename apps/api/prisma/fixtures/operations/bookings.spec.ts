import { policyRefundAmount, refundPercentForRequest } from '@tourism/contract';
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
  apDungYeuCauHuy,
  type BookingFixture,
  baoDamBookingDaDi,
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

describe.each(MOC)('huỷ và hoàn với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  const kq = sinhVanHanh(homNay, lich, khach);
  const bangTour = new Map(tours.map((t) => [t.id, t]));
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
    }
  });

  it('huỷ đã duyệt: đúng một yêu cầu REFUNDED, số hoàn theo chính sách, phủ đủ bốn bậc', () => {
    const huyDaTra = kq.bookings.filter((b) => b.status === 'CANCELLED' && b.paidAt !== null);
    const demBac = new Map<number, number>();
    for (const b of huyDaTra) {
      const yeuCau = kq.cancellationRequests.filter((c) => c.bookingId === b.id);
      expect(yeuCau, b.id).toHaveLength(1);
      const c = yeuCau[0];
      if (!c) continue;
      expect(c.status).toBe('REFUNDED');
      expect(c.decisionNote).toBeNull();
      expect(b.cancelledAt).toBe(c.decidedAt);
      expect(b.updatedAt).toBe(c.decidedAt);
      expect(ms(c.createdAt), c.id).toBeGreaterThan(ms(b.paidAt) + 24 * GIO_MS);
      expect(ms(c.decidedAt), c.id).toBeGreaterThan(ms(c.createdAt));
      expect(ms(c.decidedAt), c.id).toBeLessThan(Math.min(ngay(b.departureStartDate), H));
      expect(c.freeCancellationDays).toBe(bangTour.get(b.tourId)?.freeCancellationDays ?? null);
      const phanTram = refundPercentForRequest({
        requestedAt: new Date(ms(c.createdAt)),
        paidAt: b.paidAt,
        departureStartDate: b.departureStartDate,
        freeCancellationDays: c.freeCancellationDays,
      });
      const soTien = policyRefundAmount({
        percent: phanTram,
        totalAmount: b.totalAmount,
        refundedTotal: '0.00',
      });
      const hoan = kq.refunds.filter((r) => r.bookingId === b.id);
      if (Number(soTien) > 0) {
        expect(hoan, b.id).toHaveLength(1);
        expect(hoan[0]?.amount).toBe(soTien);
        expect(hoan[0]?.reason).toBeNull();
        expect(hoan[0]?.createdAt).toBe(c.decidedAt);
      } else {
        expect(hoan, b.id).toHaveLength(0);
      }
      demBac.set(phanTram, (demBac.get(phanTram) ?? 0) + 1);
    }
    for (const bac of [100, 50, 25, 0]) {
      expect(demBac.get(bac) ?? 0, `bậc ${bac}%`).toBeGreaterThanOrEqual(2);
    }
  });

  it('yêu cầu bị từ chối giữ booking PAID và có ghi chú; yêu cầu đang chờ nằm trong 25 ngày trước H', () => {
    const tuChoi = kq.cancellationRequests.filter((c) => c.status === 'DENIED');
    const dangCho = kq.cancellationRequests.filter((c) => c.status === 'REQUESTED');
    expect(tuChoi.length).toBeGreaterThanOrEqual(3);
    expect(dangCho.length).toBeGreaterThanOrEqual(5);
    for (const c of tuChoi) {
      const b = bangBooking.get(c.bookingId);
      if (!b) throw new Error(`yêu cầu ${c.id} trỏ booking không có thật`);
      expect(b.status).toBe('PAID');
      expect(c.decisionNote).toBeTruthy();
      expect(ms(c.createdAt), c.id).toBeGreaterThan(ms(b.paidAt));
      expect(ms(c.decidedAt), c.id).toBeGreaterThan(ms(c.createdAt));
      expect(ms(c.decidedAt), c.id).toBeLessThan(Math.min(H, ngay(b.departureStartDate)));
      const lechQuyet = ms(c.decidedAt) - ms(c.createdAt);
      expect(lechQuyet, c.id).toBeGreaterThanOrEqual(24 * GIO_MS);
      expect(lechQuyet, c.id).toBeLessThanOrEqual(72 * GIO_MS);
    }
    for (const c of dangCho) {
      const b = bangBooking.get(c.bookingId);
      if (!b) throw new Error(`yêu cầu ${c.id} trỏ booking không có thật`);
      expect(b.status).toBe('PAID');
      expect(c.decidedAt).toBeNull();
      expect(c.decisionNote).toBeNull();
      expect(ngay(b.departureStartDate)).toBeGreaterThan(H);
      expect(ms(c.createdAt), c.id).toBeGreaterThanOrEqual(H - 25 * NGAY_MS);
      expect(ms(c.createdAt), c.id).toBeLessThan(H);
      expect(c.updatedAt).toBe(c.createdAt);
    }
    const dangChoTheoBooking = dangCho.map((c) => c.bookingId);
    expect(new Set(dangChoTheoBooking).size).toBe(dangChoTheoBooking.length);
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

describe('apDungYeuCauHuy trên sổ một booking tổng hợp', () => {
  const homNay = docMocHomNay('2026-09-20');
  const H = Date.UTC(2026, 8, 20);
  const tuNhien = sinhVanHanh(homNay, sinhLich(homNay), sinhKhach(homNay));
  const nguongCua = new Map(tours.map((t) => [t.id, t.freeCancellationDays]));
  // Mẫu là booking PAID thật trên tour có ngưỡng huỷ miễn phí 2–30 ngày: bậc 100% gửi trước khởi
  // hành từ 2 tới 50 ngày, nên ở ca đối chứng mốc quyết không bao giờ chạm ngày khởi hành.
  const mau = (() => {
    const b = tuNhien.bookings.find((x) => {
      const nguong = nguongCua.get(x.tourId) ?? null;
      return x.status === 'PAID' && nguong !== null && nguong >= 2 && nguong <= 30;
    });
    if (!b) throw new Error('bộ sinh không có booking PAID trên tour ngưỡng 2–30 ngày');
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

  it('(a) ân hạn, (b) cửa sổ từ chối rỗng: khởi hành H − 5 ngày, trả tiền trước đó 23 giờ → không có yêu cầu nào', () => {
    // Vòng duyệt: mốc gửi của mọi bậc ≤ khởi hành − 1 ngày + 15 giờ, luôn ≤ paidAt + 25 giờ (tức
    // khởi hành + 2 giờ). Vòng từ chối: den = khởi hành − 4 ngày, tu = paidAt + 2 ngày, nên den < tu.
    // Vòng đang chờ: chuyến khởi hành trước H.
    const khoiHanh = H - 5 * NGAY_MS;
    const kq = soMotBooking('syn-c3-an-han', khoiHanh, khoiHanh - NGAY_MS + GIO_MS);
    apDungYeuCauHuy(kq, H);
    expect(kq.cancellationRequests).toEqual([]);
    expect(kq.refunds).toEqual([]);
    expect(kq.bookings[0]?.status).toBe('PAID');
  });

  it('(c) cửa sổ đang chờ rỗng: khởi hành H + 10 ngày, trả tiền H − 1 giờ → không có yêu cầu REQUESTED', () => {
    // Vòng đang chờ: tu = paidAt + 1 ngày = H + 23 giờ, den = H − 2 giờ. Hai vòng trước cũng bỏ qua:
    // mốc gửi hoặc ≤ paidAt + 25 giờ hoặc ≥ H; vòng từ chối có den = H − 4 ngày < tu = H + 47 giờ.
    const kq = soMotBooking('syn-c3-dang-cho', H + 10 * NGAY_MS, H - GIO_MS);
    apDungYeuCauHuy(kq, H);
    expect(kq.cancellationRequests).toEqual([]);
    expect(kq.bookings[0]?.status).toBe('PAID');
  });

  it('(d) đối chứng: khởi hành H − 10 ngày, trả tiền trước 120 ngày → đúng một yêu cầu REFUNDED, booking CANCELLED', () => {
    // Bậc 100%: gửi trước khởi hành [ngưỡng, ngưỡng + 20] ⊂ [2, 50] ngày — sau paidAt ≥ 70 ngày và
    // trước H; mốc quyết ≤ khởi hành − 3 giờ; số ngày lịch ≥ ngưỡng nên phần trăm đúng 100.
    const khoiHanh = H - 10 * NGAY_MS;
    const kq = soMotBooking('syn-c3-doi-chung', khoiHanh, khoiHanh - 120 * NGAY_MS);
    apDungYeuCauHuy(kq, H);
    expect(kq.cancellationRequests).toHaveLength(1);
    expect(kq.cancellationRequests[0]).toMatchObject({
      bookingId: 'syn-c3-doi-chung',
      status: 'REFUNDED',
    });
    expect(kq.bookings[0]?.status).toBe('CANCELLED');
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
