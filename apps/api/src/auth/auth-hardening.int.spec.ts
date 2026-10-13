import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { prisma } from './auth.config.js';

/**
 * W2 mục 3 (ADR-0017 §7c + ADR-0037): hardening bề mặt /api/auth/*.
 *
 * - `check-verification-otp` là route BA không app nào của ta gọi nhưng vẫn
 *   mount, và nó phân biệt USER_NOT_FOUND ≠ INVALID_OTP — user enumeration
 *   không cần biết mã. Chuẩn hoá tại mount: mọi 400 của đúng path này trả
 *   cùng một body INVALID_OTP.
 * - Trần Nest riêng cho AuthController (AUTH_THROTTLE): chỉ đếm non-GET —
 *   GET get-session đi từ SSR của web qua egress IP DÙNG CHUNG (Vercel),
 *   đếm nó theo IP là tự khoá site.
 */

const PASSWORD = 'password-123';

/** Khớp `GOOGLE_CLIENT_ID` giả ở `vitest.int.config.ts`. */
const INT_GOOGLE_CLIENT_ID = 'int-test-web.apps.googleusercontent.com';

describe('auth hardening: enumeration + trần riêng (W2 mục 3)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, outbox CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function checkOtp(email: string) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/check-verification-otp',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, otp: '000000', type: 'email-verification' }),
    });
  }

  it('1. check-verification-otp bị TẮT (disabledPaths): email có thật hay không đều 404 — hết oracle ở cả 400 lẫn 403', async () => {
    // Bản đầu chuẩn hoá body 400 tại mount; nhưng BA trả 403 TOO_MANY_ATTEMPTS
    // CHỈ khi user tồn tại (5 mã sai) → oracle còn nguyên. Route không app
    // nào gọi → tắt hẳn ở đúng tầng (ADR-0017 §7c, vòng vá review W2).
    // User có thật, có mã OTP đang chờ (signup phát OTP qua sendOnSignUp).
    const su = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: 'enum-real@example.com', password: PASSWORD, name: 'E' },
    });
    expect(su.statusCode).toBe(200);

    const missing = await checkOtp('enum-ghost@example.com');
    const wrongOtp = await checkOtp('enum-real@example.com');

    expect(missing.statusCode).toBe(404);
    expect(wrongOtp.statusCode).toBe(404);
    // Body PHẢI giống hệt — khác một chữ là kẻ dò phân biệt được hai thế giới.
    expect(missing.body).toBe(wrongOtp.body);
    expect(missing.body).not.toContain('USER_NOT_FOUND');
    // 5 mã sai liên tiếp trên email thật cũng KHÔNG mở ra 403 nào.
    for (let i = 0; i < 6; i++)
      expect((await checkOtp('enum-real@example.com')).statusCode).toBe(404);
    // Đường web dùng (`verify-email`) vẫn sống.
    const verify = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/verify-email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'enum-real@example.com', otp: '000000' }),
    });
    expect(verify.statusCode).not.toBe(404);
  });

  it('2. trần AuthController: non-GET từ IP công khai vượt AUTH_THROTTLE → 429; GET và loopback KHÔNG bị đếm', async () => {
    // 60 lượt POST đầu trong cửa sổ được đi qua (status gì cũng được — sai
    // mật khẩu là 401 của BA); lượt 61 phải chạm trần Nest. remoteAddress
    // công khai: loopback được miễn có chủ đích (int/e2e/smoke chạy cùng
    // máy — xem WriteOnlyThrottlerGuard).
    // ĐỦ 60 lượt đầu KHÔNG 429 (canh đúng con số trần, không chỉ "có 429"),
    // lượt 61 mới chạm.
    for (let i = 0; i < 60; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        remoteAddress: '203.0.113.9',
        payload: { email: 'nobody@example.com', password: 'x'.repeat(10) },
      });
      expect(res.statusCode).not.toBe(429);
    }
    const over = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      remoteAddress: '203.0.113.9',
      payload: { email: 'nobody@example.com', password: 'x'.repeat(10) },
    });
    expect(over.statusCode).toBe(429);

    // Bucket theo TỪNG PATH (ADR-0037 AMEND 1): sign-in đầy không kéo theo
    // sign-out/sign-up của cùng IP — CGNAT không bị khoá cả cụm auth.
    const otherPath = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      remoteAddress: '203.0.113.9',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(otherPath.statusCode).not.toBe(429);

    // GET không đếm và không bị bucket POST đã đầy làm liên luỵ — cùng IP.
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      remoteAddress: '203.0.113.9',
    });
    expect(session.statusCode).toBe(200);

    // Loopback (mặc định của inject) không bị đếm — bucket công khai đã đầy
    // nhưng máy-nhà vẫn POST được.
    const local = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'nobody@example.com', password: 'x'.repeat(10) },
    });
    expect(local.statusCode).not.toBe(429);

    // XFF tự xưng loopback từ IP công khai KHÔNG lách được: miễn-loopback đo
    // bằng địa chỉ SOCKET thô, header không có tiếng nói (review 06/09).
    const spoofed = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      remoteAddress: '203.0.113.9',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      payload: { email: 'nobody@example.com', password: 'x'.repeat(10) },
    });
    expect(spoofed.statusCode).toBe(429);
  });

  it('3. expo-authorization-proxy ĐÓNG ở mọi môi trường (ADR-0056 §3): cả URL Google hợp lệ cũng 400, không redirect, không đặt cookie state', async () => {
    // Chốt §11 cũ cho qua đúng URL này (đúng endpoint, client_id, callback) —
    // chính nó chở `state` do kẻ tấn công chọn vào trình duyệt nạn nhân.
    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleUrl.searchParams.set('response_type', 'code');
    googleUrl.searchParams.set('client_id', INT_GOOGLE_CLIENT_ID);
    googleUrl.searchParams.set('state', 'abc');
    googleUrl.searchParams.set('scope', 'email profile openid');
    googleUrl.searchParams.set('redirect_uri', 'http://localhost:3001/api/auth/callback/google');
    for (const authorizationURL of [googleUrl.toString(), 'https://evil.example/phish?state=abc']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/auth/expo-authorization-proxy?authorizationURL=${encodeURIComponent(
          authorizationURL,
        )}&oauthState=abc`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers.location).toBeUndefined();
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('4. sign-in/social không có idToken mà callbackURL là deep link (nexora://, exp://) → 400 (ADR-0056 §3, khoá thứ hai)', async () => {
    // exp:// là origin tin cậy ở development (plugin expo tự thêm). Better Auth
    // tắt lớp kiểm Origin khi chạy test (isTest), nên thiếu khoá này cả hai
    // request đi tiếp 200 và đặt cookie state — đã đo bằng cách tạm nới khoá.
    for (const callbackURL of ['nexora://x', 'exp://192.168.1.10:8081/--/x']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/social',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ provider: 'google', callbackURL }),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ message: 'Invalid callbackURL' });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('5. nhánh ID token không bị hai khoá mới chặn: token rác → 401 của Better Auth, không cookie', async () => {
    // Không cookie, không Origin — đúng request app mobile gửi. 401
    // INVALID_TOKEN nghĩa là request đã tới tận bước kiểm chữ ký của provider.
    // Lớp kiểm Origin của Better Auth tắt khi chạy test (isTest), nên ca này
    // không nói gì về nó; đường production đã thử trên điện thoại thật 13/10.
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        provider: 'google',
        callbackURL: 'nexora://x',
        idToken: { token: 'not-a-jwt' },
      }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'INVALID_TOKEN' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('6. luồng redirect của web vẫn chạy: sign-in/social với callbackURL https của web trả URL Google', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      payload: JSON.stringify({ provider: 'google', callbackURL: 'http://localhost:3000/account' }),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { url: string; redirect: boolean };
    expect(body.redirect).toBe(true);
    const url = new URL(body.url);
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    // Phần tử ĐẦU của mảng clientId là client web (getPrimaryClientId).
    expect(url.searchParams.get('client_id')).toBe(INT_GOOGLE_CLIENT_ID);
  });

  it('7. email dài hơn 254 ký tự (trần RFC 5321) → 400 INVALID_EMAIL, không tạo user; đúng 254 vẫn đăng ký được', async () => {
    // `z.email()` của BA không trần, cột citext cũng không: thiếu hook thì một người chưa
    // đăng nhập ghi được email vài trăm ký tự vào `users` (review P4f).
    const domain = '@example.com';
    const atLimit = `${'a'.repeat(254 - domain.length)}${domain}`;
    const tooLong = `b${atLimit}`;
    const signUp = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name: 'Long Email' },
      });

    const rejected = await signUp(tooLong);
    expect(rejected.statusCode).toBe(400);
    // Đúng mã BA dùng cho email sai: form web và app hiện lỗi ngay dưới ô email.
    expect(rejected.json()).toMatchObject({ code: 'INVALID_EMAIL' });
    expect(await prisma.user.count({ where: { email: tooLong } })).toBe(0);

    expect((await signUp(atLimit)).statusCode).toBe(200);
    expect(await prisma.user.count({ where: { email: atLimit } })).toBe(1);
  });
});
