import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CUOI_KHUNG,
  DAU_KHUNG,
  docMocHomNay,
  GIO_MS,
  gioTrongNgay,
  HOM_NAY_MAC_DINH,
  isoNgay,
  kiemTraMocChoProd,
  mocTrongKhoang,
  NGAY_MS,
  ngayUTC,
} from './khung-thoi-gian.js';
import { boSinh, chonMot } from './stable-id.js';

/**
 * Khung thời gian là nền của mọi bộ sinh seed (spec 2026-09-14 §3): sai ở đây là
 * cả bộ dữ liệu lệch năm, nên từng biên được khoá bằng test.
 */
describe('khung thời gian', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('khung là trọn năm 2026 theo lịch UTC', () => {
    expect(new Date(DAU_KHUNG).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(new Date(CUOI_KHUNG).toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('docMocHomNay nhận ngày hợp lệ và trả nửa đêm UTC', () => {
    expect(docMocHomNay('2026-09-20').toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(docMocHomNay('2026-06-01').toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(docMocHomNay('2026-12-01').toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  // '2026-02-31' được engine cuộn sang tháng 3 nên bị phép so khứ hồi bắt; '2026-13-01' qua được
  // regex nhưng Date.parse trả NaN — nhánh Number.isNaN.
  it.each([
    '2026-9-20',
    '20/09/2026',
    '',
    '2026-02-31',
    '2026-13-01',
    '2026-05-31',
    '2026-12-02',
    '2025-09-20',
  ])('docMocHomNay từ chối %j', (giaTri) => {
    expect(() => docMocHomNay(giaTri)).toThrow();
  });

  it('HOM_NAY đọc SEED_HOM_NAY; chuỗi rỗng rơi về ngày ghim', async () => {
    vi.stubEnv('SEED_HOM_NAY', '2026-11-03');
    vi.resetModules();
    const coEnv = await import('./khung-thoi-gian.js');
    expect(isoNgay(coEnv.HOM_NAY.getTime())).toBe('2026-11-03');

    vi.stubEnv('SEED_HOM_NAY', '');
    vi.resetModules();
    const rong = await import('./khung-thoi-gian.js');
    expect(isoNgay(rong.HOM_NAY.getTime())).toBe(HOM_NAY_MAC_DINH);
  });

  describe('kiemTraMocChoProd', () => {
    const homNayThat = new Date('2026-09-20T09:30:00.000Z');

    it('đích không phải prod thì luôn ok', () => {
      const kq = kiemTraMocChoProd({
        laProd: false,
        coEnv: false,
        homNay: docMocHomNay('2026-12-01'),
        homNayThat,
      });
      expect(kq.ketQua).toBe('ok');
    });

    it('prod mà thiếu SEED_HOM_NAY thì từ chối', () => {
      const kq = kiemTraMocChoProd({
        laProd: true,
        coEnv: false,
        homNay: docMocHomNay('2026-09-20'),
        homNayThat,
      });
      expect(kq.ketQua).toBe('tu-choi');
    });

    it.each([
      ['2026-09-20', 'ok'],
      ['2026-09-21', 'ok'],
      ['2026-09-22', 'tu-choi'],
      ['2026-09-17', 'ok'],
      ['2026-09-16', 'canh-bao'],
    ] as const)('prod với H = %s thì %s', (giaTri, ketQua) => {
      const kq = kiemTraMocChoProd({
        laProd: true,
        coEnv: true,
        homNay: docMocHomNay(giaTri),
        homNayThat,
      });
      expect(kq.ketQua).toBe(ketQua);
    });
  });

  it('gioTrongNgay rơi trong 01:00–15:00 UTC', () => {
    const rnd = boSinh('gio');
    for (let i = 0; i < 500; i++) {
      const gio = gioTrongNgay(rnd);
      expect(gio).toBeGreaterThanOrEqual(GIO_MS);
      expect(gio).toBeLessThan(15 * GIO_MS);
    }
  });

  it('mocTrongKhoang không bao giờ ra ngoài [tu, den], và từ chối khoảng rỗng', () => {
    const rnd = boSinh('khoang');
    const tu = Date.parse('2026-03-10T20:00:00.000Z');
    const den = Date.parse('2026-03-14T03:00:00.000Z');
    for (let i = 0; i < 500; i++) {
      const t = mocTrongKhoang(rnd, tu, den);
      expect(t).toBeGreaterThanOrEqual(tu);
      expect(t).toBeLessThanOrEqual(den);
    }
    expect(() => mocTrongKhoang(rnd, den, tu)).toThrow();
  });

  it('ngayUTC cắt về nửa đêm UTC', () => {
    expect(new Date(ngayUTC(Date.parse('2026-04-05T23:59:59.000Z'))).toISOString()).toBe(
      '2026-04-05T00:00:00.000Z',
    );
    expect(ngayUTC(DAU_KHUNG + NGAY_MS)).toBe(DAU_KHUNG + NGAY_MS);
  });

  it('chonMot trả một phần tử của danh sách và ném lỗi khi danh sách rỗng', () => {
    const rnd = boSinh('chon');
    const ds = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(ds).toContain(chonMot(rnd, ds));
    expect(() => chonMot(rnd, [])).toThrow();
  });
});
