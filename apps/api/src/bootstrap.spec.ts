import Fastify from 'fastify';
import { trustProxy } from './config/env.js';

/**
 * Luật `trustProxy` của adapter (bootstrap.ts) — pin bằng một Fastify trần
 * (không Nest, không DB): vòng vá Dependabot 03/09 đổi từ hop-count `1`
 * (fastify 5.12.1 bỏ hẳn vì spoof được) sang danh sách địa chỉ proxy. Hai
 * điều phải đúng và không ai canh ở tầng khác:
 *
 * 1. Proxy nền tảng (địa chỉ NỘI BỘ) forward → `req.ip` là IP khách thật
 *    trong `X-Forwarded-For` (rate limit đếm đúng người).
 * 2. Client nối THẲNG từ IP công khai mà tự gửi `X-Forwarded-For` → header
 *    bị bỏ qua, `req.ip` là địa chỉ socket — throttle không bypass được.
 */
async function ipSeenBy(remoteAddress: string, forwardedFor: string): Promise<string> {
  const app = Fastify({ trustProxy });
  app.get('/ip', (request) => ({ ip: request.ip }));
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress,
      headers: { 'x-forwarded-for': forwardedFor },
    });
    return (res.json() as { ip: string }).ip;
  } finally {
    await app.close();
  }
}

describe('trustProxy (bootstrap)', () => {
  it('mặc định là danh sách dải nội bộ, không phải true và không phải hop-count', () => {
    expect(trustProxy).toBe('loopback,linklocal,uniquelocal');
  });

  it('proxy nội bộ (10.x / 127.x) forward → req.ip là IP khách trong X-Forwarded-For', async () => {
    expect(await ipSeenBy('10.0.0.5', '198.51.100.7')).toBe('198.51.100.7');
    expect(await ipSeenBy('127.0.0.1', '198.51.100.7')).toBe('198.51.100.7');
  });

  it('chuỗi proxy nội bộ nhiều hop → dừng ở địa chỉ công khai đầu tiên tính từ phải', async () => {
    expect(await ipSeenBy('10.0.0.5', '203.0.113.9, 198.51.100.7, 192.168.1.1')).toBe(
      '198.51.100.7',
    );
  });

  it('client nối THẲNG từ IP công khai tự gửi X-Forwarded-For → bị bỏ qua, req.ip là socket', async () => {
    expect(await ipSeenBy('203.0.113.9', '198.51.100.7')).toBe('203.0.113.9');
  });
});
