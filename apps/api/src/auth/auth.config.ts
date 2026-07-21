import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
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
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [...trustedOrigins],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
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
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await prisma.outbox.create({
        data: {
          type: EmailType.EMAIL_VERIFICATION,
          payload: { email: user.email, url },
          dedupeKey: `verify:${user.id}:${url}`.slice(0, 200),
        },
      });
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
  },
  databaseHooks: {
    user: {
      create: {
        // Bootstrap admin dual-grant: email ∈ ADMIN_EMAILS → promote ADMIN
        // ngay sau khi tạo. Chỉ promote, không bao giờ demote (spec §5).
        after: async (user) => {
          if (isBootstrapAdmin(user.email, adminEmails)) {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: UserRole.ADMIN },
            });
          }
        },
      },
    },
  },
});

/** User trong session Better Auth (kèm additionalFields: phone/role/deletedAt). */
export type SessionUser = typeof auth.$Infer.Session.user;
