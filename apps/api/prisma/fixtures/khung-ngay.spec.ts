import { describe, expect, it } from 'vitest';
import { sinhLich } from './catalog/departures-2026.js';
import { tours } from './catalog/index.js';
import { CUOI_KHUNG, DAU_KHUNG, docMocHomNay, isoNgay, NGAY_MS } from './khung-thoi-gian.js';
import { sinhVanHanh } from './operations/bookings.js';
import { sinhEnquiry } from './operations/enquiries.js';
import { sinhReview } from './operations/reviews-verified.js';
import { sinhSubscriber } from './operations/subscribers.js';
import { sinhKhach } from './people/customers.js';

/**
 * Lưới canh tổng quát cho khung 2026 (spec 2026-09-14 §6 mục 2): quét THEO TÊN
 * TRƯỜNG chứ không theo danh sách cột viết tay, nên một cột `…At`/`…Date` thêm về sau
 * cũng tự được canh mà không ai phải nhớ sửa test.
 *
 * Chạy cho CẢ DẢI mốc hợp lệ chứ không chỉ hai mốc cố định: lượt seed prod dùng ngày
 * chạy làm H, và vài nhánh dự phòng (sàn huỷ subscriber, sàn review, sàn enquiry) chỉ
 * chạy ở những mốc mà dữ liệu tự nhiên hụt sàn.
 */

/** Hai mốc cố định cộng mọi mốc cách nhau 7 ngày trong [2026-06-01, 2026-12-01]. */
const MOC: string[] = ['2026-09-20', '2026-11-03'];
for (let t = Date.UTC(2026, 5, 1); t <= Date.UTC(2026, 11, 1); t += 7 * NGAY_MS) {
  if (!MOC.includes(isoNgay(t))) MOC.push(isoNgay(t));
}
if (!MOC.includes('2026-12-01')) MOC.push('2026-12-01');

/** Cột ngày lịch được phép tới 31/12 — mọi cột mốc khác phải trước H. */
const COT_NGAY_LICH = new Set([
  'startDate',
  'endDate',
  'departureStartDate',
  'departureEndDate',
  'travelDate',
]);

function quet(bang: string, dong: readonly object[], H: number, loi: string[]): void {
  for (const d of dong) {
    for (const [cot, giaTri] of Object.entries(d)) {
      if (!cot.endsWith('At') && !cot.endsWith('Date')) continue;
      if (giaTri === null) continue;
      let t = Number.NaN;
      if (giaTri instanceof Date) t = giaTri.getTime();
      else if (typeof giaTri === 'string') {
        t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(giaTri) ? `${giaTri}T00:00:00.000Z` : giaTri);
      }
      const tran = COT_NGAY_LICH.has(cot) ? CUOI_KHUNG : H - 1;
      if (!(t >= DAU_KHUNG && t <= tran)) loi.push(`${bang}.${cot} = ${String(giaTri)}`);
    }
  }
}

describe.each(MOC)('khung ngày tổng quát với H = %s', (giaTri) => {
  it('mọi trường …At và …Date của mọi fixture nằm trong khung', () => {
    const homNay = docMocHomNay(giaTri);
    const H = homNay.getTime();
    const khach = sinhKhach(homNay);
    const lich = sinhLich(homNay);
    const vanHanh = sinhVanHanh(homNay, lich, khach);
    const review = sinhReview(homNay, lich, vanHanh.bookings);
    const enquiry = sinhEnquiry(homNay, khach);
    const loi: string[] = [];

    quet('khach', khach, H, loi);
    quet('tour_departures', lich, H, loi);
    quet('bookings', vanHanh.bookings, H, loi);
    quet('payment_events', vanHanh.paymentEvents, H, loi);
    quet('refunds', vanHanh.refunds, H, loi);
    quet('cancellation_requests', vanHanh.cancellationRequests, H, loi);
    quet('reviews', review.reviews, H, loi);
    quet('review_moderation_events', review.moderationEvents, H, loi);
    quet('enquiries', enquiry.enquiries, H, loi);
    quet('enquiry_notes', enquiry.notes, H, loi);
    quet('enquiry_status_events', enquiry.statusEvents, H, loi);
    quet('subscribers', sinhSubscriber(homNay, khach), H, loi);

    expect(loi).toEqual([]);
  });
});

