import { describe, expect, it } from 'vitest';
import { decideAdminAccess, loginDestination } from './admin-gate';

// Ma trận quyết định cổng admin (spec P4a §2): session × role × path.
// Hàm THUẦN — proxy/layout chỉ là người thi hành, mọi nhánh quyết ở đây.
describe('decideAdminAccess', () => {
  it('chưa đăng nhập ở path bảo vệ → login kèm redirect về đúng path', () => {
    expect(decideAdminAccess(null, '/bookings')).toEqual({
      kind: 'login',
      redirectTo: '/bookings',
    });
  });

  it('chưa đăng nhập ở trang chủ → login với redirect "/"', () => {
    expect(decideAdminAccess(null, '/')).toEqual({ kind: 'login', redirectTo: '/' });
  });

  it('đăng nhập nhưng role CUSTOMER → deny (màn Not authorized, không im lặng)', () => {
    expect(decideAdminAccess({ role: 'CUSTOMER' }, '/')).toEqual({ kind: 'deny' });
  });

  it('role rỗng/lạ cũng deny — fail-closed như ADR-0003', () => {
    expect(decideAdminAccess({ role: '' }, '/')).toEqual({ kind: 'deny' });
    expect(decideAdminAccess({ role: 'MODERATOR' }, '/')).toEqual({ kind: 'deny' });
  });

  it('ADMIN → allow', () => {
    expect(decideAdminAccess({ role: 'ADMIN' }, '/outbox')).toEqual({ kind: 'allow' });
  });

  it('path public (/login, /not-authorized) luôn allow kể cả chưa đăng nhập', () => {
    expect(decideAdminAccess(null, '/login')).toEqual({ kind: 'allow' });
    expect(decideAdminAccess(null, '/not-authorized')).toEqual({ kind: 'allow' });
  });

  it('path con của /login vẫn public (query/segment phụ)', () => {
    expect(decideAdminAccess(null, '/login/anything')).toEqual({ kind: 'allow' });
  });

  it('/robots.txt public — crawler không cookie phải đọc được disallow (W3-H3)', () => {
    expect(decideAdminAccess(null, '/robots.txt')).toEqual({ kind: 'allow' });
  });

  it('/icon và /apple-icon public — favicon phải hiện cả ở trang login chưa có session', () => {
    expect(decideAdminAccess(null, '/icon')).toEqual({ kind: 'allow' });
    expect(decideAdminAccess(null, '/apple-icon')).toEqual({ kind: 'allow' });
  });

  it('chỉ đúng path icon mới public — path trùng tiền tố như /icons vẫn phải đăng nhập', () => {
    expect(decideAdminAccess(null, '/icons')).toEqual({ kind: 'login', redirectTo: '/icons' });
  });
});

// Link mã đơn trong file Excel (review max G40 Phần 3): Office tự tải URL trước, KHÔNG mang cookie
// của trình duyệt, nên proxy trả `/login?redirect=…` và trình duyệt mở đúng URL login ấy — dù admin
// đang đăng nhập. Trang login hỏi hàm này: có phiên ADMIN thì đi thẳng tới đích.
describe('loginDestination', () => {
  it('phiên ADMIN → đích trong ?redirect=, giữ cả query bộ lọc', () => {
    expect(loginDestination({ role: 'ADMIN' }, '/bookings/BK-ABCD1234')).toBe(
      '/bookings/BK-ABCD1234',
    );
    expect(loginDestination({ role: 'ADMIN' }, '/bookings?status=PAID&page=2')).toBe(
      '/bookings?status=PAID&page=2',
    );
  });

  it('chưa đăng nhập hoặc không phải ADMIN → null: hiện form để đăng nhập bằng tài khoản admin', () => {
    expect(loginDestination(null, '/bookings')).toBeNull();
    expect(loginDestination({ role: 'CUSTOMER' }, '/bookings')).toBeNull();
    expect(loginDestination({ role: '' }, '/bookings')).toBeNull();
  });

  it('đích thiếu, lặp hoặc không an toàn → trang chủ, cùng luật safeRedirect với form', () => {
    expect(loginDestination({ role: 'ADMIN' }, undefined)).toBe('/');
    expect(loginDestination({ role: 'ADMIN' }, ['/bookings', '/outbox'])).toBe('/');
    expect(loginDestination({ role: 'ADMIN' }, 'https://evil.example/x')).toBe('/');
    expect(loginDestination({ role: 'ADMIN' }, '//evil.example/x')).toBe('/');
  });

  it('đích là chính trang login → trang chủ, không vòng lặp redirect', () => {
    expect(loginDestination({ role: 'ADMIN' }, '/login')).toBe('/');
    expect(loginDestination({ role: 'ADMIN' }, '/login?redirect=%2Flogin')).toBe('/');
    expect(loginDestination({ role: 'ADMIN' }, '/login/')).toBe('/');
    expect(loginDestination({ role: 'ADMIN' }, '/login#form')).toBe('/');
    // Chỉ đúng trang login — path trùng tiền tố vẫn là đích hợp lệ.
    expect(loginDestination({ role: 'ADMIN' }, '/logins')).toBe('/logins');
  });
});
