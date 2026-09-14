import { describe, expect, it } from 'vitest';
import { DAU_KHUNG, docMocHomNay, GIO_MS, NGAY_MS } from '../khung-thoi-gian.js';
import { SO_KHACH, sinhKhach, taoDanhTinh } from './customers.js';

const MOC = ['2026-09-20', '2026-11-03'] as const;

describe.each(MOC)('khách giả với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const khach = sinhKhach(homNay);

  it('đủ 120 người; id và email không trùng; email thuộc @example.com', () => {
    expect(khach).toHaveLength(SO_KHACH);
    expect(new Set(khach.map((k) => k.id)).size).toBe(SO_KHACH);
    expect(new Set(khach.map((k) => k.email.toLowerCase())).size).toBe(SO_KHACH);
    for (const k of khach) expect(k.email).toMatch(/^[a-z.-]+@example\.com$/);
  });

  it('đăng ký trong [01/01/2026, H − 7 ngày], giờ 01:00–15:00 UTC', () => {
    for (const k of khach) {
      const t = k.createdAt.getTime();
      expect(t, k.email).toBeGreaterThanOrEqual(DAU_KHUNG);
      expect(t, k.email).toBeLessThanOrEqual(homNay.getTime() - 7 * NGAY_MS);
      const gio = t % NGAY_MS;
      expect(gio, k.email).toBeGreaterThanOrEqual(GIO_MS);
      expect(gio, k.email).toBeLessThan(15 * GIO_MS);
    }
  });

  it('đúng 30% đăng ký trong đợt ra mắt 01–07/01', () => {
    const raMat = khach.filter((k) => k.createdAt.getTime() < DAU_KHUNG + 7 * NGAY_MS);
    expect(raMat).toHaveLength(36);
  });

  it('tất định: cùng H sinh hai lần ra y hệt', () => {
    expect(sinhKhach(homNay)).toEqual(khach);
  });
});

it('danh tính không phụ thuộc H — id khách giữ nguyên giữa hai mốc', () => {
  const truoc = sinhKhach(docMocHomNay('2026-09-20')).map((k) => k.id);
  const sau = sinhKhach(docMocHomNay('2026-11-03')).map((k) => k.id);
  expect(sau).toEqual(truoc);
});

it('taoDanhTinh không trả lại tên đã dùng, kể cả khi dò 400 danh tính', () => {
  const daDung = new Set<string>();
  for (let i = 0; i < 400; i++) taoDanhTinh(i, daDung);
  expect(daDung.size).toBe(400);
});

describe('taoDanhTinh dò mãi một chỉ số', () => {
  // chiSo = 0 rơi vào nhóm Anh · Ireland · Úc (12 tên × 10 họ). Pha 1 của chiSo = 0 chỉ chạm 4 cặp:
  // chỉ số tên 3k mod 12 ∈ {0, 3, 6, 9}, chỉ số họ 5k mod 10 ∈ {0, 5}, lặp theo chu kỳ 4 — nên từ
  // lượt thứ 5 trở đi chỉ Pha 2 còn tìm được tên chưa dùng.
  it('Pha 1 cạn sau 4 danh tính thì Pha 2 quét bảng tên × họ, mỗi lượt vẫn ra một tên mới', () => {
    const daDung = new Set<string>();
    for (let i = 0; i < 10; i++) taoDanhTinh(0, daDung);
    expect(daDung.size).toBe(10);
  });

  it('cạn cả bảng tên × họ của nhóm thì ném lỗi thay vì trả lại tên đã dùng', () => {
    const daDung = new Set<string>();
    expect(() => {
      for (let i = 0; i < 10_000; i++) taoDanhTinh(0, daDung);
    }).toThrow(new Error('Không còn tên chưa dùng trong nhóm của chỉ số #0'));
  });
});
