import { describe, expect, it } from 'vitest';
import { decideAdminAccess } from './admin-gate';

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
});
