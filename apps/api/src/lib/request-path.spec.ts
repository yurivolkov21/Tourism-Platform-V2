import { isAdminSurfacePath, routingPath } from './request-path.js';

/**
 * Review F1-01: Fastify (find-my-way) giải mã percent-encoding của path TRƯỚC
 * khi khớp route, còn `req.url` là chuỗi thô. Mọi phép so path ở tầng HTTP
 * phải nhìn đúng path mà router nhìn, không thì `/api/%61dmin/...` tới được
 * handler admin mà CORS, chặn cross-site và tầng throttle admin không nhận ra.
 */
describe('routingPath', () => {
  it('bỏ query như router', () => {
    expect(routingPath('/api/admin/bookings?x=1')).toBe('/api/admin/bookings');
  });

  it('bỏ fragment như router (`#` cũng kết thúc path)', () => {
    expect(routingPath('/api/auth/sign-in/email#1')).toBe('/api/auth/sign-in/email');
  });

  it('giải mã percent-encoding của ký tự thường như router', () => {
    expect(routingPath('/api/%61dmin/bookings')).toBe('/api/admin/bookings');
    expect(routingPath('/api/webhooks/csp-r%65port')).toBe('/api/webhooks/csp-report');
  });

  it('giữ nguyên ký tự dành riêng đã mã hoá (%2F, %3F) như router', () => {
    expect(routingPath('/api/admin%2Fbookings')).toBe('/api/admin%2Fbookings');
    expect(routingPath('/api/admin/bookings%3Fx')).toBe('/api/admin/bookings%3Fx');
  });

  it('không giải mã hai lần: `%25` giữ nguyên như router', () => {
    expect(routingPath('/api/%2561dmin/bookings')).toBe('/api/%2561dmin/bookings');
  });

  it('chuỗi mã hoá hỏng thì trả path thô, không ném (router trả 400 cho nó)', () => {
    expect(routingPath('/api/%E0%A4%A/x?y')).toBe('/api/%E0%A4%A/x');
  });

  it('url vắng thì là chuỗi rỗng', () => {
    expect(routingPath(undefined)).toBe('');
  });
});

describe('isAdminSurfacePath', () => {
  it.each([
    '/api/admin',
    '/api/admin/bookings',
    '/api/admin?x=1',
    '/api/%61dmin/bookings',
    '/api/adm%69n',
  ])('%s là vùng admin', (url) => {
    expect(isAdminSurfacePath(url)).toBe(true);
  });

  it.each(['/api/administrator', '/api/adminx/bookings', '/api/tours', '/api/%2561dmin/bookings'])(
    '%s không phải vùng admin',
    (url) => {
      expect(isAdminSurfacePath(url)).toBe(false);
    },
  );
});
