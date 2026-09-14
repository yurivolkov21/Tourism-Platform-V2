import { describe, expect, it } from 'vitest';
import { sinhLich } from './catalog/departures-2026.js';
import { kiemTraAdminChoProd, kiemTraTheHeLich } from './chot-chan-seed.js';
import { docMocHomNay } from './khung-thoi-gian.js';

describe('kiemTraAdminChoProd', () => {
  const email = 'owner@nexora.test';

  it('không phải prod → ok, kể cả khi DB chưa có admin nào', () => {
    expect(
      kiemTraAdminChoProd({ laProd: false, adminEmail: email, emailAdminHienCo: [] }).ketQua,
    ).toBe('ok');
  });

  it('prod có đúng một admin trùng ADMIN_EMAILS[0] (không phân biệt hoa thường, bỏ khoảng trắng) → ok', () => {
    expect(
      kiemTraAdminChoProd({
        laProd: true,
        adminEmail: ' Owner@Nexora.TEST ',
        emailAdminHienCo: [email],
      }).ketQua,
    ).toBe('ok');
  });

  it('prod chưa có admin nào → từ chối', () => {
    expect(
      kiemTraAdminChoProd({ laProd: true, adminEmail: email, emailAdminHienCo: [] }).ketQua,
    ).toBe('tu-choi');
  });

  it('prod có một admin nhưng ADMIN_EMAILS[0] là email khác → từ chối (seed sẽ sinh admin thứ hai)', () => {
    const kq = kiemTraAdminChoProd({
      laProd: true,
      adminEmail: 'admin@tourism.test',
      emailAdminHienCo: [email],
    });
    expect(kq.ketQua).toBe('tu-choi');
    expect(kq.thongDiep).toContain('KHÔNG khớp');
  });

  it('prod có hai admin → từ chối dù một trong hai trùng ADMIN_EMAILS[0]', () => {
    const kq = kiemTraAdminChoProd({
      laProd: true,
      adminEmail: email,
      emailAdminHienCo: [email, 'second@nexora.test'],
    });
    expect(kq.ketQua).toBe('tu-choi');
    expect(kq.thongDiep).toContain('đang có 2 admin');
  });

  it('thông điệp từ chối không in email nào ra log', () => {
    const kq = kiemTraAdminChoProd({
      laProd: true,
      adminEmail: 'admin@tourism.test',
      emailAdminHienCo: [email],
    });
    expect(kq.thongDiep).not.toContain('@');
  });
});

describe('kiemTraTheHeLich', () => {
  const fixture = new Set(['a', 'b', 'c']);

  it('DB chưa có chuyến nào → ok', () => {
    expect(kiemTraTheHeLich({ idChuyenHienCo: [], idChuyenFixture: fixture })).toMatchObject({
      ketQua: 'ok',
      soLa: 0,
    });
  });

  it('DB cùng thế hệ H (seed chạy lại cùng H) → ok', () => {
    expect(
      kiemTraTheHeLich({ idChuyenHienCo: ['a', 'b'], idChuyenFixture: fixture }),
    ).toMatchObject({ ketQua: 'ok', soLa: 0 });
  });

  it('DB có chuyến của một H khác → từ chối và đếm đúng số chuyến lạ', () => {
    expect(
      kiemTraTheHeLich({ idChuyenHienCo: ['a', 'x', 'y'], idChuyenFixture: fixture }),
    ).toMatchObject({ ketQua: 'tu-choi', soLa: 2 });
  });

  it('với bộ sinh thật: DB đã seed ở H = 2026-09-20 bị chặn khi seed lại với H = 2026-09-21', () => {
    const cu = sinhLich(docMocHomNay('2026-09-20')).map((d) => d.id);
    const moi = new Set(sinhLich(docMocHomNay('2026-09-21')).map((d) => d.id));
    const kq = kiemTraTheHeLich({ idChuyenHienCo: cu, idChuyenFixture: moi });
    expect(kq.ketQua).toBe('tu-choi');
    expect(kq.soLa).toBeGreaterThan(0);
  });
});
