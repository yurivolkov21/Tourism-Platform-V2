import { EnquiryDetailSchema, EnquiryRowSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  type EnquiryDetailRow,
  toEnquiryDetail,
  toEnquiryRow,
} from '../../../src/modules/enquiries/enquiry-row.js';
import { tours } from '../catalog/index.js';
import { CUOI_KHUNG, DAU_KHUNG, docMocHomNay, GIO_MS, NGAY_MS } from '../khung-thoi-gian.js';
import { sinhKhach } from '../people/customers.js';
import { sinhEnquiry } from './enquiries.js';

const MOC = ['2026-09-20', '2026-11-03'] as const;
const ms = (s: string): number => Date.parse(s);

describe.each(MOC)('enquiries với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const kq = sinhEnquiry(homNay, khach);
  const bangKhach = new Map(khach.map((k) => [k.id, k]));
  const bangTour = new Map(tours.map((t) => [t.id, t]));
  const emailKhach = new Set(khach.map((k) => k.email));
  const suKienCua = (id: string) =>
    kq.statusEvents
      .filter((s) => s.enquiryId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  it('tất định: cùng H sinh hai lần ra y hệt', () => {
    expect(sinhEnquiry(homNay, khach)).toEqual(kq);
  });

  it('đủ lượng dữ liệu cho vài trang; id không trùng', () => {
    expect(kq.enquiries.length).toBeGreaterThanOrEqual(50);
    const ids = [...kq.enquiries, ...kq.notes, ...kq.statusEvents].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mọi mốc trong [01/01/2026, H)', () => {
    for (const x of [...kq.enquiries, ...kq.notes, ...kq.statusEvents]) {
      expect(ms(x.createdAt), x.id).toBeGreaterThanOrEqual(DAU_KHUNG);
      expect(ms(x.createdAt), x.id).toBeLessThan(H);
    }
  });

  it('chuỗi trạng thái hợp lệ và updatedAt là mốc sự kiện cuối', () => {
    for (const e of kq.enquiries) {
      let truoc = 'NEW';
      let mocTruoc = ms(e.createdAt);
      const chuoi = suKienCua(e.id);
      for (const s of chuoi) {
        expect(s.fromStatus, e.id).toBe(truoc);
        expect(s.toStatus, e.id).not.toBe(s.fromStatus);
        expect(ms(s.createdAt), e.id).toBeGreaterThan(mocTruoc);
        truoc = s.toStatus;
        mocTruoc = ms(s.createdAt);
      }
      expect(e.status, e.id).toBe(truoc);
      expect(e.updatedAt, e.id).toBe(chuoi.at(-1)?.createdAt ?? e.createdAt);
    }
  });

  it('ghi chú chỉ có ở lead đã rời NEW, sau lúc tạo, trước H', () => {
    const bangEnquiry = new Map(kq.enquiries.map((e) => [e.id, e]));
    for (const n of kq.notes) {
      const e = bangEnquiry.get(n.enquiryId);
      if (!e) throw new Error(`ghi chú ${n.id} trỏ enquiry không có thật`);
      expect(e.status, n.id).not.toBe('NEW');
      expect(ms(n.createdAt), n.id).toBeGreaterThan(ms(e.createdAt));
      expect(n.body.length).toBeGreaterThan(0);
    }
  });

  it('hai kiểu form khớp đúng thứ web gửi', () => {
    for (const e of kq.enquiries) {
      expect(e.nationality).toBeNull();
      expect(e.budgetTier).toBeNull();
      expect(e.message.length, e.id).toBeGreaterThanOrEqual(10);
      if (e.tourId !== null) {
        expect(bangTour.has(e.tourId), e.id).toBe(true);
        expect(e.interests).toEqual([]);
        expect(e.groupSize ?? 0, e.id).toBeGreaterThanOrEqual(2);
        if (e.travelDate === null) throw new Error(`private trip ${e.id} thiếu travelDate`);
        const ngayDi = Date.parse(`${e.travelDate}T00:00:00.000Z`);
        expect(ngayDi, e.id).toBeGreaterThanOrEqual(ms(e.createdAt) - GIO_MS * 24 + 14 * NGAY_MS);
        expect(ngayDi, e.id).toBeLessThanOrEqual(CUOI_KHUNG);
      } else {
        expect(e.phone, e.id).toBeNull();
        expect(e.travelDate, e.id).toBeNull();
        for (const v of e.interests) expect(['north', 'central', 'south']).toContain(v);
      }
    }
    expect(kq.enquiries.some((e) => e.tourId !== null)).toBe(true);
    expect(kq.enquiries.some((e) => e.tourId === null)).toBe(true);
  });

  it('người gửi đăng nhập là khách giả có thật và gửi sau khi đăng ký; khách vãng lai không trùng email khách giả', () => {
    for (const e of kq.enquiries) {
      if (e.userId !== null) {
        const nguoi = bangKhach.get(e.userId);
        if (!nguoi) throw new Error(`enquiry ${e.id} trỏ khách không có thật`);
        expect(e.email).toBe(nguoi.email);
        expect(ms(e.createdAt), e.id).toBeGreaterThan(nguoi.createdAt.getTime());
      } else {
        expect(emailKhach.has(e.email), e.id).toBe(false);
        expect(e.email).toMatch(/@example\.com$/);
      }
    }
  });

  it('thẻ thống kê không về 0: ≥ 1 lượt WON và ≥ 3 enquiry mới trong 28 ngày trước H; ≥ 5 enquiry NEW', () => {
    const tu = H - 28 * NGAY_MS;
    expect(kq.statusEvents.some((s) => s.toStatus === 'WON' && ms(s.createdAt) >= tu)).toBe(true);
    expect(kq.enquiries.filter((e) => ms(e.createdAt) >= tu).length).toBeGreaterThanOrEqual(3);
    expect(kq.enquiries.filter((e) => e.status === 'NEW').length).toBeGreaterThanOrEqual(5);
  });

  it('mọi dòng qua đúng schema output của admin, cả list lẫn detail', () => {
    const admin = { name: 'Admin Nexora', email: 'admin@example.com' };
    for (const e of kq.enquiries) {
      const ghiChu = kq.notes.filter((n) => n.enquiryId === e.id);
      const row = {
        id: e.id,
        name: e.name,
        email: e.email,
        tour: e.tourId ? { title: bangTour.get(e.tourId)?.title ?? '' } : null,
        travelDate: e.travelDate ? new Date(`${e.travelDate}T00:00:00.000Z`) : null,
        groupSize: e.groupSize,
        budgetTier: e.budgetTier,
        status: e.status,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
        _count: { notes: ghiChu.length },
        phone: e.phone,
        message: e.message,
        nationality: e.nationality,
        interests: e.interests,
        notes: ghiChu.map((n) => ({
          id: n.id,
          authorName: admin.name,
          body: n.body,
          createdAt: new Date(n.createdAt),
        })),
        statusEvents: suKienCua(e.id).map((s) => ({
          id: s.id,
          fromStatus: s.fromStatus,
          toStatus: s.toStatus,
          createdAt: new Date(s.createdAt),
          admin,
        })),
      } as unknown as EnquiryDetailRow;
      expect(() => EnquiryRowSchema.parse(toEnquiryRow(row)), e.id).not.toThrow();
      expect(() => EnquiryDetailSchema.parse(toEnquiryDetail(row)), e.id).not.toThrow();
    }
  });
});

describe('enquiry khi chưa có khách giả nào đăng ký', () => {
  it('gửi trước người đăng ký sớm nhất thì là khách vãng lai; có người đăng ký rồi mới có enquiry đứng tên khách', () => {
    const homNay = docMocHomNay('2026-09-20');
    // Chỉ giữ khách đăng ký từ 01/05: mọi enquiry tháng 1–4 gửi lúc chưa ai có tài khoản.
    const khachMuon = sinhKhach(homNay).filter(
      (k) => k.createdAt.getTime() >= Date.UTC(2026, 4, 1),
    );
    const somNhat = Math.min(...khachMuon.map((k) => k.createdAt.getTime()));
    const kq = sinhEnquiry(homNay, khachMuon);

    const truoc = kq.enquiries.filter((e) => ms(e.createdAt) < somNhat);
    expect(truoc.length).toBeGreaterThan(0);
    for (const e of truoc) expect(e.userId, e.id).toBeNull();
    // Đối chứng cùng bộ khách: khi đã có người đăng ký thì nhánh đăng nhập vẫn ra enquiry đứng tên khách.
    expect(kq.enquiries.some((e) => e.userId !== null)).toBe(true);
  });
});
