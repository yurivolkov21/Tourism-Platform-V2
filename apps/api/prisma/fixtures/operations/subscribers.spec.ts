import { SubscriberRowSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { toSubscriberRow } from '../../../src/modules/newsletter/subscriber-row.js';
import { DAU_KHUNG, docMocHomNay, NGAY_MS } from '../khung-thoi-gian.js';
import { sinhKhach } from '../people/customers.js';
import { sinhSubscriber } from './subscribers.js';

const MOC = ['2026-09-20', '2026-11-03'] as const;
const ms = (s: string): number => Date.parse(s);

describe.each(MOC)('subscribers với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const ds = sinhSubscriber(homNay, khach);

  it('tất định: cùng H sinh hai lần ra y hệt', () => {
    expect(sinhSubscriber(homNay, khach)).toEqual(ds);
  });

  it('đủ lượng dữ liệu; email không trùng kể cả khác hoa thường; id không trùng', () => {
    expect(ds.length).toBeGreaterThanOrEqual(120);
    expect(new Set(ds.map((s) => s.email.toLowerCase())).size).toBe(ds.length);
    expect(new Set(ds.map((s) => s.id)).size).toBe(ds.length);
  });

  it('source luôn null — footer web chỉ gửi email', () => {
    for (const s of ds) expect(s.source).toBeNull();
  });

  it('chỉ thuộc bốn trạng thái của double opt-in; các mốc đúng thứ tự và trước H', () => {
    const dem = { choXacNhan: 0, dangNhanTin: 0, xacNhanRoiHuy: 0, huyChuaXacNhan: 0 };
    for (const s of ds) {
      const tao = ms(s.createdAt);
      const welcome = ms(s.welcomeSentAt);
      expect(tao, s.id).toBeGreaterThanOrEqual(DAU_KHUNG);
      expect(welcome, s.id).toBeGreaterThanOrEqual(tao);
      expect(welcome, s.id).toBeLessThan(H);
      if (s.confirmedAt !== null) {
        expect(ms(s.confirmedAt), s.id).toBeGreaterThan(tao);
        expect(ms(s.confirmedAt), s.id).toBeLessThan(H);
      }
      if (s.unsubscribedAt !== null) {
        expect(ms(s.unsubscribedAt), s.id).toBeGreaterThan(ms(s.confirmedAt ?? s.welcomeSentAt));
        expect(ms(s.unsubscribedAt), s.id).toBeLessThan(H);
      }
      const moiNhat = Math.max(
        welcome,
        s.confirmedAt === null ? 0 : ms(s.confirmedAt),
        s.unsubscribedAt === null ? 0 : ms(s.unsubscribedAt),
      );
      expect(ms(s.updatedAt), s.id).toBe(moiNhat);

      if (s.confirmedAt === null && s.unsubscribedAt === null) dem.choXacNhan++;
      else if (s.unsubscribedAt === null) dem.dangNhanTin++;
      else if (s.confirmedAt !== null) dem.xacNhanRoiHuy++;
      else dem.huyChuaXacNhan++;
    }
    for (const [trangThai, so] of Object.entries(dem)) expect(so, trangThai).toBeGreaterThan(0);
    expect(dem.dangNhanTin / ds.length).toBeGreaterThan(0.6);
  });

  it('khoảng một phần ba là email của khách giả', () => {
    const emailKhach = new Set(khach.map((k) => k.email));
    const tiLe = ds.filter((s) => emailKhach.has(s.email)).length / ds.length;
    expect(tiLe).toBeGreaterThan(0.15);
    expect(tiLe).toBeLessThan(0.45);
  });

  it('thẻ thống kê không về 0: ≥ 1 lượt huỷ và ≥ 3 đăng ký mới trong 28 ngày trước H', () => {
    const tu = H - 28 * NGAY_MS;
    expect(ds.some((s) => s.unsubscribedAt !== null && ms(s.unsubscribedAt) >= tu)).toBe(true);
    expect(ds.filter((s) => ms(s.createdAt) >= tu).length).toBeGreaterThanOrEqual(3);
  });

  it('mọi dòng qua đúng schema output của admin', () => {
    for (const s of ds) {
      const row = toSubscriberRow({
        id: s.id,
        email: s.email,
        source: s.source,
        createdAt: new Date(s.createdAt),
        unsubscribedAt: s.unsubscribedAt === null ? null : new Date(s.unsubscribedAt),
        confirmedAt: s.confirmedAt === null ? null : new Date(s.confirmedAt),
      });
      expect(() => SubscriberRowSchema.parse(row), s.id).not.toThrow();
    }
  });
});
