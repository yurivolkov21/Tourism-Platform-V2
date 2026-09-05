import { parseCommaList, parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults on empty input', () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toContain('postgresql://');
  });

  it('coerces PORT from string', () => {
    expect(parseEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/Invalid environment/);
  });

  it('rejects non-postgres DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://nope' })).toThrow(/DATABASE_URL/);
  });

  it('defaults Better Auth fields outside production', () => {
    const env = parseEnv({});
    expect(env.BETTER_AUTH_SECRET).toBe('dev-secret-change-me');
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:3001');
    expect(env.ADMIN_EMAILS).toBe('admin@tourism.test');
    expect(env.TRUSTED_ORIGINS).toBe('http://localhost:3000,http://localhost:3002');
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });

  it('requires a real BETTER_AUTH_SECRET in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      parseEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'dev-secret-change-me' }),
    ).toThrow(/BETTER_AUTH_SECRET/);
    expect(
      parseEnv({
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'real-secret',
        // P2: prod cũng cần một payment provider, và DATABASE_URL tường minh —
        // thoả cả hai để cô lập assertion về BETTER_AUTH_SECRET. P3a: thêm cả
        // NEWSLETTER_UNSUBSCRIBE_SECRET (guard production riêng, cùng khuôn).
        // P3a-C: thêm CLOUDINARY_CLOUD_NAME (guard production cho media).
        // on-demand revalidation: thêm REVALIDATE_SECRET (cùng khuôn).
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        NEWSLETTER_UNSUBSCRIBE_SECRET: 'real-unsubscribe-secret',
        CLOUDINARY_CLOUD_NAME: 'real-cloud-name',
        REVALIDATE_SECRET: 'real-revalidate-secret',
        RESEND_API_KEY: 're_test_x',
      }).BETTER_AUTH_SECRET,
    ).toBe('real-secret');
  });

  it('requires an explicit DATABASE_URL in production', () => {
    // Prod đầy đủ mọi thứ KHÁC, chỉ thiếu DATABASE_URL → phải chết ở config,
    // không được im lặng nhận default localhost rồi chết ở tầng kết nối.
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'real-secret',
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      NEWSLETTER_UNSUBSCRIBE_SECRET: 'real-unsubscribe-secret',
      CLOUDINARY_CLOUD_NAME: 'real-cloud-name',
      REVALIDATE_SECRET: 'real-revalidate-secret',
    };
    expect(() => parseEnv(base)).toThrow(/DATABASE_URL/);
    // Khai tường minh trùng chuỗi compose cũng bị chặn — đó vẫn là localhost.
    expect(() =>
      parseEnv({ ...base, DATABASE_URL: 'postgresql://tourism:tourism@localhost:5432/tourism' }),
    ).toThrow(/DATABASE_URL/);
    // Có URL thật → qua.
    expect(
      parseEnv({
        ...base,
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
        RESEND_API_KEY: 're_test_x',
      }).DATABASE_URL,
    ).toBe('postgresql://u:p@db.example.com:5432/app');
  });

  it('treats an empty value as unset (KEY= behaves like no KEY line)', () => {
    // .env sinh ra chuỗi rỗng chứ không phải undefined; nếu không xử lý,
    // copy .env.example rồi để trống các biến optional là app không boot.
    const env = parseEnv({
      BETTER_AUTH_SECRET: '',
      STRIPE_SECRET_KEY: '',
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
    });
    expect(env.BETTER_AUTH_SECRET).toBe('dev-secret-change-me'); // default áp dụng
    expect(env.STRIPE_SECRET_KEY).toBeUndefined(); // optional vẫn undefined
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBe('Nexora <noreply@tourism.test>');
    // Và ở production, DATABASE_URL rỗng vẫn phải bị chặn (rơi về default
    // localhost rồi bị guard bắt) — không được lọt qua vì đã bị strip.
    expect(() => parseEnv({ NODE_ENV: 'production', DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('rejects invalid BETTER_AUTH_URL', () => {
    expect(() => parseEnv({ BETTER_AUTH_URL: 'not a url' })).toThrow(/BETTER_AUTH_URL/);
  });

  it('defaults NEWSLETTER_UNSUBSCRIBE_SECRET outside production', () => {
    expect(parseEnv({}).NEWSLETTER_UNSUBSCRIBE_SECRET).toBe('dev-unsubscribe-secret-change-me');
  });

  it('requires a real NEWSLETTER_UNSUBSCRIBE_SECRET in production', () => {
    // Cùng khuôn với BETTER_AUTH_SECRET: hai secret có hai vòng đời khác
    // nhau (session vs. link huỷ đăng ký đã gửi đi) nên guard cũng riêng.
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'real-secret',
      DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      CLOUDINARY_CLOUD_NAME: 'real-cloud-name',
      REVALIDATE_SECRET: 'real-revalidate-secret',
    };
    expect(() => parseEnv(base)).toThrow(/NEWSLETTER_UNSUBSCRIBE_SECRET/);
    expect(() =>
      parseEnv({
        ...base,
        NEWSLETTER_UNSUBSCRIBE_SECRET: 'dev-unsubscribe-secret-change-me',
      }),
    ).toThrow(/NEWSLETTER_UNSUBSCRIBE_SECRET/);
    expect(
      parseEnv({
        ...base,
        NEWSLETTER_UNSUBSCRIBE_SECRET: 'real-unsubscribe-secret',
        RESEND_API_KEY: 're_test_x',
      }).NEWSLETTER_UNSUBSCRIBE_SECRET,
    ).toBe('real-unsubscribe-secret');
  });

  it('defaults REVALIDATE_SECRET outside production', () => {
    expect(parseEnv({}).REVALIDATE_SECRET).toBe('dev-revalidate-secret-change-me');
  });

  it('requires a real REVALIDATE_SECRET in production', () => {
    // Cùng khuôn với NEWSLETTER_UNSUBSCRIBE_SECRET: guard production riêng
    // cho secret header route /api/revalidate phía web.
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'real-secret',
      DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      NEWSLETTER_UNSUBSCRIBE_SECRET: 'real-unsubscribe-secret',
      CLOUDINARY_CLOUD_NAME: 'real-cloud-name',
    };
    expect(() => parseEnv(base)).toThrow(/REVALIDATE_SECRET/);
    expect(() =>
      parseEnv({
        ...base,
        REVALIDATE_SECRET: 'dev-revalidate-secret-change-me',
      }),
    ).toThrow(/REVALIDATE_SECRET/);
    expect(
      parseEnv({
        ...base,
        REVALIDATE_SECRET: 'real-revalidate-secret',
        RESEND_API_KEY: 're_test_x',
      }).REVALIDATE_SECRET,
    ).toBe('real-revalidate-secret');
  });

  it('defaults CLOUDINARY_CLOUD_NAME outside production', () => {
    // Giá trị công khai (không phải secret), dùng để dựng URL delivery ảnh.
    // Ngoài production: default thành 'demo' (fixture Cloudinary công cộng để
    // test). Dev/test không cần set.
    expect(parseEnv({}).CLOUDINARY_CLOUD_NAME).toBe('demo');
  });

  it('requires a real CLOUDINARY_CLOUD_NAME in production', () => {
    // Cùng khuôn với NEWSLETTER_UNSUBSCRIBE_SECRET: guard production riêng
    // vì URL ảnh sẽ bị dùng 'demo' cloud nếu quên set. Đó là UX degradation,
    // không bảo mật, nhưng vẫn phải chặn.
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'real-secret',
      DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      NEWSLETTER_UNSUBSCRIBE_SECRET: 'real-unsubscribe-secret',
      REVALIDATE_SECRET: 'real-revalidate-secret',
    };
    // Không set CLOUDINARY_CLOUD_NAME → default 'demo' → bị guard chặn
    expect(() => parseEnv(base)).toThrow(/CLOUDINARY_CLOUD_NAME/);
    // Set thành 'demo' rõ ràng cũng bị chặn
    expect(() => parseEnv({ ...base, CLOUDINARY_CLOUD_NAME: 'demo' })).toThrow(
      /CLOUDINARY_CLOUD_NAME/,
    );
    // Set thành giá trị thật → qua
    expect(
      parseEnv({
        ...base,
        CLOUDINARY_CLOUD_NAME: 'real-cloud-name',
        RESEND_API_KEY: 're_test_x',
      }).CLOUDINARY_CLOUD_NAME,
    ).toBe('real-cloud-name');
  });

  it('defaults P2 provider vars to unset (dev boots with no payment/email keys)', () => {
    const env = parseEnv({});
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.STRIPE_WEBHOOK_SECRET).toBeUndefined();
    expect(env.PAYPAL_CLIENT_ID).toBeUndefined();
    expect(env.PAYPAL_CLIENT_SECRET).toBeUndefined();
    expect(env.PAYPAL_WEBHOOK_ID).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBe('Nexora <noreply@tourism.test>');
  });

  it('requires at least one FULL payment provider config in production', () => {
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'real-secret',
      DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
      NEWSLETTER_UNSUBSCRIBE_SECRET: 'real-unsubscribe-secret',
      CLOUDINARY_CLOUD_NAME: 'real-cloud-name',
      REVALIDATE_SECRET: 'real-revalidate-secret',
    };
    // None configured → rejected.
    expect(() => parseEnv(base)).toThrow(/payment provider/i);
    // Half a pair does not count.
    expect(() => parseEnv({ ...base, STRIPE_SECRET_KEY: 'sk_test_x' })).toThrow(
      /payment provider/i,
    );
    expect(() =>
      parseEnv({ ...base, PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret' }),
    ).toThrow(/payment provider/i);
    // A full Stripe pair suffices.
    expect(
      parseEnv({
        ...base,
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        RESEND_API_KEY: 're_test_x',
      }).STRIPE_SECRET_KEY,
    ).toBe('sk_test_x');
    // A full PayPal trio suffices.
    expect(
      parseEnv({
        ...base,
        PAYPAL_CLIENT_ID: 'id',
        PAYPAL_CLIENT_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'wh-1',
        RESEND_API_KEY: 're_test_x',
      }).PAYPAL_WEBHOOK_ID,
    ).toBe('wh-1');
  });

  it('rejects half a Cloudinary upload credential pair, in EVERY environment', () => {
    // Ký upload cần CẢ api_key lẫn api_secret. Nửa bộ hỏng ÂM THẦM — app vẫn
    // boot, chỉ tới lúc bấm upload mới lộ — nên guard này KHÔNG gate theo
    // production, khác các guard prod-critical bên dưới.
    expect(() => parseEnv({ CLOUDINARY_API_KEY: 'k' })).toThrow(/pair/i);
    expect(() => parseEnv({ CLOUDINARY_API_SECRET: 's' })).toThrow(/pair/i);
    // Đủ cặp → qua, và không kéo theo yêu cầu nào khác ở dev.
    expect(
      parseEnv({ CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }).CLOUDINARY_API_KEY,
    ).toBe('k');
    // Không khai gì cả vẫn là cấu hình hợp lệ: đọc ảnh không cần credential.
    const bare = parseEnv({});
    expect(bare.CLOUDINARY_API_KEY).toBeUndefined();
    expect(bare.CLOUDINARY_API_SECRET).toBeUndefined();
    // Thư mục đích có default để asset dev không rơi vào thư mục gốc.
    expect(bare.CLOUDINARY_UPLOAD_FOLDER).toBe('tourism');
    // `KEY=` (chuỗi rỗng) phải hành xử giống bỏ hẳn dòng — nếu không, một ô
    // bỏ trống trên dashboard sẽ bị tính là "đã khai một nửa" và chặn boot.
    expect(() => parseEnv({ CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '' })).not.toThrow();
  });

  it('requires RESEND_API_KEY in production (INF-R1: else email silently dropped)', () => {
    // Mọi var prod-critical khác đều có guard; RESEND từng thiếu → deploy sót key
    // thì worker KHÔNG bind ResendDeliverer, email transactional im lặng rớt mà
    // vẫn được đánh dấu SENT. Guard prod cùng khuôn với các var khác.
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'real-secret',
      DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      NEWSLETTER_UNSUBSCRIBE_SECRET: 'real-unsubscribe-secret',
      CLOUDINARY_CLOUD_NAME: 'real-cloud-name',
      REVALIDATE_SECRET: 'real-revalidate-secret',
    };
    // Thiếu RESEND_API_KEY → chặn ngay ở boot.
    expect(() => parseEnv(base)).toThrow(/RESEND_API_KEY/);
    // Chuỗi rỗng (KEY=) bị strip về unset → cũng bị chặn.
    expect(() => parseEnv({ ...base, RESEND_API_KEY: '' })).toThrow(/RESEND_API_KEY/);
    // Có key thật → qua.
    expect(parseEnv({ ...base, RESEND_API_KEY: 're_live_x' }).RESEND_API_KEY).toBe('re_live_x');
  });

  it('rejects ADMIN_EMAILS that parses to an empty list, in ANY environment', () => {
    // Bug đã suýt lọt: " " hoặc "," không phải chuỗi rỗng CHÍNH XÁC nên
    // `cleaned` (strip `v !== ''`) không strip, `.default()` không kích
    // hoạt — nhưng `parseCommaList` lại lọc sạch, để `adminEmails = []` và
    // `adminEmails[0]` (dùng làm `to` của ENQUIRY_ADMIN_ALERT) là undefined.
    // Guard phải chặn NGAY ở boot, không chỉ ở production.
    expect(() => parseEnv({ ADMIN_EMAILS: ' ' })).toThrow(/ADMIN_EMAILS/);
    expect(() => parseEnv({ ADMIN_EMAILS: ',' })).toThrow(/ADMIN_EMAILS/);
    expect(() => parseEnv({ ADMIN_EMAILS: ',,' })).toThrow(/ADMIN_EMAILS/);
  });

  it('accepts Google OAuth pair when provided', () => {
    const env = parseEnv({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
    expect(env.GOOGLE_CLIENT_ID).toBe('id');
    expect(env.GOOGLE_CLIENT_SECRET).toBe('secret');
  });
});

describe('parseCommaList', () => {
  it('splits, trims and drops empties', () => {
    expect(parseCommaList(' a@x.io , b@y.io ,, ')).toEqual(['a@x.io', 'b@y.io']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCommaList('')).toEqual([]);
  });
});
// Deploy v1 (ADR-0024): hai khoá mới của bước chuẩn bị prod.
describe('COOKIE_DOMAIN / WORKER_INLINE', () => {
  it('mặc định: COOKIE_DOMAIN undefined, WORKER_INLINE false', () => {
    const cfg = parseEnv({});
    expect(cfg.COOKIE_DOMAIN).toBeUndefined();
    expect(cfg.WORKER_INLINE).toBe(false);
  });

  it("WORKER_INLINE='true' → boolean true; giá trị lạ → ném (không im lặng coi là false)", () => {
    expect(parseEnv({ WORKER_INLINE: 'true' }).WORKER_INLINE).toBe(true);
    expect(parseEnv({ WORKER_INLINE: 'false' }).WORKER_INLINE).toBe(false);
    expect(() => parseEnv({ WORKER_INLINE: 'yes' })).toThrow();
  });

  it('COOKIE_DOMAIN rỗng (KEY=) coi như unset — cùng luật strip chuỗi rỗng', () => {
    expect(parseEnv({ COOKIE_DOMAIN: '' }).COOKIE_DOMAIN).toBeUndefined();
    expect(parseEnv({ COOKIE_DOMAIN: '.nexora-travel.agency' }).COOKIE_DOMAIN).toBe(
      '.nexora-travel.agency',
    );
  });

  it('bộ dọn media MẶC ĐỊNH TẮT — lưới an toàn quan trọng nhất của ADR-0035', () => {
    // Dev và prod dùng chung một Cloudinary cloud: bật nhầm ở máy dev là
    // destroy ảnh của site đang sống.
    expect(parseEnv({}).MEDIA_GC_ENABLED).toBe(false);
    expect(parseEnv({ MEDIA_GC_ENABLED: 'true' }).MEDIA_GC_ENABLED).toBe(true);
    // Chuỗi lạ KHÔNG được âm thầm hoá thành true — enum chặn ở boot.
    expect(() => parseEnv({ MEDIA_GC_ENABLED: '1' })).toThrow();
    expect(() => parseEnv({ MEDIA_GC_ENABLED: 'yes' })).toThrow();
  });

  it('hạn chờ mặc định 7 ngày, và KHÔNG cho khai 0', () => {
    // 0 nghĩa là xoá-ngay-lập-tức, tức bỏ trọn lưới an toàn — muốn thế thì
    // sửa code chứ không gõ một con số vào env.
    expect(parseEnv({}).MEDIA_GC_GRACE_DAYS).toBe(7);
    expect(parseEnv({ MEDIA_GC_GRACE_DAYS: '14' }).MEDIA_GC_GRACE_DAYS).toBe(14);
    expect(() => parseEnv({ MEDIA_GC_GRACE_DAYS: '0' })).toThrow();
    expect(() => parseEnv({ MEDIA_GC_GRACE_DAYS: '-1' })).toThrow();
  });
});