describe.each(MOC)('sàn cấu trúc với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const tu28 = H - 28 * NGAY_MS;
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  const vanHanh = sinhVanHanh(homNay, lich, khach);

  it('lịch: id không trùng; mỗi tour ≥ 3 chuyến lịch sử CLOSED và đúng 4 chuyến còn bán', () => {
    expect(new Set(lich.map((d) => d.id)).size).toBe(lich.length);
    for (const tour of tours) {
      const cua = lich.filter((d) => d.tourId === tour.id);
      expect(cua.filter((d) => d.status === 'CLOSED').length, tour.slug).toBeGreaterThanOrEqual(3);
      expect(
        cua.filter((d) => d.status === 'OPEN'),
        tour.slug,
      ).toHaveLength(4);
    }
  });

  it('booking: có booking trả tiền trong 7 ngày trước H; mỗi tour ≥ 3 booking đã đi', () => {
    const daTra = vanHanh.bookings.filter((b) => b.paidAt !== null);
    expect(daTra.some((b) => Date.parse(b.paidAt ?? '') >= H - 7 * NGAY_MS)).toBe(true);
    // Booking đã đi: PAID trên chuyến CLOSED kết thúc trước H ít nhất 3 ngày — đúng loại
    // booking bước bù review nhận, nên sàn này là điều kiện của sàn review bên dưới.
    const bangChuyen = new Map(lich.map((d) => [d.id, d]));
    for (const tour of tours) {
      const daDi = vanHanh.bookings.filter((b) => {
        const d = bangChuyen.get(b.departureId);
        return (
          b.tourId === tour.id &&
          b.status === 'PAID' &&
          d?.status === 'CLOSED' &&
          Date.parse(`${d.endDate}T00:00:00.000Z`) <= H - 3 * NGAY_MS
        );
      });
      expect(daDi.length, tour.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('review: 29/29 tour có ≥ 3 review đã duyệt; ≥ 5 chờ duyệt, ≥ 1 bị bác, ≥ 1 bị rút', () => {
    const { reviews } = sinhReview(homNay, lich, vanHanh.bookings);
    for (const tour of tours) {
      const daDuyet = reviews.filter((r) => r.tourId === tour.id && r.isApproved).length;
      expect(daDuyet, tour.slug).toBeGreaterThanOrEqual(3);
    }
    const choDuyet = reviews.filter(
      (r) => !r.isApproved && r.rejectedAt === null && r.retractedAt === null,
    );
    expect(choDuyet.length).toBeGreaterThanOrEqual(5);
    expect(reviews.some((r) => r.rejectedAt !== null)).toBe(true);
    expect(reviews.some((r) => r.retractedAt !== null)).toBe(true);
  });

  it('enquiry: ≥ 1 lượt WON và ≥ 3 lead mới trong 28 ngày trước H; ≥ 5 lead NEW', () => {
    const kq = sinhEnquiry(homNay, khach);
    expect(
      kq.statusEvents.some((s) => s.toStatus === 'WON' && Date.parse(s.createdAt) >= tu28),
    ).toBe(true);
    expect(
      kq.enquiries.filter((e) => Date.parse(e.createdAt) >= tu28).length,
    ).toBeGreaterThanOrEqual(3);
    expect(kq.enquiries.filter((e) => e.status === 'NEW').length).toBeGreaterThanOrEqual(5);
  });

  it('subscriber: ≥ 1 lượt huỷ và ≥ 3 đăng ký mới trong 28 ngày trước H', () => {
    const ds = sinhSubscriber(homNay, khach);
    expect(ds.some((s) => s.unsubscribedAt !== null && Date.parse(s.unsubscribedAt) >= tu28)).toBe(
      true,
    );
    expect(ds.filter((s) => Date.parse(s.createdAt) >= tu28).length).toBeGreaterThanOrEqual(3);
  });
});
