import { describe, expect, it } from 'vitest';
import { sinhLich } from './catalog/departures-2026.js';
import {
  kiemTraAdminChoProd,
  kiemTraMatKhauKhachChoProd,
  kiemTraTheHeLich,
  MAT_KHAU_KHACH_MAC_DINH,
} from './chot-chan-seed.js';
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

describe('kiemTraMatKhauKhachChoProd', () => {
  const rieng = 'mat-khau-rieng-cho-prod';

  it('không phải prod → ok, kể cả khi mật khẩu trống (Docker dùng mặc định)', () => {
    expect(kiemTraMatKhauKhachChoProd({ laProd: false, matKhau: '' }).ketQua).toBe('ok');
  });

  it('prod mà SEED_CUSTOMER_PASSWORD trống hoặc chỉ có khoảng trắng → từ chối', () => {
    expect(kiemTraMatKhauKhachChoProd({ laProd: true, matKhau: '' }).ketQua).toBe('tu-choi');
    expect(kiemTraMatKhauKhachChoProd({ laProd: true, matKhau: '   ' }).ketQua).toBe('tu-choi');
  });

  it('prod mà mật khẩu trùng mặc định công khai (kể cả có khoảng trắng hai đầu) → từ chối', () => {
    expect(
      kiemTraMatKhauKhachChoProd({ laProd: true, matKhau: ` ${MAT_KHAU_KHACH_MAC_DINH} ` }).ketQua,
    ).toBe('tu-choi');
  });

  it('prod với mật khẩu riêng → ok', () => {
    expect(kiemTraMatKhauKhachChoProd({ laProd: true, matKhau: rieng }).ketQua).toBe('ok');
  });

  it('thông điệp không in mật khẩu nào ra log', () => {
    for (const matKhau of ['', MAT_KHAU_KHACH_MAC_DINH, rieng]) {
      const { thongDiep } = kiemTraMatKhauKhachChoProd({ laProd: true, matKhau });
      expect(thongDiep).not.toContain(MAT_KHAU_KHACH_MAC_DINH);
      expect(thongDiep).not.toContain(rieng);
    }
  });
});
