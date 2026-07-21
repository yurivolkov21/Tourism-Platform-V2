# Admin bootstrap (emailVerified-gated) + AUTH-2 email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng superpowers:subagent-driven-development
> hoặc superpowers:executing-plans để thực thi task-by-task. Steps dùng checkbox `- [ ]`.

**Goal:** Đóng SEC-1 (priv-esc), AUTH-1 (no self-heal), AUTH-2 (email chưa dây) — promote
admin chỉ khi `emailVerified && email ∈ ADMIN_EMAILS`, với email chạy thật qua Resend/outbox.

**Architecture:** Bỏ auto-promote trong signup-hook. Promote qua (a) Better Auth
`emailVerification.afterEmailVerification` (fire sau khi verify thành công) và (b) reconcile
`OnApplicationBootstrap` (self-heal). Reset/verify email ghi outbox row → `ResendDeliverer`.

**Tech Stack:** NestJS 11 · Better Auth 1.6.23 · Prisma 7 (driver adapter pg) · pg-boss worker · Vitest int (PG `tourism_test`).

## Global Constraints (áp cho MỌI task)

- Comment code **tiếng Việt** (#8); identifier tiếng Anh.
- Conventional Commits, **KHÔNG AI attribution** (#12).
- **TDD**: test trước, xem đỏ, rồi code; heavy finding kèm **mutation-test** (gỡ guard → đỏ).
- **KHÔNG sửa migration.sql đã apply** — `prisma migrate dev` tạo file MỚI.
- `noUncheckedIndexedAccess` bật; `role` server-owned (`input:false`) — không đổi.
- Không chạy `gate:int` sau mỗi step nhỏ; chạy 1 lần cuối branch trước merge (#11).
- `ADMIN_EMAILS` parse sẵn thành `adminEmails: string[]` (`config/env.ts`); citext unique trên `User.email`.

## File Structure

- `apps/api/prisma/schema.prisma` — thêm 2 giá trị `EmailType` (+ migration mới).
- `apps/api/src/worker/resend.deliverer.ts` — 2 case render (subject+html) cho reset/verify.
- `apps/api/src/auth/auth.config.ts` — callbacks ghi outbox; `sendOnSignUp`; `afterEmailVerification` promote; BỎ `create.after` promote.
- `apps/api/src/auth/admin-reconcile.ts` (MỚI) — `reconcileAdmins()` thuần + `AdminReconcileService` (`OnApplicationBootstrap`).
- `apps/api/src/auth/auth.module.ts` — đăng ký `AdminReconcileService`.
- `apps/api/src/auth/auth.int.spec.ts` — sửa test "b" + thêm test verify→promote + reconcile.
- `apps/api/src/auth/admin-reconcile.spec.ts` (MỚI) — unit/int cho `reconcileAdmins`.

---

### Task 1: Migration — thêm `EmailType.PASSWORD_RESET` + `EMAIL_VERIFICATION`

**Files:** Modify `apps/api/prisma/schema.prisma` (enum `EmailType`, ~dòng 140-153); Create `apps/api/prisma/migrations/<ts>_auth_email_types/migration.sql` (do `migrate dev` sinh).

- [ ] **Step 1:** Thêm 2 dòng vào enum `EmailType` (sau `EMAIL_CHANGED`):
```prisma
  PASSWORD_RESET
  EMAIL_VERIFICATION
```
- [ ] **Step 2:** Sinh migration (KHÔNG sửa file cũ):
Run: `pnpm --filter @tourism/api exec prisma migrate dev --name auth_email_types`
Expected: tạo migration mới `ALTER TYPE "EmailType" ADD VALUE ...`, apply lên `tourism` dev DB, regenerate client.
- [ ] **Step 3:** Verify enum có trong client:
Run: `pnpm --filter @tourism/api exec tsc --noEmit` → PASS (client types cập nhật).
- [ ] **Step 4:** Commit:
```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): EmailType thêm PASSWORD_RESET + EMAIL_VERIFICATION (AUTH-2)"
```

---

### Task 2: `ResendDeliverer` render case cho reset + verify

**Files:** Modify `apps/api/src/worker/resend.deliverer.ts` (`renderEmail` switch); Test `apps/api/src/worker/resend.deliverer.spec.ts` (nếu chưa có, tạo; nếu có, thêm case).

**Interfaces:**
- Consumes: `EmailType.PASSWORD_RESET|EMAIL_VERIFICATION` (Task 1); `renderEmail(type, fields, frontendUrl)` hiện có, `fields.url: string`.
- Produces: subject+html cho 2 type (dùng `fields.url` làm link).

- [ ] **Step 1:** Viết test đỏ (render reset có link):
```ts
it('PASSWORD_RESET: subject + link reset', () => {
  const { subject, html } = renderEmail(EmailType.PASSWORD_RESET, { url: 'https://x/reset?t=abc' }, 'https://x');
  expect(subject).toMatch(/reset/i);
  expect(html).toContain('https://x/reset?t=abc');
});
it('EMAIL_VERIFICATION: subject + link verify', () => {
  const { subject, html } = renderEmail(EmailType.EMAIL_VERIFICATION, { url: 'https://x/verify?t=abc' }, 'https://x');
  expect(subject).toMatch(/verif/i);
  expect(html).toContain('https://x/verify?t=abc');
});
```
- [ ] **Step 2:** Run → FAIL (case thiếu, `renderEmail` rơi default/throw).
Run: `pnpm --filter @tourism/api exec vitest run src/worker/resend.deliverer.spec.ts`
- [ ] **Step 3:** Thêm 2 case vào switch `renderEmail` (giữ khuôn các case cũ, subject plain-text, link trong html):
```ts
    case EmailType.PASSWORD_RESET:
      return {
        subject: 'Reset your password',
        html: `<p>Bấm để đặt lại mật khẩu:</p><p><a href="${f('url')}">${f('url')}</a></p>`,
      };
    case EmailType.EMAIL_VERIFICATION:
      return {
        subject: 'Verify your email',
        html: `<p>Bấm để xác minh email:</p><p><a href="${f('url')}">${f('url')}</a></p>`,
      };
```
(Dùng `f()` — escape HTML — cho `url` trong html; đọc helper `f` hiện có trong file.)
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `git commit -am "feat(api): render email reset + verify (AUTH-2)"`

---

### Task 3: AUTH-2 — callbacks ghi outbox + `sendOnSignUp`

**Files:** Modify `apps/api/src/auth/auth.config.ts` (`emailAndPassword.sendResetPassword`, `emailVerification`); Test `apps/api/src/auth/auth.int.spec.ts`.

**Interfaces:**
- Consumes: `prisma` (từ auth.config), `EmailType` (Task 1).
- Produces: hành vi — reset/verify tạo `outbox` row thay vì `console.log`.

- [ ] **Step 1:** Viết int test đỏ — forget-password ghi outbox `PASSWORD_RESET`:
```ts
it('e. forget-password ghi outbox PASSWORD_RESET (không console.log)', async () => {
  const email = 'reset-me@example.com';
  await signUp(app, email, 'Reset Me');
  const res = await app.inject({
    method: 'POST', url: '/api/auth/forget-password',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, redirectTo: '/reset' }),
  });
  expect(res.statusCode).toBe(200);
  const rows = await prisma.outbox.findMany({ where: { type: EmailType.PASSWORD_RESET } });
  expect(rows).toHaveLength(1);
  expect((rows[0]?.payload as { email?: string }).email).toBe(email);
});
```
*(Xác nhận endpoint BA 1.6.23: `POST /api/auth/forget-password` — nếu tên khác, đọc `auth.api` để lấy đúng route.)*
- [ ] **Step 2:** Run → FAIL (hiện `console.log`, không có outbox row). Nhớ thêm `subscribers`/`outbox` vào TRUNCATE beforeEach nếu cần cô lập.
- [ ] **Step 3:** Sửa `auth.config.ts`:
```ts
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await prisma.outbox.create({
        data: { type: EmailType.PASSWORD_RESET, payload: { email: user.email, url }, dedupeKey: `pwreset:${user.id}:${url}` },
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await prisma.outbox.create({
        data: { type: EmailType.EMAIL_VERIFICATION, payload: { email: user.email, url }, dedupeKey: `verify:${user.id}:${url}` },
      });
    },
  },
```
*(Đọc shape `Outbox` model để khớp field bắt buộc: `type`, `payload` Json, `dedupeKey` unique. `status` default PENDING.)*
- [ ] **Step 4:** Run → PASS. Thêm assertion: sau `signUp`, có outbox `EMAIL_VERIFICATION` (do `sendOnSignUp`).
- [ ] **Step 5:** Commit: `git commit -am "feat(api): reset/verify email qua outbox + sendOnSignUp (AUTH-2)"`

---

### Task 4: Reconcile — `reconcileAdmins()` + `AdminReconcileService` (self-heal AUTH-1)

**Files:** Create `apps/api/src/auth/admin-reconcile.ts`; Modify `apps/api/src/auth/auth.module.ts`; Test `apps/api/src/auth/admin-reconcile.spec.ts`.

**Interfaces:**
- Consumes: `prisma` (auth.config), `adminEmails` (env), `UserRole` (generated enum), `isBootstrapAdmin` (admin-bootstrap.ts).
- Produces: `reconcileAdmins(client, adminEmails): Promise<number>` (số promote); `AdminReconcileService.onApplicationBootstrap()`.

- [ ] **Step 1:** Viết int test đỏ (`admin-reconcile.spec.ts`) — promote verified admin-email, KHÔNG promote unverified, idempotent, KHÔNG demote:
```ts
it('promote user verified ∈ ADMIN_EMAILS, bỏ qua unverified, không demote', async () => {
  await prisma.user.createMany({ data: [
    { id: U1, email: ADMIN_EMAIL, emailVerified: true,  role: 'CUSTOMER', name: 'A' },
    { id: U2, email: 'someone@x.com', emailVerified: true, role: 'CUSTOMER', name: 'B' },
    { id: U3, email: ADMIN_EMAIL_2, emailVerified: false, role: 'CUSTOMER', name: 'C' },
  ]});
  const n = await reconcileAdmins(prisma, [ADMIN_EMAIL, ADMIN_EMAIL_2]);
  expect(n).toBe(1);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: U1 } })).role).toBe('ADMIN'); // verified admin → promote
  expect((await prisma.user.findUniqueOrThrow({ where: { id: U2 } })).role).toBe('CUSTOMER'); // không phải admin
  expect((await prisma.user.findUniqueOrThrow({ where: { id: U3 } })).role).toBe('CUSTOMER'); // unverified → không
  expect(await reconcileAdmins(prisma, [ADMIN_EMAIL, ADMIN_EMAIL_2])).toBe(0); // idempotent
});
```
- [ ] **Step 2:** Run → FAIL (`reconcileAdmins` chưa tồn tại).
- [ ] **Step 3:** Viết `admin-reconcile.ts`:
```ts
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { adminEmails } from '../config/env.js';
import { UserRole } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/** Promote user hiện có thỏa (emailVerified ∧ email ∈ ADMIN_EMAILS) mà chưa ADMIN.
 *  Promote-only (không bao giờ demote — spec §5). Trả về số row promote. */
export async function reconcileAdmins(
  client: typeof prisma,
  emails: readonly string[],
): Promise<number> {
  if (emails.length === 0) return 0;
  const { count } = await client.user.updateMany({
    where: { email: { in: [...emails] }, emailVerified: true, role: { not: UserRole.ADMIN } },
    data: { role: UserRole.ADMIN },
  });
  return count;
}

/** Chạy reconcile một lần lúc app khởi động — self-heal email thêm vào ADMIN_EMAILS
 *  sau khi account đã verified (AUTH-1), và backstop cho afterEmailVerification. */
@Injectable()
export class AdminReconcileService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminReconcileService.name);
  async onApplicationBootstrap(): Promise<void> {
    const n = await reconcileAdmins(prisma, adminEmails);
    if (n > 0) this.logger.log(`Reconcile: promote ${n} admin theo ADMIN_EMAILS`);
  }
}
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Đăng ký provider trong `auth.module.ts` (thêm `AdminReconcileService` vào `providers`). Verify boot: `pnpm --filter @tourism/api exec tsc --noEmit` → PASS.
- [ ] **Step 6:** Commit: `git commit -am "feat(api): reconcileAdmins + AdminReconcileService (AUTH-1 self-heal)"`

---

### Task 5: SEC-1 — gate promote sau verify, bỏ auto-promote signup-hook

**Files:** Modify `apps/api/src/auth/auth.config.ts` (`databaseHooks.user.create.after` → bỏ promote; thêm `emailVerification.afterEmailVerification`); Modify `apps/api/src/auth/auth.int.spec.ts` (sửa test "b" + thêm verify-round-trip).

**Interfaces:**
- Consumes: `isBootstrapAdmin`, `adminEmails`, `prisma`, `UserRole` (auth.config đã import); outbox `EMAIL_VERIFICATION` (Task 3).
- Produces: hành vi — signup admin-email CHƯA verify = CUSTOMER; verify xong = ADMIN.

- [ ] **Step 1:** SỬA test "b" (`auth.int.spec.ts:69-79`) từ khẳng-định-sai → đúng (RED):
```ts
it('b. signup bằng email admin CHƯA verify KHÔNG được promote (SEC-1)', async () => {
  const res = await signUp(app, ADMIN_EMAIL, 'Boss');
  expect(res.statusCode).toBe(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
  expect(user.role).toBe('CUSTOMER'); // chưa verify → chưa phải admin
});
```
- [ ] **Step 2:** Run → FAIL (code hiện promote ngay trong create.after → role ADMIN).
Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/auth/auth.int.spec.ts -t "SEC-1"`
- [ ] **Step 3:** Trong `auth.config.ts`: XÓA block `databaseHooks.user.create.after` promote; THÊM `afterEmailVerification` vào `emailVerification`:
```ts
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => { /* Task 3 */ },
    // Promote ADMIN CHỈ sau khi đã chứng minh sở hữu email (SEC-1). afterEmailVerification
    // fire sau verify thành công → emailVerified=true. Promote-only; direct prisma update
    // (không qua BA adapter) nên không loop hook.
    afterEmailVerification: async (user) => {
      if (isBootstrapAdmin(user.email, adminEmails)) {
        await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.ADMIN } });
      }
    },
  },
```
*(Nếu để `databaseHooks.user` rỗng thì bỏ luôn key; giữ import `UserRole`/`isBootstrapAdmin`.)*
- [ ] **Step 4:** Run test "b" → PASS. Chạy full `auth.int.spec.ts` xem test cũ nào phụ thuộc hành-vi-cũ (vd test "c" ADMIN) — sửa cho khớp (admin nay cần verify).
- [ ] **Step 5:** Thêm test verify-round-trip → ADMIN (mutation-killing cho gate):
```ts
it('signup email admin → verify → promote ADMIN (SEC-1 happy path)', async () => {
  await signUp(app, ADMIN_EMAIL, 'Boss');
  const vrow = await prisma.outbox.findFirstOrThrow({
    where: { type: EmailType.EMAIL_VERIFICATION }, orderBy: { createdAt: 'desc' },
  });
  const url = (vrow.payload as { url: string }).url;
  const token = new URL(url).searchParams.get('token'); // xác nhận tên param BA
  const res = await app.inject({ method: 'GET', url: `/api/auth/verify-email?token=${token}` });
  expect([200, 302]).toContain(res.statusCode);
  expect((await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })).role).toBe('ADMIN');
});
```
*(Xác nhận route + tên query-param verify của BA 1.6.23 lúc impl; token nằm trong `url` do `sendVerificationEmail` nhận.)*
- [ ] **Step 6:** Run → PASS. **Mutation-test:** tạm gỡ `if (isBootstrapAdmin…)` guard trong afterEmailVerification (promote vô điều kiện) → test "someone@x không thành admin" phải ĐỎ; khôi phục.
- [ ] **Step 7:** Commit: `git commit -m "fix(api): promote admin chỉ sau verify email, bỏ auto-promote signup-hook (SEC-1)"`

---

## Hoàn tất branch (sau Task 5)

- [ ] `pnpm gate:int` toàn repo → xanh (cổng #11).
- [ ] Docs sweep #13: entry `CHANGELOG.md` (ngày · hash range · SEC-1/AUTH-1/AUTH-2 · số test) — ADR-0008 & README-map đã có.
- [ ] Rebase lên `main` mới nhất → `git merge --ff-only` → push (xác nhận user trước push, #2).

## Self-Review (đã chạy)

- **Spec coverage:** AUTH-2 (Task 1-3) · AUTH-1 self-heal (Task 4) · SEC-1 gate+bỏ-auto-promote (Task 5) · edge email-squatting (ADR, không cần code) · `requireEmailVerification:false` giữ (Task 3). ✓
- **Placeholder scan:** các "xác nhận endpoint/param BA" là chi tiết-API cần verify lúc impl (không phải logic-placeholder); mọi logic có code. ✓
- **Type consistency:** `reconcileAdmins(client, emails)`, `AdminReconcileService`, `UserRole.ADMIN`, `EmailType.PASSWORD_RESET/EMAIL_VERIFICATION` nhất quán giữa các task. ✓
