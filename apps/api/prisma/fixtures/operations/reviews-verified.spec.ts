import { describe, expect, it } from 'vitest';
import { sinhLich } from '../catalog/departures-2026.js';
import { tours } from '../catalog/index.js';
import { docMocHomNay } from '../khung-thoi-gian.js';
import { sinhKhach } from '../people/customers.js';
import { sinhVanHanh } from './bookings.js';
import { sinhReview } from './reviews-verified.js';

/** Hai mốc cố định cho các bất biến tổng: sàn mỗi tour, hàng đợi admin, phân bố sao. */
const MOC = ['2026-09-20', '2026-11-03'] as const;
/**
 * Bất biến TỪNG DÒNG chạy thêm mốc sớm 2026-06-01: ở đó bước 3 của `sinhReview` (duyệt lại
 * review chưa duyệt cho đủ sàn) mới thực sự chạy, còn hai mốc cố định có thể không chạm tới.
 */
const MOC_TUNG_DONG = ['2026-06-01', ...MOC] as const;
const ms = (s: string | null): number => (s === null ? Number.NaN : Date.parse(s));

/** Dựng dữ liệu review cho một mốc H — dùng chung cho hai khối test. */
function chuanBi(giaTri: string) {
  const homNay = docMocHomNay(giaTri);
  const lich = sinhLich(homNay);
  const vanHanh = sinhVanHanh(homNay, lich, sinhKhach(homNay));
  const ket = sinhReview(homNay, lich, vanHanh.bookings);
  return {
    homNay,
    H: homNay.getTime(),
    lich,
    vanHanh,
    ket,
    bangBooking: new Map(vanHanh.bookings.map((b) => [b.id, b])),
    bangChuyen: new Map(lich.map((d) => [d.id, d])),
  };
}

describe.each(MOC_TUNG_DONG)('review từng dòng với H = %s', (giaTri) => {
  const { homNay, H, lich, vanHanh, ket, bangBooking, bangChuyen } = chuanBi(giaTri);
  const { reviews, moderationEvents } = ket;

  it('tất định: cùng H sinh hai lần ra y hệt', () => {
    expect(sinhReview(homNay, lich, vanHanh.bookings)).toEqual(ket);
  });

  it('người review là người đã đi: khớp booking PAID trên chuyến CLOSED; một review một booking', () => {
    const daDung = new Set<string>();
    for (const r of reviews) {
      const b = bangBooking.get(r.bookingId);
      if (!b) throw new Error(`review ${r.id} trỏ booking không có thật`);
      expect(b.status, r.id).toBe('PAID');
      expect(bangChuyen.get(b.departureId)?.status, r.id).toBe('CLOSED');
      expect(r.userId).toBe(b.userId);
      expect(r.tourId).toBe(b.tourId);
      expect(r.authorName).toBe(b.contactName);
      expect(daDung.has(r.bookingId), r.id).toBe(false);
      daDung.add(r.bookingId);
    }
  });

  it('viết sau khi chuyến kết thúc và trước H; duyệt, bác, rút đều sau lúc viết và trước H', () => {
    for (const r of reviews) {
      const b = bangBooking.get(r.bookingId);
      if (!b) throw new Error(`review ${r.id} trỏ booking không có thật`);
      const viet = ms(r.createdAt);
      expect(viet, r.id).toBeGreaterThan(Date.parse(`${b.departureEndDate}T00:00:00.000Z`));
      expect(viet, r.id).toBeLessThan(H);
      for (const moc of [r.moderatedAt, r.rejectedAt, r.retractedAt]) {
        if (moc === null) continue;
        expect(ms(moc), r.id).toBeGreaterThan(viet);
        expect(ms(moc), r.id).toBeLessThan(H);
      }
      expect(r.updatedAt, r.id).toBe(r.retractedAt ?? r.moderatedAt ?? r.createdAt);
    }
  });

  it('khớp CHECK của DB: không vừa đăng vừa bị bác, không vừa đăng vừa bị rút', () => {
    for (const r of reviews) {
      expect(r.isApproved && r.rejectedAt !== null, r.id).toBe(false);
      expect(r.isApproved && r.retractedAt !== null, r.id).toBe(false);
      if (r.rejectedAt !== null) expect(r.rejectedAt).toBe(r.moderatedAt);
    }
  });

  it('mỗi review đã có phán quyết có đúng một sự kiện duyệt cùng mốc', () => {
    const coPhanQuyet = reviews.filter((r) => r.moderatedAt !== null);
    expect(moderationEvents).toHaveLength(coPhanQuyet.length);
    for (const r of coPhanQuyet) {
      const suKien = moderationEvents.filter((e) => e.reviewId === r.id);
      expect(suKien, r.id).toHaveLength(1);
      expect(suKien[0]?.createdAt).toBe(r.moderatedAt);
      expect(suKien[0]?.toRejected).toBe(r.rejectedAt !== null);
      expect(suKien[0]?.toApproved).toBe(r.rejectedAt === null);
    }
  });
});

describe.each(MOC)('review tổng với H = %s', (giaTri) => {
  const { homNay, lich, ket } = chuanBi(giaTri);
  const { reviews } = ket;

  it('29/29 tour có ít nhất 3 review đã duyệt', () => {
    for (const tour of tours) {
      const daDuyet = reviews.filter((r) => r.tourId === tour.id && r.isApproved).length;
      expect(daDuyet, tour.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('hàng đợi admin có việc: ≥ 5 chờ duyệt, ≥ 1 bị bác, ≥ 1 bị rút', () => {
    const choDuyet = reviews.filter(
      (r) => !r.isApproved && r.rejectedAt === null && r.retractedAt === null,
    );
    expect(choDuyet.length).toBeGreaterThanOrEqual(5);
    for (const r of choDuyet) expect(r.moderatedAt).toBeNull();
    expect(reviews.filter((r) => r.rejectedAt !== null).length).toBeGreaterThanOrEqual(1);
    expect(reviews.filter((r) => r.retractedAt !== null).length).toBeGreaterThanOrEqual(1);
  });

  it('phân bố sao: trung bình trong [4,1; 4,6] và ≥ 40% là 5★', () => {
    const trungBinh = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    expect(trungBinh).toBeGreaterThanOrEqual(4.1);
    expect(trungBinh).toBeLessThanOrEqual(4.6);
    expect(reviews.filter((r) => r.rating === 5).length / reviews.length).toBeGreaterThanOrEqual(
      0.4,
    );
  });

  it('hụt sàn review thì ném lỗi, không âm thầm để tour mất sao', () => {
    // Không có booking nào để chứa review: bước 3 không thể đủ sàn.
    expect(() => sinhReview(homNay, lich, [])).toThrow(/sàn review/);
  });
});
