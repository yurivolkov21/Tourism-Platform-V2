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
    // Proxy nào được tin `X-Forwarded-*` (03/09, fastify 5.12.1 bỏ dạng
    // hop-count vì spoof được — GHSA-3m5p-2c4r-xxw2). Danh sách IP/CIDR hoặc
    // tên dải của @fastify/proxy-addr: mặc định tin MỌI hop từ địa chỉ NỘI
    // BỘ (loopback + link-local + RFC1918/fc00::/7 — ingress Render/Railway
    // nối vào service qua mạng riêng) và dừng ở địa chỉ công khai đầu tiên
    // = IP khách thật. Nền tảng nào proxy nối từ IP công khai thì set IP đó.
    TRUST_PROXY: z.string().min(1).default('loopback,linklocal,uniquelocal'),
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
  })
  .superRefine((cfg, ctx) => {
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

/** Luật `trustProxy` của Fastify — chuỗi IP/CIDR/tên dải, xem `TRUST_PROXY`. */
export const trustProxy: string = env.TRUST_PROXY;

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
