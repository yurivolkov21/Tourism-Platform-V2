import { z } from 'zod';

/**
 * Dev-only Better Auth secret. `superRefine` dưới đây chặn giá trị này ở
 * production — prod PHẢI set BETTER_AUTH_SECRET thật qua env.
 */
const DEV_BETTER_AUTH_SECRET = 'dev-secret-change-me';

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
    // Base URL của web app (P3) — đích redirect success/cancel cho checkout
    // session (P2 W1). Prod PHẢI set domain thật.
    FRONTEND_URL: z.url().default('http://localhost:3000'),
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
    EMAIL_FROM: z.string().min(1).default('Tourism <noreply@tourism.test>'),
  })
  .superRefine((cfg, ctx) => {
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
