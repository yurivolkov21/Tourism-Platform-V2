import { z } from 'zod';

/**
 * Dev-only Better Auth secret. `superRefine` dưới đây chặn giá trị này ở
 * production — prod PHẢI set BETTER_AUTH_SECRET thật qua env.
 */
const DEV_BETTER_AUTH_SECRET = 'dev-secret-change-me';

/**
 * Dev-only secret ký link huỷ đăng ký newsletter (spec §4.4). Cố ý TÁCH khỏi
 * `DEV_BETTER_AUTH_SECRET`: xoay `BETTER_AUTH_SECRET` là việc bảo mật bình
 * thường (session), nhưng nó sẽ làm chết mọi link huỷ đăng ký đã gửi đi nếu
 * hai secret dùng chung — hai vòng đời khác nhau thì tách secret.
 */
const DEV_UNSUBSCRIBE_SECRET = 'dev-unsubscribe-secret-change-me';

/**
 * Dev-only secret cho route `/api/revalidate` phía web (on-demand
 * revalidation, ADR-0016 §3). Dùng CHUNG chuỗi default với phía web để dev
 * chạy liền không cần khai env gì thêm; production PHẢI đổi (superRefine
 * dưới đây chặn).
 */
const DEV_REVALIDATE_SECRET = 'dev-revalidate-secret-change-me';

/**
 * Postgres compose local. Là default để `pnpm dev`/seed/test chạy được ngay
 * không cần `.env`; `superRefine` dưới đây chặn nó ở production — deploy mà
 * quên set DATABASE_URL thì phải chết ở tầng config với thông điệp rõ ràng,
 * chứ không phải im lặng đi quay số localhost rồi chết ở tầng kết nối.
 */
