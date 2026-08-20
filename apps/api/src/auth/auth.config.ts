import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { adminEmails, env, trustedOrigins } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { EmailType, UserRole } from '../generated/prisma/enums.js';
import { isBootstrapAdmin } from './admin-bootstrap.js';

/**
 * PrismaClient dùng chung cho auth + account flows (Prisma 7: connection qua
 * driver adapter pg, KHÔNG qua schema url). Pool direct/session (~10 conn) —
 * transaction pooler bị cấm (CLAUDE.md).
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 10 }),
});

/**
 * Better Auth v1.6 instance (spec §5).
 *
 * - Model names mặc định của BA (user/session/account/verification) trùng tên
 *   Prisma model (User/Session/Account/Verification) → không cần modelName/
 *   fields mapping. BA nói chuyện với Prisma client bằng TÊN FIELD Prisma
 *   (emailVerified, expiresAt…); cột snake_case do Prisma `@map` lo.
 * - `advanced.database.generateId: false`: BA mặc định tự sinh id base62 —
 *   KHÔNG hợp lệ với cột `@db.Uuid`. Tắt đi để Prisma `@default(uuid())` sinh.
 * - AUTH-2 (ADR-0008): send-email (reset + verify) ghi OUTBOX → ResendDeliverer
 *   gửi qua Resend (retry/backoff), thay console.log stub. Verify gửi lúc signup
 *   (`sendOnSignUp`). `requireEmailVerification` GIỮ false — khách không bị chặn.
 * - ADR-0017 §5a: plugin `emailOTP` với `overrideDefaultEmailVerification: true`
 *   ĐÈ `emailVerification.sendVerificationEmail` — signup vẫn gọi flow verify
 *   (`sendOnSignUp`) nhưng nội dung gửi giờ là OTP 6 số thay vì link.
 *   CHỦ Ý KHÔNG khai `sendVerificationEmail` ở khối `emailVerification` dưới
 *   đây (khác bản nháp đầu của plan): đo bằng int test phát hiện BA merge
 *   option plugin qua `defu(userOptions, pluginOverrides)` — `defu` giữ khoá
 *   NGƯỜI DÙNG đã set, override của plugin chỉ lấp khoá còn `undefined`. Khai
 *   `sendVerificationEmail` ở đây (như link flow cũ) sẽ THẮNG override của
 *   plugin — OTP không bao giờ được gửi (đo được: outbox vẫn ra EMAIL_VERIFICATION
 *   kèm link, không phải EMAIL_OTP). Bỏ field này để plugin sở hữu trọn khoá
 *   đó; `sendOnSignUp` + `afterEmailVerification` (promote admin, SEC-1) GIỮ
 *   NGUYÊN — hook sau-verify không liên quan tới field bị bỏ, int test canh.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [...trustedOrigins],
  emailAndPassword: {
    enabled: true,
    // SIẾT 20/08 (đảo quyết định 03/08 "GIỮ false" — tester lách được OTP):
    // chưa verify thì login bị chặn (403 EMAIL_NOT_VERIFIED, form web/admin
    // bắt code này dẫn về /verify-email). Kèm autoSignIn: false — signup
    // KHÔNG phát session; bỏ qua OTP là khách vãng lai, không mang danh tài
    // khoản. Đo bằng require-verification.int.spec.ts: verify-email KHÔNG
    // tự đăng nhập → web đưa về /login sau verify.
    requireEmailVerification: true,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      // AUTH-2: ghi outbox thay console.log. dedupeKey bounded theo VarChar(200).
      await prisma.outbox.create({
        data: {
          type: EmailType.PASSWORD_RESET,
          payload: { email: user.email, url },
          dedupeKey: `pwreset:${user.id}:${url}`.slice(0, 200),
        },
      });
    },
  },
  emailVerification: {
    // Gửi verify email lúc signup — để admin có đường chứng minh sở hữu (SEC-1).
    // KHÔNG khai sendVerificationEmail ở đây nữa (xem doc-comment auth instance
    // phía trên) — plugin emailOTP sở hữu khoá này để gửi OTP thay vì link.
    sendOnSignUp: true,
    // Promote ADMIN CHỈ sau khi đã chứng minh sở hữu email (SEC-1). Hook này fire
    // sau verify thành công → emailVerified=true. Promote-only; update thẳng qua
    // prisma (không qua BA adapter) nên không loop hook. Backstop: reconcile lúc boot.
    afterEmailVerification: async (user) => {
      if (isBootstrapAdmin(user.email, adminEmails)) {
        await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.ADMIN } });
      }
    },
  },
  user: {
    additionalFields: {
      phone: { type: 'string', required: false, input: true },
      // CRITICAL: input:false — role KHÔNG BAO GIỜ được client set qua signup/
      // update. Server-owned; chỉ hook bootstrap dưới đây (hoặc admin flows
      // sau này) đổi được.
      role: { type: 'string', required: false, defaultValue: UserRole.CUSTOMER, input: false },
      // Tombstone marker — expose để guard đọc từ session, không nhận input.
      deletedAt: { type: 'date', required: false, input: false },
    },
  },
  // Google OAuth chỉ bật khi có ĐỦ cặp env (dev không cần Google vẫn boot được).
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        },
      }
    : {}),
  advanced: {
    database: {
      generateId: false,
    },
    // Deploy v1 (ADR-0024 · ADR-0017 §4 đường CHUẨN): COOKIE_DOMAIN có giá trị
    // (vd `.nexora-travel.agency`) → cookie session mang domain cha để browser
    // gửi kèm fetch cross-subdomain www→api; sameSite giữ `lax` (không phải
    // `none` — cùng registrable domain là same-site). Dev không set biến này
    // nên spread rỗng, hành vi giữ nguyên từng byte.
    ...(env.COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.COOKIE_DOMAIN,
          },
        }
      : {}),
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 phút — khớp copy "code expires" nếu UI có
      sendVerificationOnSignUp: true,
      // Đè flow link mặc định: sendOnSignUp từ nay ra OTP (ADR-0017 §5a).
      // Khối emailVerification bên dưới GIỮ NGUYÊN — afterEmailVerification
      // (promote admin SEC-1) phải fire cả ở đường OTP; int test canh.
      overrideDefaultEmailVerification: true,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp }) {
        await prisma.outbox.create({
          data: {
            type: EmailType.EMAIL_OTP,
            payload: { email, otp },
            dedupeKey: `email-otp:${email}:${otp}`.slice(0, 200),
          },
        });
      },
    }),
  ],
});

/** User trong session Better Auth (kèm additionalFields: phone/role/deletedAt). */
export type SessionUser = typeof auth.$Infer.Session.user;