const LOCAL_COMPOSE_DATABASE_URL = 'postgresql://tourism:tourism@localhost:5432/tourism';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    // Mặc định trỏ compose Postgres local — prod PHẢI override qua env thật.
    DATABASE_URL: z.string().startsWith('postgres').default(LOCAL_COMPOSE_DATABASE_URL),
    // Better Auth — secret ký session token + baseURL public của API.
    BETTER_AUTH_SECRET: z.string().min(1).default(DEV_BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: z.url().default('http://localhost:3001'),
    // Bootstrap admin dual-grant (comma list, case-insensitive) — hook
    // user.create.after promote lên ADMIN; không bao giờ demote.
    ADMIN_EMAILS: z.string().default('admin@tourism.test'),
    // Origin được phép gọi Better Auth (CSRF) — mặc định web (3000) + admin (3002).
    TRUSTED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3002'),
    // W2 (ADR-0026 AMEND 1 §B): origin được browser gọi API cross-origin
    // (CORS) — TÁCH khỏi TRUSTED_ORIGINS (câu hỏi CSRF của Better Auth).
    // Không set thì rơi về TRUSTED_ORIGINS (deploy hiện tại không đổi hành
    // vi); /api/admin/* thì KHÔNG phát CORS cho origin nào bất kể danh sách
    // này — xem configureHttp.
    CORS_ORIGINS: z.string().min(1).optional(),
    // Proxy nào được tin `X-Forwarded-*` (03/09, fastify 5.12.1 bỏ dạng
    // hop-count vì spoof được — GHSA-3m5p-2c4r-xxw2). Danh sách IP/CIDR hoặc
    // tên dải của @fastify/proxy-addr: mặc định tin MỌI hop từ địa chỉ NỘI
    // BỘ (loopback + link-local + RFC1918/fc00::/7 — ingress Render/Railway
    // nối vào service qua mạng riêng) và dừng ở địa chỉ công khai đầu tiên
    // = IP khách thật. Nền tảng nào proxy nối từ IP công khai thì set IP đó.
    TRUST_PROXY: z.string().min(1).default('loopback,linklocal,uniquelocal'),
    // W4 R1 (vòng vá review W4, ADR-0037 AMEND 2): trần ĐỌC công khai theo IP
    // chạy ở chế độ `log` (đếm + warn, KHÔNG 429) cho tới khi `req.ip` trên
    // Render được ĐO thật (TRUST_PROXY/XFF — nợ W2): sai một cái là cả
    // internet chung một bucket 300/phút, và build Vercel gọi ~100–300 GET
    // từ một IP. Chuyển `enforce` bằng env sau khi đo, không sửa code.
    PUBLIC_READ_THROTTLE_MODE: z.enum(['log', 'enforce']).default('log'),
    // Khoá server-to-server cho đường ĐỌC của web SSR/build (header
    // `x-internal-read-key`): khớp là miễn bucket đọc theo IP — prerender
    // 61 route × 2–6 call từ một egress IP không phải là "một khách". Chỉ
    // miễn ĐỌC, không miễn ghi. Optional: thiếu thì không ai được miễn.
    INTERNAL_READ_KEY: z.string().min(16).optional(),
    // Base URL của web app (P3) — đích redirect success/cancel cho checkout
    // session (P2 W1). Prod PHẢI set domain thật.
    FRONTEND_URL: z.url().default('http://localhost:3000'),
    // Deploy v1 (ADR-0024): web + API dưới CÙNG registrable domain → cookie
    // session phải mang `domain` cha (vd `.nexora-travel.agency`) để đi kèm
    // fetch từ `www.` sang `api.`. Chỉ set ở prod; dev same-site không cần —
    // auth.config chỉ bật crossSubDomainCookies khi biến này có giá trị.
    COOKIE_DOMAIN: z.string().min(1).optional(),
    // Render free không có Background Worker: 'true' → main.ts khởi động vòng
    // worker (pg-boss: outbox drain/purge + booking sweep) TRONG CÙNG tiến
    // trình API. Có worker riêng thì bỏ trống và deploy dist/worker.js như cũ.
    WORKER_INLINE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    // Google OAuth — optional; auth.config chỉ bật socialProviders.google khi có ĐỦ cặp.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    // Payment providers (P2 W5) — đều optional ở dev/test; payments.module chỉ
    // đăng ký gateway khi ĐỦ bộ (Stripe: cặp key+webhook secret; PayPal: trio
    // client id/secret + webhook id). Thiếu bộ → webhook/create của provider
    // đó 404 (behavior sẵn có của resolveGateway).
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    PAYPAL_CLIENT_ID: z.string().min(1).optional(),
    PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
    PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
    // Email (P2 W5) — RESEND_API_KEY set → worker bind ResendDeliverer, không
    // set → giữ ConsoleDeliverer (dev boots không cần email, pattern Nexora).
    RESEND_API_KEY: z.string().min(1).optional(),
    // W4 E6 (ADR-0039 §4): secret verify webhook Resend (svix, dạng
    // `whsec_…`). Optional MỌI môi trường — thiếu thì endpoint
    // /api/webhooks/resend trả 503 + một dòng log lúc boot, KHÔNG chặn boot
    // (dev không cần tài khoản Resend; suppression khi đó không được ghi).
    RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).default('Nexora <noreply@tourism.test>'),
    // Observability (ADR-0010) — SENTRY_DSN set → captureException đẩy lỗi 500
    // lên Sentry; không set → no-op (interim: Logger.error → platform stdout).
    // Optional mọi env: capstone chưa provision DSN. Cài @sentry/node là follow-up.
    SENTRY_DSN: z.string().min(1).optional(),
    // Newsletter unsubscribe (P3a spec §4.4) — ký/verify token HMAC tự xác
    // thực, KHÔNG dùng chung BETTER_AUTH_SECRET (xem comment ở
    // DEV_UNSUBSCRIBE_SECRET). Optional-với-default ở dev/test, bắt buộc
    // production qua superRefine bên dưới.
    NEWSLETTER_UNSUBSCRIBE_SECRET: z.string().min(1).default(DEV_UNSUBSCRIBE_SECRET),
    // Secret header cho route /api/revalidate phía web (on-demand
    // revalidation, ADR-0016 §3) — đích web dùng lại FRONTEND_URL sẵn có,
    // KHÔNG thêm WEB_URL (AMENDED spec §4). Optional-với-default ở dev/test,
    // bắt buộc production qua superRefine bên dưới.
    REVALIDATE_SECRET: z.string().min(1).default(DEV_REVALIDATE_SECRET),
    // Cloud name Cloudinary — GIÁ TRỊ CÔNG KHAI (không phải secret upload),
    // chỉ để dựng URL delivery đọc (ADR-0005). Default dev; prod PHẢI set thật
    // qua superRefine bên dưới, nếu không URL ảnh sẽ trỏ cloud 'demo' hỏng.
    CLOUDINARY_CLOUD_NAME: z.string().min(1).default('demo'),
    // Bộ SECRET để KÝ upload (khác hẳn CLOUDINARY_CLOUD_NAME ở trên, vốn công
    // khai). Chỉ tầng upload P4 cần; optional để dev/test không phải có tài
    // khoản Cloudinary mới boot được. Đi theo CẶP — xem superRefine bên dưới.
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    // Thư mục đích trên Cloudinary. Có default để asset dev không rơi thẳng
    // vào thư mục gốc rồi lẫn với tài khoản khác đang dùng chung cloud.
    CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default('tourism'),
    // ── Tỉ lệ tài chính cho báo cáo tháng (ADR-0033 §5, §6) ──
    // Mặc định 0 = tắt sạch: một dự án chưa khai thuế vẫn cho ra báo cáo
    // ĐÚNG, chỉ là dòng thuế bằng 0. Đây là mặc định an toàn duy nhất —
    // đoán một thuế suất hộ người dùng là in ra một con số không ai chịu
    // trách nhiệm.
    //
    // Trần 1 chặn lỗi gõ kinh điển "10" khi ý là "0.10": một suất 1000% sẽ
    // nuốt trọn lợi nhuận mà không lỗi nào đỏ, và người đọc báo cáo không có
    // cách nào biết.
    //
    // ⚠️ Không có ngày hiệu lực: đổi suất là đổi luôn số thuế của MỌI báo cáo
    // cũ khi đọc lại. Vì thế `taxRate` đi kèm trong response và được IN lên
    // chính tờ báo cáo (ADR-0033 §5) — tờ giấy tự khai nó được tính bằng mức
    // nào. Ngày nào suất thật sự đổi thì đường đi đúng là một bảng tỉ lệ có
    // ngày hiệu lực.
    MARGIN_TAX_RATE: z.coerce.number().min(0).max(1).default(0),
    // Phí cổng thanh toán, ước tính. Stripe hiện là 2.9% + $0.30/giao dịch;
    // để 0 thì dòng phí trong báo cáo bằng 0 chứ không bịa.
    PAYMENT_FEE_RATE: z.coerce.number().min(0).max(1).default(0),
    PAYMENT_FEE_FIXED: z.coerce.number().min(0).default(0),
    // ── Retention enquiry (W4 E8, ADR-0039 §6) ──
    // Enquiry cũ hơn N THÁNG bị job hằng ngày anonymize (giữ thống kê lead,
    // xoá PII). Mặc định 18; .min(1) vì 0 là "anonymize mọi lead ngay khi
    // gửi" — muốn thế thì đừng có form.
    ENQUIRY_RETENTION_MONTHS: z.coerce.number().int().min(1).max(120).default(18),
    // ── Bộ dọn ảnh mồ côi (ADR-0035) ──
    // ⚠️ MẶC ĐỊNH TẮT, và đây là lưới an toàn quan trọng nhất của cơ chế:
    // dev và prod dùng CHUNG một Cloudinary cloud (chỉ có một
    // CLOUDINARY_CLOUD_NAME ở trên), nên một worker GC chạy trên máy dev sẽ
    // destroy ảnh của www.nexora-travel.agency đang sống. Không có cờ thì
    // `start-worker.ts` KHÔNG đăng ký queue — không phải đăng ký rồi bên
    // trong return sớm. Chỉ bật trên worker production.
    MEDIA_GC_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // Số ngày chờ trước khi xoá. `.min(1)` chứ không `.min(0)`: 0 nghĩa là
    // xoá-ngay-lập-tức, tức bỏ trọn lưới an toàn mà ADR-0035 §1 dựng ra —
    // muốn thế thì sửa code chứ không gõ một con số vào env.
    MEDIA_GC_GRACE_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  })
  .superRefine((cfg, ctx) => {
    // Lưới thứ hai cho bộ dọn ảnh (ADR-0035 §6): dev và prod dùng CHUNG một
    // Cloudinary cloud, và `.env.production` (có secret) nằm ngay trên máy
    // dev theo quy ước CLAUDE.md — một lần `--env-file .env.production` để
    // debug worker là đủ để bật destroy lên ảnh của site đang sống. Cờ env
    // một mình là lưới mỏng; ở đây đòi thêm NODE_ENV=production.
    if (cfg.MEDIA_GC_ENABLED && cfg.NODE_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['MEDIA_GC_ENABLED'],
        message:
          'MEDIA_GC_ENABLED can only be true when NODE_ENV=production ' +
          '(dev and prod share one Cloudinary cloud)',
      });
    }
    // ADMIN_EMAILS parse ra RỖNG (input toàn khoảng trắng/dấu phẩy, ví dụ
    // " " hoặc "," hoặc ",,") là misconfiguration nghiêm trọng ở MỌI môi
    // trường, không riêng production — `adminEmails[0]` là người nhận `to`
    // của email ENQUIRY_ADMIN_ALERT; rỗng → `to: undefined` → JSON.stringify
    // bỏ key → `deliver()` rơi về `payload.email` = email KHÁCH, alert bay
    // nhầm hộp thư khách mà không ai biết (đúng bug A13 tính năng này sinh
    // ra để chặn). Chặn NGAY ở boot thay vì hỏng âm thầm lúc runtime.
    if (parseCommaList(cfg.ADMIN_EMAILS).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_EMAILS'],
        message:
          'ADMIN_EMAILS must resolve to at least one email after parsing ' +
          '(comma list is empty — check for stray whitespace/commas)',
      });
    }
    // Credential upload Cloudinary đi theo CẶP: ký upload cần CẢ api_key lẫn
    // api_secret. Khai đúng một nửa là misconfiguration ở MỌI môi trường (như
    // ADMIN_EMAILS ở trên), không riêng production — và nó hỏng ÂM THẦM: app
    // vẫn boot, chỉ tới lúc ai đó bấm upload mới lộ. Chặn ngay ở boot.
    const cloudinaryUploadKeys = [cfg.CLOUDINARY_API_KEY, cfg.CLOUDINARY_API_SECRET];
    if (cloudinaryUploadKeys.some(Boolean) && !cloudinaryUploadKeys.every(Boolean)) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLOUDINARY_API_KEY'],
        message:
          'Cloudinary upload credentials must be set as a pair: ' +
          'CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (one without the other cannot sign uploads)',
      });
    }
    if (cfg.NODE_ENV !== 'production') return;
    // ── Nhóm env DEPLOY (W2, ADR-0024 AMEND 2): Render gửi chuỗi rỗng khi ô
    // bị bỏ trống → parseEnv strip → default localhost kích hoạt, boot XANH
    // với origin localhost trên máy prod. Nguy hiểm nhất là BETTER_AUTH_URL:
    // Better Auth suy cờ Secure của cookie CHỈ từ baseURL.startsWith(https).
    const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
    const requireRealHttpsUrl = (path: string, value: string) => {
      let parsed: URL | null;
      try {
        parsed = new URL(value);
      } catch {
        parsed = null;
      }
      const ok =
        parsed !== null && parsed.protocol === 'https:' && !localHostnames.has(parsed.hostname);
      if (!ok) {
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: `${path} must be an https:// URL on a real host in production (got: ${value})`,
        });
      }
    };
    requireRealHttpsUrl('BETTER_AUTH_URL', cfg.BETTER_AUTH_URL);
    requireRealHttpsUrl('FRONTEND_URL', cfg.FRONTEND_URL);
    for (const origin of parseCommaList(cfg.TRUSTED_ORIGINS)) {
      requireRealHttpsUrl('TRUSTED_ORIGINS', origin);
    }
    if (cfg.CORS_ORIGINS) {
      const cors = parseCommaList(cfg.CORS_ORIGINS);
      for (const origin of cors) {
        requireRealHttpsUrl('CORS_ORIGINS', origin);
      }
      // Web (FRONTEND_URL) là client browser bắt buộc phải gọi được API; admin
      // gọi /api/auth/* từ browser lúc đăng nhập nên mọi origin của
      // TRUSTED_ORIGINS cũng phải có mặt (vòng vá review W2: ô CORS_ORIGINS
      // trống trên Render mời điền mỗi www → admin không đăng nhập được, lỗi
      // chỉ hiện ở console browser).
      const must = new Set([
        originOf(cfg.FRONTEND_URL),
        ...parseCommaList(cfg.TRUSTED_ORIGINS).map(originOf),
      ]);
      const have = new Set(cors.map(originOf));
      for (const origin of must) {
        if (origin && !have.has(origin)) {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_ORIGINS'],
            message: `CORS_ORIGINS must include ${origin} (FRONTEND_URL and every TRUSTED_ORIGINS entry sign in from the browser)`,
          });
        }
      }
    }
    if (!cfg.COOKIE_DOMAIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_DOMAIN'],
        message:
          'COOKIE_DOMAIN must be set in production — without the parent domain, ' +
          'www cannot send the session cookie to api (login silently breaks)',
      });
    }
    if (cfg.DATABASE_URL === LOCAL_COMPOSE_DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message:
          'DATABASE_URL must be set explicitly in production (not the local compose default)',
      });
    }
    if (cfg.BETTER_AUTH_SECRET === DEV_BETTER_AUTH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'BETTER_AUTH_SECRET must be set explicitly in production',
      });
    }
    if (cfg.NEWSLETTER_UNSUBSCRIBE_SECRET === DEV_UNSUBSCRIBE_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEWSLETTER_UNSUBSCRIBE_SECRET'],
        message: 'NEWSLETTER_UNSUBSCRIBE_SECRET must be set explicitly in production',
      });
    }
    if (cfg.REVALIDATE_SECRET === DEV_REVALIDATE_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['REVALIDATE_SECRET'],
        message: 'REVALIDATE_SECRET must be set explicitly in production',
      });
    }
    if (cfg.CLOUDINARY_CLOUD_NAME === 'demo') {
      ctx.addIssue({
        code: 'custom',
        path: ['CLOUDINARY_CLOUD_NAME'],
        message: 'CLOUDINARY_CLOUD_NAME must be set explicitly in production',
      });
    }
    // Thiếu RESEND_API_KEY ở production → worker KHÔNG bind ResendDeliverer, mọi
    // email transactional (reset mật khẩu, refund, enquiry alert…) im lặng rớt
    // dù outbox đánh dấu SENT. Chặn ở boot, cùng khuôn các var prod-critical khác.
    if (!cfg.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY must be set explicitly in production',
      });
    }
    // Money-path không thể chạy prod mà không có provider nào: yêu cầu ÍT NHẤT
    // một bộ ĐẦY ĐỦ (nửa bộ không tính — gateway sẽ không được đăng ký).
    const stripeReady = Boolean(cfg.STRIPE_SECRET_KEY && cfg.STRIPE_WEBHOOK_SECRET);
    const paypalReady = Boolean(
      cfg.PAYPAL_CLIENT_ID && cfg.PAYPAL_CLIENT_SECRET && cfg.PAYPAL_WEBHOOK_ID,
    );
    if (!stripeReady && !paypalReady) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message:
          'production requires at least one fully configured payment provider: ' +
          'STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET, or ' +
          'PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET + PAYPAL_WEBHOOK_ID',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  // Biến để trống (`KEY=` trong .env, hoặc ô bỏ trống trên dashboard
  // Vercel/Render) tới đây là CHUỖI RỖNG, không phải undefined — nên
  // `.default()` không kích hoạt còn `.min(1)` thì fail. Coi rỗng là
  // "chưa khai" để `KEY=` và bỏ hẳn dòng KEY hành xử giống nhau.
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const result = EnvSchema.safeParse(cleaned);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }
  return result.data;
}

/** Tách chuỗi comma-separated thành mảng đã trim, bỏ phần tử rỗng. */
export function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const env: Env = parseEnv(process.env);

/** ADMIN_EMAILS đã parse — lowercase để so khớp case-insensitive. */
export const adminEmails: readonly string[] = parseCommaList(env.ADMIN_EMAILS).map((e) =>
  e.toLowerCase(),
);

/** TRUSTED_ORIGINS đã parse cho Better Auth. */
export const trustedOrigins: readonly string[] = parseCommaList(env.TRUSTED_ORIGINS);

/** Origin chuẩn hoá (scheme + host + port) của một URL; chuỗi hỏng → ''. */
function originOf(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

/** CORS_ORIGINS đã parse cho @fastify/cors — không set thì dùng TRUSTED_ORIGINS. */
export const corsOrigins: readonly string[] = parseCommaList(
  env.CORS_ORIGINS ?? env.TRUSTED_ORIGINS,
);

/** Chế độ trần đọc công khai (W4 R1): `log` tới khi đo TRUST_PROXY thật. */
export const publicReadThrottleMode: 'log' | 'enforce' = env.PUBLIC_READ_THROTTLE_MODE;

/** Luật `trustProxy` của Fastify — chuỗi IP/CIDR/tên dải, xem `TRUST_PROXY`. */
export const trustProxy: string = env.TRUST_PROXY;

/**
 * Bảng dịch tên dải của @fastify/proxy-addr sang CIDR — Better Auth
 * (`advanced.ipAddress.trustedProxies`) chỉ nhận IP/CIDR và LẶNG LẼ bỏ entry
 * không hợp lệ (đo trong create-context.mjs: chỉ warn), nên đưa thẳng
 * 'loopback' vào là tự tắt lớp resolve IP của BA mà không lỗi nào đỏ.
 */
const PROXY_RANGE_CIDRS: Record<string, readonly string[]> = {
  loopback: ['127.0.0.0/8', '::1/128'],
  linklocal: ['169.254.0.0/16', 'fe80::/10'],
  uniquelocal: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
};

/**
 * Dịch `TRUST_PROXY` (một biến, HAI người tiêu thụ) sang dạng CIDR cho Better
 * Auth: tên dải nở thành CIDR tương ứng, IP/CIDR tường minh đi qua nguyên vẹn.
 * Một nguồn sự thật — khai proxy được tin ở đúng MỘT chỗ, Fastify lẫn BA cùng
 * đọc, không bao giờ lệch nhau.
 */
export function expandTrustProxyToCidrs(raw: string): string[] {
  return parseCommaList(raw).flatMap((entry) => PROXY_RANGE_CIDRS[entry.toLowerCase()] ?? [entry]);
}

/** `TRUST_PROXY` đã dịch sang CIDR cho Better Auth (xem hàm trên). */
export const trustedProxyCidrs: readonly string[] = expandTrustProxyToCidrs(env.TRUST_PROXY);

/**
 * Địa chỉ admin ĐẦU TIÊN — dùng làm người nhận (`to`) cho email nội bộ như
 * ENQUIRY_ADMIN_ALERT. Kiểu `string` THẬT, không `| undefined`:
 * `EnvSchema.superRefine` phía trên đã chặn ADMIN_EMAILS parse ra rỗng ngay
 * lúc boot nên `adminEmails` không bao giờ rỗng tới đây — nhánh throw dưới
 * chỉ để TypeScript (`noUncheckedIndexedAccess`) hẹp kiểu thật sự, không
 * dùng cast `as` để lách.
 */
const [firstAdminEmail] = adminEmails;
if (firstAdminEmail === undefined) {
  throw new Error(
    'adminEmails rỗng dù EnvSchema.superRefine đã guard ADMIN_EMAILS ở boot — bất biến bị vi phạm',
  );
}
export const primaryAdminEmail: string = firstAdminEmail;
