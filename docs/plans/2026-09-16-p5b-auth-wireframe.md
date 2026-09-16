# P5b-1 cụm auth mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng 17 khung TĨNH của cụm auth trên app mobile, kèm hợp đồng `AuthActions` và bản giả lập, để thành viên khác cắm hạ tầng vào mà không phải sửa một màn nào.

**Architecture:** Hai nhánh. Nhánh 1 dựng package `@tourism/core` rồi chuyển nguyên văn luật kiểm ô nhập và quy lỗi của web sang đó (không đổi hành vi, chỉ đổi chỗ ở). Nhánh 2 thêm năm primitive vào `@tourism/mobile-ui`, dựng màn trong `apps/mobile/src/features/*` (component chỉ vẽ theo props), còn route giữ state của form và gọi `AuthActions` lấy từ provider — đợt này provider cấp bản giả lập.

**Tech Stack:** TypeScript 7 (tsgo), Expo SDK 57 + expo-router 57, React Native 0.86.3, jest-expo 57 + `@testing-library/react-native` 14, Vitest 4 (cho package dùng chung), Biome 2, Turborepo, pnpm.

**Spec:** [docs/specs/2026-09-16-p5b-auth-wireframe-design.md](../specs/2026-09-16-p5b-auth-wireframe-design.md) · [ADR-0042](../adr/0042-shared-client-rules-core.md) · [ADR-0040 §AMEND 1](../adr/0040-mobile-app-expo.md) · [mockup 17 khung](../design/mockups/mobile-auth-screens.src.html)

## Global Constraints

- **Không nối API.** Không import `better-auth`, không gọi mạng, không lưu phiên. Mọi lệnh đi qua interface `AuthActions`; đợt này chỉ có bản giả lập.
- **Tokens-only** (CLAUDE.md #6, ADR-0040 §3): không hex, không `rgba()/hsl()`, không tên màu CSS trong `apps/mobile/src` và `libs/mobile/ui/src`. `scripts/check-mobile-tokens-only.mjs` canh việc này và chạy trong `pnpm gate`. Màu có alpha suy từ token bằng `withAlpha`.
- **Copy user-facing viết tiếng Anh và nằm trong `@tourism/i18n`** (luật 7). Không chuỗi hiển thị nào viết thẳng trong component.
- **Comment `//` và JSDoc viết tiếng Việt có dấu** (luật 8). Tên biến, hàm, file giữ tiếng Anh.
- **Commit Conventional, phần mô tả tiếng Việt có dấu, KHÔNG AI attribution** (luật 12) — không trailer `Co-Authored-By`, không dòng "Generated with". Sau mỗi commit chạy `git log -1 --format=%b | grep -i "co-authored-by"` phải rỗng.
- **Không thêm dependency nào ngoài năm gói đã duyệt** (ADR-0040 §AMEND 1): `expo-linear-gradient`, `@expo/vector-icons`, `expo-font`, `@expo-google-fonts/literata`, `@expo-google-fonts/archivo`. Cần thêm gì khác thì DỪNG và hỏi user.
- **Jest chỉ sống trong `apps/mobile` và `libs/mobile/ui`** (ADR-0040 §4). `@tourism/core` dùng Vitest như mọi package chung.
- **Không chạm hạ tầng sống** (luật 15): không Supabase, Render, Vercel, Resend, Stripe, Cloudinary. Không deploy, không đổi env trên nền tảng nào. Ảnh Cloudinary chỉ ĐỌC qua URL công khai.
- **Không stage `docs/screenshot/`** (ảnh tham chiếu riêng của user, luôn hiện `??`). Mọi commit dùng `git add <đường dẫn tường minh>`, cấm `git add -A` và `git add .`.
- Chạy lệnh bằng **Git Bash** (pnpm ở máy này đã trỏ script-shell về Git Bash).
- Gate nhanh trong vòng lặp: `pnpm gate`. Trước khi khai xong một nhánh: `pnpm gate:int` **cộng** `pnpm turbo run bundle --filter=@tourism/mobile` (bundle không nằm trong gate — ADR-0040 §5).
- Không sửa file `migration.sql` nào; đợt này không có migration.

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `libs/shared/core/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` | Khuôn package chép từ `libs/shared/i18n` |
| `libs/shared/core/src/index.ts` | Cửa ra duy nhất của package |
| `libs/shared/core/src/lib/auth-errors.ts` (+ `.spec.ts`) | `AuthErrorKey`, `mapAuthError`, `fieldOfAuthError` — chuyển từ web |
| `libs/shared/core/src/lib/auth-form.ts` (+ `.spec.ts`) | Kiểm ô nhập thuần — chuyển từ web |
| `libs/shared/core/src/lib/package-boundary.spec.ts` | Quét source tìm import cấm (react, react-native, next, DOM, Node) |
| `libs/mobile/ui/src/lib/theme.ts` | Thêm 4 khoá màu, map font, hàm `withAlpha` |
| `libs/mobile/ui/src/lib/text-field.tsx`, `form-message.tsx`, `otp-input.tsx`, `checkbox.tsx`, `icon-button.tsx` (+ spec từng cái) | Primitive dùng lại cho các cụm sau |
| `libs/shared/i18n/src/lib/messages.ts` | Khối `mobile.auth` và tiêu đề route mới |
| `apps/mobile/src/features/auth/auth-actions.ts` | Kiểu `AuthActions`, context, `useAuthActions` |
| `apps/mobile/src/features/auth/mock-auth-actions.ts` | Bản giả lập theo bảng kịch bản |
| `apps/mobile/src/features/auth/error-channel.ts` | `placeAuthError` — chọn kênh 1/2/3 |
| `apps/mobile/src/features/auth/use-countdown.ts` | Đếm ngược gửi lại mã |
| `apps/mobile/src/features/auth/auth-hero.tsx` | Ảnh đầu trang + dải mờ + nút thoát + nhãn địa danh |
| `apps/mobile/src/features/auth/result-screen.tsx` | Khung 6a/6b |
| `apps/mobile/src/features/auth/auth-media.ts` | URL ảnh mẫu (bản giả lập) |
| `apps/mobile/src/features/auth/brand-mark.tsx` | Logo hai viên kim cương bằng View xoay |
| `apps/mobile/src/features/auth/*-screen.tsx` | Năm màn: sign-in, register, verify-email, forgot-password, reset-password |
| `apps/mobile/src/features/onboarding/onboarding-store.ts`, `onboarding-screen.tsx` | Cờ "đã xem" + ba trang onboarding |
| `apps/mobile/src/app/onboarding.tsx`, `(auth)/verify-email.tsx`, `(auth)/reset-password.tsx`, `(auth)/success.tsx`, `dev/gallery.tsx` | Route mới; route giữ state form và gọi `AuthActions` |
| `docs/conventions/mobile-auth-handoff.md` | Tài liệu bàn giao cho người làm hạ tầng |

---
# NHÁNH 1 — `refactor/shared-auth-rules`

Nhánh này KHÔNG đổi hành vi của web. Nó chỉ dời hai file thuần sang package dùng
chung rồi đổi đường import. Vì đụng web đang chạy thật, nhánh phải nhỏ, phải xanh
`gate:int`, và phải đẩy lên cho CI soi trước khi merge.

```bash
git switch main && git switch -c refactor/shared-auth-rules
```

### Task 1: Dựng `@tourism/core` và chuyển `auth-errors.ts`

**Files:**
- Create: `libs/shared/core/package.json`, `libs/shared/core/tsconfig.json`, `libs/shared/core/tsconfig.build.json`, `libs/shared/core/vitest.config.ts`, `libs/shared/core/src/index.ts`
- Move: `apps/web/src/lib/auth-errors.ts` → `libs/shared/core/src/lib/auth-errors.ts`
- Move (test): `apps/web/src/lib/auth-errors.spec.ts` → `libs/shared/core/src/lib/auth-errors.spec.ts`
- Modify: `apps/web/package.json` (thêm dependency) và 6 file web đổi đường import (Step 6)
- Delete: `libs/shared/core/.gitkeep`

**Interfaces:**
- Consumes: `@tourism/i18n` (`messages`) — `@tourism/contract` tới Task 2 mới dùng
- Produces: `@tourism/core` xuất `AuthErrorKey`, `AuthErrorField`, `mapAuthError(error: { status?: number; code?: string } | null | undefined): AuthErrorKey`, `fieldOfAuthError(key: AuthErrorKey): AuthErrorField | null`

- [ ] **Step 1: Dựng khuôn package**

`libs/shared/core/package.json`:

```json
{
  "name": "@tourism/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@tourism/contract": "workspace:*",
    "@tourism/i18n": "workspace:*"
  },
  "devDependencies": {
    "typescript": "7.0.2",
    "vitest": "4.1.11"
  }
}
```

`libs/shared/core/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`libs/shared/core/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "types": []
  },
  "include": ["src"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`libs/shared/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 2: Chuyển file bằng `git mv` để giữ lịch sử**

```bash
rm libs/shared/core/.gitkeep
mkdir -p libs/shared/core/src/lib
git mv apps/web/src/lib/auth-errors.ts libs/shared/core/src/lib/auth-errors.ts
git mv apps/web/src/lib/auth-errors.spec.ts libs/shared/core/src/lib/auth-errors.spec.ts
```

Sửa đúng MỘT dòng trong spec vừa chuyển — package này là ESM thuần nên import
phải có đuôi `.js` (web dùng bundler resolution nên trước đó không cần):

```ts
import { fieldOfAuthError, mapAuthError } from './auth-errors.js';
```

Nội dung `auth-errors.ts` giữ NGUYÊN VĂN, không sửa một dòng logic nào.

`libs/shared/core/src/index.ts`:

```ts
export * from './lib/auth-errors.js';
```

- [ ] **Step 3: Nối package vào workspace**

Thêm `"@tourism/core": "workspace:*"` vào `dependencies` của `apps/web/package.json`
(giữ thứ tự alphabet: đứng trước `@tourism/i18n`), rồi:

```bash
pnpm install
```

Kiểm: `pnpm ls --filter @tourism/web --depth 0 | grep @tourism/core` ra một dòng.

- [ ] **Step 4: Chạy test của package mới, phải XANH ngay**

Run: `pnpm turbo run test --filter=@tourism/core`
Expected: PASS — spec chuyển sang nguyên vẹn thì code cũng nguyên vẹn. Task `test`
của turbo có `dependsOn: ["^build"]` nên `dist` của contract và i18n tự được dựng.

- [ ] **Step 5: Chạy web để thấy nó ĐỎ (đường import cũ đã chết)**

Run: `pnpm turbo run typecheck --filter=@tourism/web`
Expected: FAIL — 6 file không còn tìm thấy `@/lib/auth-errors`.

- [ ] **Step 6: Đổi đường import ở 6 file web**

| File | Dòng |
| --- | --- |
| `apps/web/src/components/account/change-password-form.tsx` | 13 |
| `apps/web/src/components/account/profile-summary.tsx` | 15 |
| `apps/web/src/components/auth/login-form.tsx` | 12 |
| `apps/web/src/components/auth/otp-form.tsx` | 14 |
| `apps/web/src/components/auth/register-form.tsx` | 11 |
| `apps/web/src/components/auth/reset-password-form.tsx` | 10 |

Đổi `from '@/lib/auth-errors'` thành `from '@tourism/core'`, giữ nguyên danh sách
import. Ví dụ `login-form.tsx`:

```ts
import { type AuthErrorKey, fieldOfAuthError, mapAuthError } from '@tourism/core';
```

Kiểm: `grep -rn "@/lib/auth-errors" apps/web/src` phải rỗng.

- [ ] **Step 7: Chạy lại cho xanh**

Run: `pnpm turbo run build typecheck test --filter=@tourism/web --filter=@tourism/core`
Expected: PASS cả ba task ở cả hai package.

- [ ] **Step 8: Commit**

```bash
git add libs/shared/core apps/web/package.json apps/web/src/components pnpm-lock.yaml
git commit -m "refactor(core): dựng @tourism/core và chuyển auth-errors từ web sang"
git log -1 --format=%b | grep -i "co-authored-by"
```

Dòng `grep` cuối phải KHÔNG in ra gì (luật 12).

### Task 2: Chuyển `auth-form.ts` sang `@tourism/core`

**Files:**
- Move: `apps/web/src/lib/auth-form.ts` → `libs/shared/core/src/lib/auth-form.ts`
- Move (test): `apps/web/src/lib/auth-form.spec.ts` → `libs/shared/core/src/lib/auth-form.spec.ts`
- Modify: `libs/shared/core/src/index.ts` và 7 file web đổi đường import

**Interfaces:**
- Consumes: `@tourism/contract` (`EmailSchema`, `PasswordSchema`, `CreateEnquiryInputSchema`, `CreateBookingInputSchema`), `@tourism/i18n` (`messages.formErrors`)
- Produces: `@tourism/core` xuất thêm `validateLogin`, `validateRegister`, `validateForgotPassword`, `validateResetPassword`, `validateChangePassword`, `validateOtp`, `validateProfileName`, `validateProfilePhone`, `OTP_LENGTH`, cùng các kiểu `LoginErrors`, `RegisterErrors`, `ResetPasswordErrors`, `ChangePasswordErrors`, `LoginField`, `RegisterField`, `ResetPasswordField`, `ChangePasswordField`

- [ ] **Step 1: Chuyển file**

```bash
git mv apps/web/src/lib/auth-form.ts libs/shared/core/src/lib/auth-form.ts
git mv apps/web/src/lib/auth-form.spec.ts libs/shared/core/src/lib/auth-form.spec.ts
```

Trong spec vừa chuyển, sửa import thành `from './auth-form.js'`. File `auth-form.ts`
chỉ import từ `@tourism/contract` và `@tourism/i18n` nên không phải sửa gì.

`libs/shared/core/src/index.ts` thành:

```ts
export * from './lib/auth-errors.js';
export * from './lib/auth-form.js';
```

- [ ] **Step 2: Chạy test package, phải XANH**

Run: `pnpm turbo run test --filter=@tourism/core`
Expected: PASS cả hai spec.

- [ ] **Step 3: Chạy web để thấy ĐỎ**

Run: `pnpm turbo run typecheck --filter=@tourism/web`
Expected: FAIL — 7 file không còn tìm thấy `@/lib/auth-form`.

- [ ] **Step 4: Đổi đường import ở 7 file web**

`change-password-form.tsx:14`, `profile-summary.tsx:16`, `forgot-password-form.tsx:8`,
`login-form.tsx:13`, `otp-form.tsx:15`, `register-form.tsx:12`, `reset-password-form.tsx:11`.

Đổi `from '@/lib/auth-form'` thành `from '@tourism/core'`. File nào đã có sẵn một
dòng import từ `@tourism/core` (do Task 1) thì **gộp vào một dòng**, nếu không
Biome báo import trùng. Ví dụ `login-form.tsx` sau khi gộp:

```ts
import {
  type AuthErrorKey,
  fieldOfAuthError,
  type LoginErrors,
  mapAuthError,
  validateLogin,
} from '@tourism/core';
```

Kiểm: `grep -rn "@/lib/auth-form" apps/web/src` phải rỗng.

- [ ] **Step 5: Format rồi chạy lại cho xanh**

Run: `pnpm lint:fix && pnpm turbo run build typecheck test --filter=@tourism/web --filter=@tourism/core`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/shared/core apps/web/src
git commit -m "refactor(core): chuyển luật kiểm ô nhập auth-form sang @tourism/core"
```
### Task 3: Hàng rào phạm vi cho `core` và cổng mobile

**Files:**
- Create: `libs/shared/core/src/lib/package-boundary.ts`, `libs/shared/core/src/lib/package-boundary.spec.ts`
- Create (test): `apps/mobile/src/lib/core-bridge.spec.ts`
- Modify: `apps/mobile/package.json` (thêm dependency `@tourism/core`)

**Interfaces:**
- Produces: `forbiddenImports(source: string): string[]` — hàm thuần, dùng lại được nếu sau này muốn canh package khác. KHÔNG export ra `src/index.ts` (đây là đồ nội bộ của package).

- [ ] **Step 1: Viết test cho hàm quét, chạy để thấy ĐỎ**

`libs/shared/core/src/lib/package-boundary.spec.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { forbiddenImports } from './package-boundary.js';

// Hàng rào ADR-0042 §3: package này chỉ được phụ thuộc @tourism/contract và
// @tourism/i18n. Luật nào người hay quên thì để máy nhớ — cùng tinh thần
// `scripts/check-mobile-tokens-only.mjs`.
describe('forbiddenImports', () => {
  it('bắt import react, react-native, next và API Node', () => {
    const source = [
      "import { useState } from 'react';",
      "import { View } from 'react-native';",
      "import { headers } from 'next/headers';",
      "import { readFileSync } from 'node:fs';",
    ].join('\n');
    expect(forbiddenImports(source)).toEqual(['react', 'react-native', 'next/headers', 'node:fs']);
  });

  it('cho qua import tương đối và hai package được phép', () => {
    const source = [
      "import { messages } from '@tourism/i18n';",
      "import { EmailSchema } from '@tourism/contract';",
      "import { mapAuthError } from './auth-errors.js';",
    ].join('\n');
    expect(forbiddenImports(source)).toEqual([]);
  });
});

describe('source thật của @tourism/core', () => {
  const files = sourceFiles(join(import.meta.dirname, '..'));

  // Tự kiểm: quét mà không thấy file nào thì test dưới xanh giả.
  it('quét được ít nhất 3 file', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('không file nào import thứ bị cấm', () => {
    const violations = files.flatMap((file) => {
      const found = forbiddenImports(readFileSync(file, 'utf8'));
      return found.map((name) => `${file}: ${name}`);
    });
    expect(violations).toEqual([]);
  });
});

/** Mọi file `.ts` trong src trừ chính các spec (spec được phép dùng node:fs). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}
```

Run: `pnpm --filter @tourism/core test`
Expected: FAIL — `package-boundary.js` chưa tồn tại.

- [ ] **Step 2: Viết hàm quét**

`libs/shared/core/src/lib/package-boundary.ts`:

```ts
/**
 * Package nào được phép đứng trong `import` của `@tourism/core` (ADR-0042 §3).
 * Thêm tên vào đây là một quyết định kiến trúc — sửa ADR trước, sửa dòng này sau.
 */
const ALLOWED_PACKAGES = new Set(['@tourism/contract', '@tourism/i18n']);

const IMPORT_SPECIFIER = /(?:from|import)\s+'([^']+)'/g;

/**
 * Trả về danh sách specifier KHÔNG được phép trong một file nguồn. Import tương
 * đối luôn hợp lệ; còn lại phải nằm trong `ALLOWED_PACKAGES`. Nhờ luật "cho phép
 * theo danh sách" nên react, react-native, next và `node:*` đều rơi ra mà không
 * cần liệt kê từng cái.
 */
export function forbiddenImports(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (specifier === undefined) continue;
    if (specifier.startsWith('.')) continue;
    if (ALLOWED_PACKAGES.has(specifier)) continue;
    found.push(specifier);
  }
  return found;
}
```

- [ ] **Step 3: Chạy lại cho xanh**

Run: `pnpm --filter @tourism/core test`
Expected: PASS (4 test).

- [ ] **Step 4: Cổng jest-expo — mobile tiêu thụ được package**

Thêm `"@tourism/core": "workspace:*"` vào `dependencies` của `apps/mobile/package.json`
(trước `@tourism/i18n`), rồi `pnpm install`.

`apps/mobile/src/lib/core-bridge.spec.ts`:

```ts
import { OTP_LENGTH, validateLogin } from '@tourism/core';

// CỔNG của ADR-0042: `@tourism/core` là ESM dist giống `@tourism/i18n`, nhưng
// "giống" không phải là "đã đo". Spec này là chỗ đo: đỏ thì DỪNG và báo user,
// không tự chế cấu hình jest riêng cho mobile.
describe('cầu sang @tourism/core', () => {
  it('nạp được luật kiểm ô nhập trong jest-expo', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: expect.any(String),
      password: expect.any(String),
    });
  });

  it('nạp được hằng số', () => {
    expect(OTP_LENGTH).toBe(6);
  });
});
```

Run: `pnpm turbo run test --filter=@tourism/mobile`
Expected: PASS. Đỏ vì transform hay resolve → **DỪNG, báo user** (ADR-0042, spec §2).

Cổng phía Metro nằm ở Task 10, vì `expo export` chỉ kéo module có người import —
màn đầu tiên dùng `core` là ở đó.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/core apps/mobile/package.json apps/mobile/src/lib/core-bridge.spec.ts pnpm-lock.yaml
git commit -m "test(core): hàng rào import cho package dùng chung và cổng tiêu thụ ở mobile"
```

### Nghiệm thu nhánh 1 (làm trước khi mở nhánh 2)

- [ ] **Step 1:** `pnpm gate:int` trọn bộ, xanh (API tạm :3001 trên docker theo nếp cũ).
- [ ] **Step 2:** `grep -rn "@/lib/auth-form\|@/lib/auth-errors" apps/web/src` rỗng.
- [ ] **Step 3:** `git diff --cached --name-only | grep docs/screenshot` rỗng.
- [ ] **Step 4:** Đẩy nhánh lên để CI soi TRƯỚC khi merge (bài học P5a: nhánh chưa từng push thì CI chưa từng chạy):

```bash
git push -u origin refactor/shared-auth-rules
gh run list --branch refactor/shared-auth-rules --limit 1
```

- [ ] **Step 5:** Báo user: nhánh 1 xong, chờ review rồi merge. **Không tự merge.**

---

# NHÁNH 2 — `feat/p5b-auth-screens`

Mở sau khi nhánh 1 đã merge vào `main`.

```bash
git switch main && git pull --ff-only && git switch -c feat/p5b-auth-screens
```

### Task 4: Dependency, cầu font, bốn khoá màu mới và `withAlpha`

**Files:**
- Modify: `apps/mobile/package.json`, `libs/mobile/ui/package.json`
- Modify: `libs/mobile/ui/src/lib/theme.ts`, `libs/mobile/ui/src/lib/theme.spec.ts`
- Modify: `libs/mobile/ui/src/lib/app-text.tsx`, `libs/mobile/ui/src/lib/app-text.spec.tsx`
- Modify: `libs/mobile/ui/src/index.ts`, `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- Produces: `withAlpha(color: string, alpha: number): string` · `MobileTheme.fonts: Record<'heading' | MobileFontWeightKey, string>` · 4 khoá màu mới trong `MOBILE_COLOR_KEYS`: `destructive-emphasis`, `input`, `on-media`, `scrim`

- [ ] **Step 1: Cài 5 dependency đã duyệt (không thêm gì khác)**

```bash
pnpm --filter @tourism/mobile add expo-linear-gradient@~57.0.1 expo-font@~57.0.3 \
  @expo-google-fonts/literata@^0.4.3 @expo-google-fonts/archivo@^0.4.2
pnpm --filter @tourism/mobile-ui add @expo/vector-icons@^15.0.2
pnpm --filter @tourism/mobile exec expo-doctor
```

`expo-doctor` phải không có mục đỏ. Nếu cổng `minimumReleaseAge` của pnpm chặn bản
nào, KHÔNG hạ chuẩn — thêm mục vào `minimumReleaseAgeExclude` trong
`pnpm-workspace.yaml` kèm một dòng comment nói vì sao, đúng nếp các đợt Next trước.

- [ ] **Step 2: Viết test cho `withAlpha` và bốn khoá màu mới, chạy để thấy ĐỎ**

Thêm vào `libs/mobile/ui/src/lib/theme.spec.ts`:

```ts
describe('withAlpha', () => {
  it('gắn alpha vào hex 6 ký tự', () => {
    expect(withAlpha('#202a28', 0.5)).toBe('#202a2880');
  });

  it('thay alpha có sẵn của hex 8 ký tự — token `scrim` đã mang alpha', () => {
    expect(withAlpha('#010a08cc', 0)).toBe('#010a0800');
  });

  it('kẹp alpha về khoảng 0–1', () => {
    expect(withAlpha('#202a28', 2)).toBe('#202a28ff');
    expect(withAlpha('#202a28', -1)).toBe('#202a2800');
  });
});

describe('khoá màu mới cho cụm auth', () => {
  it.each(['destructive-emphasis', 'input', 'on-media', 'scrim'] as const)(
    'theme có màu %s ở cả hai chế độ',
    (key) => {
      expect(buildTheme('dark').colors[key]).toMatch(/^#/);
      expect(buildTheme('light').colors[key]).toMatch(/^#/);
    },
  );
});

describe('cầu font', () => {
  it('phát ra family cho tiêu đề và từng độ đậm của chữ thân', () => {
    const { fonts } = buildTheme('dark');
    expect(fonts.heading).toBe('Literata_700Bold');
    expect(fonts.normal).toBe('Archivo_400Regular');
    expect(fonts.semibold).toBe('Archivo_600SemiBold');
  });
});
```

Run: `pnpm --filter @tourism/mobile-ui test`
Expected: FAIL — `withAlpha` chưa có, `MOBILE_COLOR_KEYS` chưa có 4 khoá, `fonts` chưa có.

- [ ] **Step 3: Sửa `theme.ts`**

Thêm 4 khoá vào `MOBILE_COLOR_KEYS` (giữ thứ tự alphabet trong nhóm):

```ts
export const MOBILE_COLOR_KEYS = [
  'background',
  'foreground',
  'card',
  'muted',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'border',
  // P5b-1: bốn khoá cụm auth thật sự dùng — chữ trên ảnh, lỗi, viền ô nhập,
  // và màu phủ ảnh. Danh sách này vẫn là CURATED (xem JSDoc phía trên).
  'destructive-emphasis',
  'input',
  'on-media',
  'scrim',
] as const;
```

Thêm map font và hàm `withAlpha`:

```ts
/**
 * Tên family của từng khuôn chữ. Cầu token KHÔNG mang font family (ADR-0013 chỉ
 * mang màu, bo góc và type scale), nên map này là chỗ duy nhất khai tên — trùng
 * với bộ chữ web đang dùng: Literata cho tiêu đề, Archivo cho chữ thân.
 */
export const MOBILE_FONTS = {
  heading: 'Literata_700Bold',
  normal: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
} as const;

/**
 * Gắn alpha vào một màu token. Nhận cả hex 6 lẫn 8 ký tự vì token `scrim` đã
 * mang sẵn alpha. Nhờ hàm này mà dải mờ trên ảnh vẫn suy từ token, không ai
 * phải gõ `rgba()` — thứ mà `check-mobile-tokens-only.mjs` sẽ bắt.
 */
export function withAlpha(color: string, alpha: number): string {
  const base = color.slice(0, 7);
  const clamped = Math.min(1, Math.max(0, alpha));
  const hex = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${base}${hex}`;
}
```

Trong `MobileTheme` thêm `fonts: Record<'heading' | MobileFontWeightKey, string>;`
và trong `buildTheme` trả `fonts: MOBILE_FONTS`.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `pnpm --filter @tourism/mobile-ui test`
Expected: PASS.

- [ ] **Step 5: `AppText` dùng font family, bỏ `fontWeight`**

Test trước, thêm vào `app-text.spec.tsx`:

```ts
it('tiêu đề dùng family Literata và KHÔNG đặt fontWeight', () => {
  render(<AppText variant="display">Xin chào</AppText>, { wrapper: Providers });
  const style = screen.getByText('Xin chào').props.style;
  expect(style).toMatchObject({ fontFamily: 'Literata_700Bold' });
  expect(style.fontWeight).toBeUndefined();
});

it('chữ thân dùng family Archivo theo độ đậm của bậc chữ', () => {
  render(<AppText variant="label">Nhãn</AppText>, { wrapper: Providers });
  expect(screen.getByText('Nhãn').props.style).toMatchObject({
    fontFamily: 'Archivo_500Medium',
  });
});
```

Rồi sửa `app-text.tsx`: `display` và `title` lấy `theme.fonts.heading`, các bậc còn
lại lấy `theme.fonts[weight]`; bỏ hẳn khoá `fontWeight` khỏi style vì family đã
mang sẵn độ đậm (đặt cả hai thì Android tự bóp chữ thành đậm giả).

Run: `pnpm --filter @tourism/mobile-ui test` → PASS.

- [ ] **Step 6: Nạp font ở layout gốc**

Trong `apps/mobile/src/app/_layout.tsx`: nạp 5 khuôn chữ bằng `useFonts`, và CHỈ gỡ
splash khi font đã sẵn sàng. Cây React vẫn render ngay từ đầu — không `return null`
khi font chưa xong, vì như vậy `routes.spec.tsx` (và người dùng thật lúc mạng chậm)
sẽ thấy màn trắng:

```tsx
const [fontsLoaded] = useFonts({
  Literata_700Bold,
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
});

useEffect(() => {
  if (fontsLoaded) void SplashScreen.hideAsync();
}, [fontsLoaded]);
```

- [ ] **Step 7: Xuất `withAlpha` và chạy toàn bộ**

`libs/mobile/ui/src/index.ts` thêm `withAlpha` và `MOBILE_FONTS` vào dòng export của `./lib/theme`.

Run: `pnpm gate`
Expected: PASS, và `check-mobile-tokens-only.mjs` vẫn xanh.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile libs/mobile/ui pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(mobile-ui): cầu font brand, bốn khoá màu cụm auth và hàm withAlpha"
```
### Task 5: Primitive `TextField` và `FormMessage`

**Files:**
- Create: `libs/mobile/ui/src/lib/text-field.tsx` (+ `text-field.spec.tsx`), `libs/mobile/ui/src/lib/form-message.tsx` (+ `form-message.spec.tsx`)
- Modify: `libs/mobile/ui/src/index.ts`

**Interfaces:**
- Consumes: `useTheme()`, `AppText`, `@expo/vector-icons/Feather`
- Produces:
  - `TextField(props: TextFieldProps)` với `TextFieldProps = Omit<TextInputProps, 'style' | 'placeholder'> & { label: string; value: string; icon?: FeatherIconName; error?: string; secure?: boolean; revealLabel?: string; hideLabel?: string }`
  - `FormMessage(props: { tone: 'error' | 'info'; children: string })`
  - `type FeatherIconName = ComponentProps<typeof Feather>['name']`

- [ ] **Step 1: Viết test cho `TextField`, chạy để thấy ĐỎ**

`libs/mobile/ui/src/lib/text-field.spec.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { TextField } from './text-field';

describe('TextField', () => {
  it('ô trống thì nhãn đứng làm placeholder', async () => {
    await renderWithTheme(<TextField label="Email" value="" onChangeText={() => {}} />);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('ô có giá trị thì nhãn thu nhỏ hiện lên trên', async () => {
    await renderWithTheme(<TextField label="Email" value="lan@example.com" onChangeText={() => {}} />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByDisplayValue('lan@example.com')).toBeTruthy();
  });

  it('có lỗi thì in câu lỗi và đánh dấu ô sai cho trình đọc màn hình', async () => {
    await renderWithTheme(
      <TextField label="Email" value="lan@" error="Enter a valid email address." onChangeText={() => {}} />,
    );
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByDisplayValue('lan@').props['aria-invalid']).toBe(true);
  });

  it('ô mật khẩu che chữ và nút hiện/ẩn đổi trạng thái', async () => {
    await renderWithTheme(
      <TextField
        label="Password"
        value="secret123"
        secure
        revealLabel="Show password"
        hideLabel="Hide password"
        onChangeText={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('secret123').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByDisplayValue('secret123').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Hide password')).toBeTruthy();
  });
});
```

`renderWithTheme(ui, scheme)` là helper sẵn có ở `libs/mobile/ui/src/test-utils.tsx`
(bọc `SafeAreaProvider` + `ThemeProvider`, mặc định chế độ sáng); `themeFor(scheme)`
ở cùng file trả theme để spec đối chiếu giá trị token. Đừng đẻ thêm helper mới.

Run: `pnpm --filter @tourism/mobile-ui test -- text-field`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 2: Viết `TextField`**

Yêu cầu bố cục (theo mockup): một hàng cao 46dp, icon bên trái, gạch chân bằng
`border` (lỗi thì `destructive-emphasis`), nhãn thu nhỏ 10dp nằm trên giá trị khi
ô đã có chữ, nút hiện/ẩn bên phải khi `secure`. Màu lấy hết từ `useTheme()`, không
một hex nào. Câu lỗi là `AppText` `variant="caption"` màu `destructive-emphasis`,
kèm `accessibilityRole="alert"` để trình đọc màn hình đọc ngay khi nó xuất hiện.

- [ ] **Step 3: Chạy lại cho xanh**

Run: `pnpm --filter @tourism/mobile-ui test -- text-field`
Expected: PASS (4 test).

- [ ] **Step 4: Viết test cho `FormMessage`, chạy để thấy ĐỎ**

`libs/mobile/ui/src/lib/form-message.spec.tsx`:

```tsx
import { screen } from '@testing-library/react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { FormMessage } from './form-message';

describe('FormMessage', () => {
  it('tông lỗi đọc được như một cảnh báo', async () => {
    await renderWithTheme(<FormMessage tone="error">Invalid email or password.</FormMessage>);
    const node = screen.getByText('Invalid email or password.');
    expect(node).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('tông thông tin dùng nền secondary của token', async () => {
    await renderWithTheme(<FormMessage tone="info">We sent a new code.</FormMessage>, 'dark');
    expect(screen.getByRole('alert').props.style).toMatchObject({
      backgroundColor: themeFor('dark').colors.secondary,
    });
  });
});
```

Run: `pnpm --filter @tourism/mobile-ui test -- form-message` → FAIL.

- [ ] **Step 5: Viết `FormMessage`**

Khung bo góc, `accessibilityRole="alert"`, icon `alert-circle` cho tông lỗi và
`mail` cho tông thông tin. Tông lỗi: nền `withAlpha(colors.destructive-emphasis, 0.16)`,
viền `withAlpha(colors['destructive-emphasis'], 0.45)`. Tông thông tin: nền
`colors.secondary`, chữ `colors['secondary-foreground']`.

Run lại → PASS.

- [ ] **Step 6: Xuất ra `index.ts` rồi commit**

```bash
git add libs/mobile/ui/src
git commit -m "feat(mobile-ui): primitive TextField và FormMessage cho form auth"
```

### Task 6: Primitive `OtpInput`, `Checkbox`, `IconButton`

**Files:**
- Create: `libs/mobile/ui/src/lib/otp-input.tsx` (+ spec), `checkbox.tsx` (+ spec), `icon-button.tsx` (+ spec)
- Modify: `libs/mobile/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `OtpInput(props: { value: string; onChangeText: (next: string) => void; accessibilityLabel: string; length?: number; invalid?: boolean; autoFocus?: boolean })`
  - `Checkbox(props: { checked: boolean; onValueChange: (next: boolean) => void; accessibilityLabel: string; children: ReactNode })`
  - `IconButton(props: { icon: FeatherIconName; accessibilityLabel: string; onPress: () => void; variant?: 'glass' | 'plain' })`

- [ ] **Step 1: Test `OtpInput` trước**

```tsx
it('bỏ ký tự không phải số và chặn quá độ dài', async () => {
  const onChangeText = jest.fn();
  await renderWithTheme(<OtpInput value="" accessibilityLabel="Verification code" onChangeText={onChangeText} />, 'dark');
  fireEvent.changeText(screen.getByLabelText('Verification code'), '4a8-2 190999');
  expect(onChangeText).toHaveBeenCalledWith('482190');
});

it('vẽ đủ 6 ô và in từng chữ số đã nhập', async () => {
  await renderWithTheme(<OtpInput value="482" accessibilityLabel="Verification code" onChangeText={() => {}} />, 'dark');
  expect(screen.getAllByTestId('otp-cell')).toHaveLength(6);
  expect(screen.getByText('4')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
});

it('trạng thái sai đổi màu gạch chân của mọi ô', async () => {
  await renderWithTheme(
    <OtpInput value="482190" invalid accessibilityLabel="Verification code" onChangeText={() => {}} />,
    'dark',
  );
  const cells = screen.getAllByTestId('otp-cell');
  expect(cells.every((cell) => cell.props.style.borderBottomColor === themeFor('dark').colors['destructive-emphasis'])).toBe(true);
});
```

Test đối chiếu với `themeFor('dark').colors[...]` chứ không gõ hex: vừa chứng minh
component lấy đúng token, vừa không tự dựng thêm một nguồn màu thứ hai trong spec.

Run → FAIL.

- [ ] **Step 2: Viết `OtpInput`**

Một `TextInput` trong suốt phủ lên trên (`keyboardType="number-pad"`,
`maxLength={length}`, lọc `replace(/\D/g, '')` trước khi gọi `onChangeText`), phía
dưới là `length` ô `View` có `testID="otp-cell"`, chèn một gạch ngang giữa nhóm 3
và nhóm 4. Ô đang nhập có gạch chân `primary-emphasis`; `invalid` thì mọi ô dùng
`destructive-emphasis`.

Run → PASS.

- [ ] **Step 3: Test rồi viết `Checkbox`**

```tsx
it('bấm thì đảo trạng thái và khai đúng cho trình đọc màn hình', async () => {
  const onValueChange = jest.fn();
  await renderWithTheme(
    <Checkbox checked={false} accessibilityLabel="Agree to terms" onValueChange={onValueChange}>
      <AppText>I agree</AppText>
    </Checkbox>,
  );
  const box = screen.getByLabelText('Agree to terms');
  expect(box.props.accessibilityState).toMatchObject({ checked: false });
  fireEvent.press(box);
  expect(onValueChange).toHaveBeenCalledWith(true);
});
```

`accessibilityRole="checkbox"`, ô 18dp bo 5dp, khi `checked` thì nền `primary` và
icon `check` màu `primary-foreground`.

- [ ] **Step 4: Test rồi viết `IconButton`**

```tsx
it('vùng chạm không nhỏ hơn ngưỡng a11y của token', async () => {
  await renderWithTheme(<IconButton icon="x" accessibilityLabel="Close" onPress={() => {}} />);
  const button = screen.getByLabelText('Close');
  expect(button.props.style.minWidth).toBeGreaterThanOrEqual(44);
  expect(button.props.style.minHeight).toBeGreaterThanOrEqual(44);
});
```

`variant="glass"` (nền `withAlpha(colors.scrim, 0.45)`, chữ `on-media` — dùng khi
nút nằm trên ảnh) và `variant="plain"` (trong suốt, chữ `foreground`).

- [ ] **Step 5: Xuất ra `index.ts`, chạy cả gói, commit**

Run: `pnpm --filter @tourism/mobile-ui test` → PASS toàn bộ.

```bash
git add libs/mobile/ui/src
git commit -m "feat(mobile-ui): primitive OtpInput, Checkbox và IconButton"
```

### Task 7: Copy tiếng Anh cho cụm auth trong `@tourism/i18n`

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts`, `libs/shared/i18n/src/lib/messages.spec.ts`

**Interfaces:**
- Produces: `messages.mobile.auth` (khối mới) và ba tiêu đề route mới trong `messages.mobile.appShell.titles`: `verifyEmail`, `resetPassword`, `success`

**Dùng LẠI, không chép:** câu lỗi ở `messages.authForms.errors` và `messages.formErrors`;
`authForms.forgotPassword.submit` + `.sentBody`; `authForms.resetPassword.invalidToken.*`
và `.toast.*`; `authForms.verifyEmail.existingAccountHint` và `.toast.*`. Màn 5b, 5d,
6a, 6b lấy chữ từ đúng các khoá đó.

- [ ] **Step 1: Viết test trước**

Thêm vào `messages.spec.ts`:

```ts
describe('copy cụm auth mobile', () => {
  it('mọi khoá đều có chữ, không khoá nào rỗng', () => {
    const rong: string[] = [];
    const duyet = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (node.trim() === '') rong.push(path);
        return;
      }
      if (Array.isArray(node)) return node.forEach((item, i) => duyet(item, `${path}[${i}]`));
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) duyet(value, `${path}.${key}`);
      }
    };
    duyet(messages.mobile.auth, 'mobile.auth');
    expect(rong).toEqual([]);
  });

  it('onboarding có đúng ba trang, mỗi trang đủ địa danh, tiêu đề và mô tả', () => {
    expect(messages.mobile.auth.onboarding.slides).toHaveLength(3);
    for (const slide of messages.mobile.auth.onboarding.slides) {
      expect(slide.place.length).toBeGreaterThan(0);
      expect(slide.title.length).toBeGreaterThan(0);
      expect(slide.body.length).toBeGreaterThan(0);
    }
  });

  it('có tiêu đề cho ba route mới', () => {
    const { titles } = messages.mobile.appShell;
    expect(titles.verifyEmail).toBeTruthy();
    expect(titles.resetPassword).toBeTruthy();
    expect(titles.success).toBeTruthy();
  });
});
```

Run: `pnpm --filter @tourism/i18n test` → FAIL.

- [ ] **Step 2: Thêm copy**

Trong `messages.mobile`, thêm `auth` ngay sau `appShell`. Chữ lấy nguyên từ mockup
đã duyệt:

```ts
auth: {
  splash: { tagline: 'Tours across Vietnam' },
  onboarding: {
    skip: 'Skip',
    next: 'Next',
    start: 'Get started',
    haveAccount: 'I already have an account',
    slides: [
      {
        place: 'Hoi An, Vietnam',
        title: 'Discover Vietnam, north to south',
        body: 'Small-group tours across all three regions, led by local guides.',
      },
      {
        place: 'Lan Ha Bay, Vietnam',
        title: 'Book a real departure',
        body: 'Pick a date, see how many seats are left, and pay securely.',
      },
      {
        place: 'Ben Tre, Vietnam',
        title: 'Your trips in your pocket',
        body: 'Save the tours you love and keep every booking in one place.',
      },
    ],
  },
  signIn: {
    title: 'Welcome back',
    body: 'Sign in to save tours and manage your trips.',
    email: 'Email',
    password: 'Password',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    google: 'Continue with Google',
    or: 'or',
    footer: 'New to Nexora?',
    footerAction: 'Create account',
    photoPlace: 'Ha Giang, Vietnam',
  },
  register: {
    title: 'Create account',
    body: 'Join to save tours and book in minutes.',
    name: 'Full name',
    terms: 'I agree to the',
    termsLink: 'Terms',
    termsAnd: 'and',
    privacyLink: 'Privacy Policy',
    submit: 'Create account',
    footer: 'Already have an account?',
    footerAction: 'Sign in',
    photoPlace: 'Sa Pa, Vietnam',
  },
  verifyEmail: {
    title: 'Check your email',
    body: 'Enter the 6-digit code we sent to',
    blockedBody: "Your email isn't verified yet. We just sent a fresh code to",
    codeLabel: 'Verification code',
    resendIn: 'Resend code in',
    resendPrompt: "Didn't get it?",
    resendAction: 'Resend code',
    resent: 'We sent a new code. It expires in 10 minutes.',
    submit: 'Verify',
  },
  forgotPassword: {
    title: 'Forgot password?',
    body: "Enter the email you signed up with. We'll send you a link to reset your password.",
    sentTitle: 'Check your inbox',
    sentTo: 'Sent to',
    backToSignIn: 'Back to sign in',
  },
  resetPassword: {
    title: 'Set a new password',
    body: "Use at least 8 characters. For your security, we'll sign you out on all devices.",
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    submit: 'Save password',
  },
  success: { signIn: 'Sign in' },
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  back: 'Back',
},
```

Và ba tiêu đề route mới trong `appShell.titles`:

```ts
verifyEmail: 'Verify email',
resetPassword: 'Reset password',
success: 'All set',
```

Run: `pnpm --filter @tourism/i18n test` → PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/shared/i18n/src
git commit -m "feat(i18n): copy tiếng Anh cho cụm auth mobile"
```

### Task 8: Hợp đồng `AuthActions`, bản giả lập và hàm chọn kênh lỗi

**Files:**
- Create: `apps/mobile/src/features/auth/auth-actions.ts`, `mock-auth-actions.ts` (+ `mock-auth-actions.spec.ts`), `error-channel.ts` (+ `error-channel.spec.ts`)
- Modify: `libs/shared/core/src/lib/auth-errors.ts` (+ spec) — thêm ô `otp`
- Modify: `apps/mobile/src/app/_layout.tsx` (bọc provider)

**Interfaces:**
- Consumes: `AuthErrorKey`, `fieldOfAuthError` từ `@tourism/core`; `messages.authForms.errors` từ `@tourism/i18n`
- Produces:
  - `type AuthFailure = AuthErrorKey | 'emailNotVerified'`
  - `type AuthResult = { ok: true } | { ok: false; error: AuthFailure }`
  - `interface AuthActions` (7 method như spec §6) · `AuthActionsProvider` · `useAuthActions(): AuthActions`
  - `createMockAuthActions(options?: { delayMs?: number }): AuthActions`
  - `type AuthScreenName = 'signIn' | 'register' | 'verifyEmail' | 'forgotPassword' | 'resetPassword'`
  - `placeAuthError(key: AuthErrorKey, screen: AuthScreenName): ErrorPlacement` với `ErrorPlacement = { channel: 'field'; field: AuthErrorField; text: string } | { channel: 'form'; text: string } | { channel: 'screen'; state: 'invalidLink' }`

- [ ] **Step 1: Mở rộng `fieldOfAuthError` cho ô OTP (test trước)**

Thêm vào `libs/shared/core/src/lib/auth-errors.spec.ts`:

```ts
it('mã OTP sai thuộc về ô nhập mã, không phải lỗi cấp form', () => {
  expect(fieldOfAuthError('invalidOtp')).toBe('otp');
});
```

Run: `pnpm --filter @tourism/core test` → FAIL.

Rồi sửa `auth-errors.ts`: `AuthErrorField` thêm `| 'otp'`, và `switch` thêm
`case 'invalidOtp': return 'otp';`. Comment tiếng Việt nói rõ vì sao: web có form
OTP riêng nên trước đây không cần, mobile dùng chung một hàm chọn kênh cho mọi màn.

Run lại → PASS. Chạy thêm `pnpm turbo run typecheck test --filter=@tourism/web` để
chắc chắn web không đổi hành vi (không chỗ nào dùng `Record<AuthErrorField, …>`).

- [ ] **Step 2: Test cho `placeAuthError`, chạy để thấy ĐỎ**

`apps/mobile/src/features/auth/error-channel.spec.ts`:

```ts
import { messages } from '@tourism/i18n';
import { placeAuthError } from './error-channel';

describe('placeAuthError', () => {
  it('lỗi quy được về ô thì rơi vào kênh 1', () => {
    expect(placeAuthError('invalidEmail', 'register')).toEqual({
      channel: 'field',
      field: 'email',
      text: messages.authForms.errors.invalidEmail,
    });
  });

  it('mã OTP sai rơi vào ô otp', () => {
    expect(placeAuthError('invalidOtp', 'verifyEmail')).toMatchObject({ channel: 'field', field: 'otp' });
  });

  it('sai thông tin đăng nhập là kênh 2 vì không quy được về ô nào', () => {
    expect(placeAuthError('invalidCredentials', 'signIn')).toEqual({
      channel: 'form',
      text: messages.authForms.errors.invalidCredentials,
    });
  });

  it('link hỏng ở màn đặt lại mật khẩu là kênh 3', () => {
    expect(placeAuthError('invalidToken', 'resetPassword')).toEqual({ channel: 'screen', state: 'invalidLink' });
  });

  it('cùng mã đó ở màn khác vẫn là kênh 2 — chỉ màn reset mới hết đường dùng', () => {
    expect(placeAuthError('invalidToken', 'signIn')).toMatchObject({ channel: 'form' });
  });
});
```

- [ ] **Step 3: Viết `error-channel.ts`**

```ts
import { type AuthErrorField, type AuthErrorKey, fieldOfAuthError } from '@tourism/core';
import { messages } from '@tourism/i18n';

export type AuthScreenName = 'signIn' | 'register' | 'verifyEmail' | 'forgotPassword' | 'resetPassword';

export type ErrorPlacement =
  | { channel: 'field'; field: AuthErrorField; text: string }
  | { channel: 'form'; text: string }
  | { channel: 'screen'; state: 'invalidLink' };

/**
 * Một chỗ DUY NHẤT quyết lỗi hiện ở đâu (spec §5) — màn không tự chọn, nên hai
 * màn không thể nói khác nhau về cùng một mã lỗi.
 */
export function placeAuthError(key: AuthErrorKey, screen: AuthScreenName): ErrorPlacement {
  if (key === 'invalidToken' && screen === 'resetPassword') {
    return { channel: 'screen', state: 'invalidLink' };
  }
  const field = fieldOfAuthError(key);
  const text = messages.authForms.errors[key];
  return field === null ? { channel: 'form', text } : { channel: 'field', field, text };
}
```

Run: `pnpm turbo run test --filter=@tourism/mobile` → PASS.

- [ ] **Step 4: Hợp đồng và bản giả lập (test trước)**

`mock-auth-actions.spec.ts` kiểm ĐÚNG bảng kịch bản của spec §6:

```ts
import { createMockAuthActions } from './mock-auth-actions';

const actions = createMockAuthActions({ delayMs: 0 });

describe('bản giả lập AuthActions', () => {
  it.each([
    ['unverified@example.com', 'correct-horse', 'emailNotVerified'],
    ['lan@example.com', 'wrong-password', 'invalidCredentials'],
    ['busy@example.com', 'correct-horse', 'tooManyRequests'],
    ['offline@example.com', 'correct-horse', 'generic'],
  ])('đăng nhập %s trả lỗi %s', async (email, password, error) => {
    await expect(actions.signInWithEmail({ email, password })).resolves.toEqual({ ok: false, error });
  });

  it('đăng nhập hợp lệ thì thành công', async () => {
    await expect(actions.signInWithEmail({ email: 'lan@example.com', password: 'correct-horse' })).resolves.toEqual({
      ok: true,
    });
  });

  it('mã 000000 là mã sai, mã khác thì xác minh xong', async () => {
    await expect(actions.verifyEmail({ email: 'lan@example.com', otp: '000000' })).resolves.toEqual({
      ok: false,
      error: 'invalidOtp',
    });
    await expect(actions.verifyEmail({ email: 'lan@example.com', otp: '482190' })).resolves.toEqual({ ok: true });
  });

  it('token expired là link hỏng', async () => {
    await expect(actions.resetPassword({ token: 'expired', newPassword: 'correct-horse' })).resolves.toEqual({
      ok: false,
      error: 'invalidToken',
    });
  });

  it('Google chưa bật', async () => {
    await expect(actions.signInWithGoogle()).resolves.toEqual({ ok: false, error: 'notAvailable' });
  });

  it('quên mật khẩu luôn báo thành công, kể cả email lạ', async () => {
    await expect(actions.requestPasswordReset({ email: 'khong-ton-tai@example.com' })).resolves.toEqual({ ok: true });
  });
});
```

- [ ] **Step 5: Viết `auth-actions.ts` và `mock-auth-actions.ts`**

`auth-actions.ts` khai kiểu như phần **Interfaces** ở trên, cộng context:

```ts
const AuthActionsContext = createContext<AuthActions | null>(null);

export const AuthActionsProvider = AuthActionsContext.Provider;

/** Ném lỗi rõ nghĩa thay vì trả undefined — cùng nếp `useTheme` của mobile-ui. */
export function useAuthActions(): AuthActions {
  const actions = useContext(AuthActionsContext);
  if (actions === null) {
    throw new Error('useAuthActions phải nằm trong <AuthActionsProvider>');
  }
  return actions;
}
```

`mock-auth-actions.ts` là bảng kịch bản thuần, trễ `delayMs` (mặc định 600) để thấy
được trạng thái đang gửi trên máy thật. Comment đầu file phải nói: đây là chỗ DUY
NHẤT người làm hạ tầng thay, và thay bằng cách viết bản `@better-auth/expo` cùng
hình dạng rồi đổi provider.

- [ ] **Step 6: Bọc provider ở layout gốc**

Trong `apps/mobile/src/app/_layout.tsx`, bọc `<AuthActionsProvider value={mockAuthActions}>`
quanh `RootStack` (bên trong `ThemeProvider`). Giá trị dựng một lần ở module scope
(`const mockAuthActions = createMockAuthActions()`), không dựng lại mỗi lần render.

Run: `pnpm turbo run test --filter=@tourism/mobile` → PASS (cả `routes.spec.tsx` cũ).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src libs/shared/core/src
git commit -m "feat(mobile): hợp đồng AuthActions, bản giả lập và hàm chọn kênh lỗi"
```
### Task 9: Mảnh dựng chung của cụm auth — ảnh đầu trang, logo, màn kết quả

**Files:**
- Create: `apps/mobile/src/features/auth/auth-media.ts`, `brand-mark.tsx` (+ spec), `auth-hero.tsx` (+ spec), `result-screen.tsx` (+ spec)

**Interfaces:**
- Produces:
  - `AUTH_PHOTOS: { signIn: { uri: string }; register: { uri: string }; result: { uri: string }; onboarding: readonly [{ uri: string }, { uri: string }, { uri: string }] }`
  - `BrandMark(props: { size?: 'sm' | 'lg' })`
  - `AuthHero(props: { image: { uri: string }; place?: string; exit: { icon: 'x' | 'arrow-left'; label: string; onPress: () => void }; height?: 'tall' | 'short' })`
  - `ResultScreen(props: { icon: FeatherIconName; title: string; body: string; actionLabel: string; onAction: () => void })`

- [ ] **Step 1: `auth-media.ts` — URL ảnh của bản giả lập**

```ts
// Ảnh cho bản giả lập: lấy thẳng từ các khe site-media mà web đang dùng trên
// Cloudinary. Khi nối API thật, người làm hạ tầng đổi chỗ này sang dữ liệu khe
// site-media thay vì URL cứng (xem docs/conventions/mobile-auth-handoff.md).
const BASE = 'https://res.cloudinary.com/dbkgeehow/image/upload';

export const AUTH_PHOTOS = {
  signIn: { uri: `${BASE}/c_fill,w_648,h_600,q_auto,f_auto/v1787055535/tourism/catalog/site/moment-hagiang-valley` },
  register: { uri: `${BASE}/c_fill,w_648,h_460,q_auto,f_auto/v1786976718/tourism/catalog/site/auth-panel` },
  result: { uri: `${BASE}/c_fill,w_648,h_600,q_auto,f_auto/v1786710835/tourism/catalog/site/cta-band` },
  onboarding: [
    { uri: `${BASE}/c_fill,w_648,h_1400,q_auto,f_auto/v1787055538/tourism/catalog/site/moment-hoian-river` },
    { uri: `${BASE}/c_fill,w_648,h_1400,q_auto,f_auto/v1787055544/tourism/catalog/site/moment-lanha-kayak` },
    { uri: `${BASE}/c_fill,w_648,h_1400,q_auto,f_auto/v1787055534/tourism/catalog/site/moment-bentre-canal` },
  ],
} as const;
```

- [ ] **Step 2: `BrandMark` — test trước**

```tsx
it('vẽ hai viên kim cương, viên sau màu primary và viên trước màu foreground', async () => {
  await renderWithTheme(<BrandMark />, 'dark');
  const [back, front] = screen.getAllByTestId('brand-diamond');
  expect(back.props.style).toMatchObject({ backgroundColor: themeFor('dark').colors.primary });
  expect(front.props.style).toMatchObject({ backgroundColor: themeFor('dark').colors.foreground });
});
```

Viết bằng hai `View` xoay 45 độ (`transform: [{ rotate: '45deg' }]`), không cần
`react-native-svg`. `size="lg"` dùng cho splash và onboarding.

- [ ] **Step 3: `AuthHero` — test trước**

```tsx
it('có nút thoát đọc được và nhãn địa danh', async () => {
  const onPress = jest.fn();
  await renderWithTheme(
    <AuthHero image={{ uri: 'https://example.test/a.jpg' }} place="Ha Giang, Vietnam" exit={{ icon: 'x', label: 'Close', onPress }} />,
  );
  expect(screen.getByText('Ha Giang, Vietnam')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close'));
  expect(onPress).toHaveBeenCalled();
});
```

Bố cục: `ImageBackground` cao 300dp (`height="short"` → 230dp), phủ lên là
`LinearGradient` với 4 chặng suy từ token bằng `withAlpha` — trên cùng
`withAlpha(colors.scrim, 0.45)`, giữa `withAlpha(colors.background, 0)` rồi
`withAlpha(colors.background, 0.55)`, dưới cùng `colors.background`. Nút thoát là
`IconButton variant="glass"`, nhãn địa danh dùng `AppText variant="caption"` màu
`on-media` kèm icon `map-pin`.

- [ ] **Step 4: `ResultScreen` — test trước**

```tsx
it('in tiêu đề, nội dung và nút đi tiếp', async () => {
  const onAction = jest.fn();
  await renderWithTheme(
    <ResultScreen icon="check" title="Email verified" body="Welcome aboard." actionLabel="Sign in" onAction={onAction} />,
  );
  expect(screen.getByText('Email verified')).toBeTruthy();
  fireEvent.press(screen.getByText('Sign in'));
  expect(onAction).toHaveBeenCalled();
});
```

Bố cục theo khung 6a: `AuthHero` ảnh `AUTH_PHOTOS.result` không nút thoát, vòng tròn
96dp nền `primary` có icon, tiêu đề `display`, nội dung `body` canh giữa, nút primary
ghim đáy.

- [ ] **Step 5: Chạy, xanh, commit**

```bash
pnpm turbo run test --filter=@tourism/mobile
git add apps/mobile/src/features/auth
git commit -m "feat(mobile): ảnh đầu trang, logo và màn kết quả cho cụm auth"
```

### Task 10: Màn Sign in và Create account (khung 2a, 2b, 3a, 3b) + cổng Metro

**Files:**
- Create: `apps/mobile/src/features/auth/sign-in-flow.ts` (+ spec), `sign-in-screen.tsx` (+ spec), `register-flow.ts` (+ spec), `register-screen.tsx` (+ spec)
- Modify: `apps/mobile/src/app/(auth)/login.tsx`, `apps/mobile/src/app/(auth)/register.tsx`

**Interfaces:**
- Consumes: `AuthActions`, `placeAuthError`, `validateLogin`, `validateRegister` (từ `@tourism/core`), `TextField`, `FormMessage`, `Checkbox`, `Button`, `AuthHero`
- Produces:
  - `submitSignIn(input: { email: string; password: string }, actions: AuthActions): Promise<SignInOutcome>` với `SignInOutcome = { kind: 'success' } | { kind: 'fieldErrors'; errors: LoginErrors } | { kind: 'formMessage'; tone: 'error'; text: string } | { kind: 'verifyEmail'; email: string }`
  - `submitRegister(input: { name: string; email: string; password: string }, actions: AuthActions): Promise<RegisterOutcome>` với `RegisterOutcome = { kind: 'verifyEmail'; email: string } | { kind: 'fieldErrors'; errors: RegisterErrors } | { kind: 'formMessage'; tone: 'error'; text: string }`
  - `SignInScreen(props)` / `RegisterScreen(props)` — component CHỈ vẽ, nhận `values`, `fieldErrors`, `formMessage`, `pending` và các hàm `on*`

- [ ] **Step 1: Test `submitSignIn` (logic thuần, không render)**

```ts
const ok: AuthActions = { ...createMockAuthActions({ delayMs: 0 }) };

it('ô trống thì chặn ngay ở máy, không gọi tới action', async () => {
  const signInWithEmail = jest.fn();
  const outcome = await submitSignIn({ email: '', password: '' }, { ...ok, signInWithEmail });
  expect(outcome).toMatchObject({ kind: 'fieldErrors' });
  expect(signInWithEmail).not.toHaveBeenCalled();
});

it('sai thông tin thì ra khung cấp form', async () => {
  const outcome = await submitSignIn({ email: 'lan@example.com', password: 'wrong-password' }, ok);
  expect(outcome).toEqual({
    kind: 'formMessage',
    tone: 'error',
    text: messages.authForms.errors.invalidCredentials,
  });
});

it('email chưa xác minh thì chuyển màn chứ không phải lỗi', async () => {
  const outcome = await submitSignIn({ email: 'unverified@example.com', password: 'correct-horse' }, ok);
  expect(outcome).toEqual({ kind: 'verifyEmail', email: 'unverified@example.com' });
});

it('đăng nhập được thì báo thành công', async () => {
  await expect(submitSignIn({ email: 'lan@example.com', password: 'correct-horse' }, ok)).resolves.toEqual({
    kind: 'success',
  });
});
```

- [ ] **Step 2: Viết `sign-in-flow.ts`**

Thứ tự bắt buộc: `validateLogin` trước (kênh 1, không tốn một lượt gọi nào), rồi mới
gọi `actions.signInWithEmail`, rồi `placeAuthError(error, 'signIn')` để chọn kênh.
`emailNotVerified` KHÔNG đi qua `placeAuthError` — nó là lệnh chuyển màn.

- [ ] **Step 3: Test `submitRegister` tương tự, rồi viết `register-flow.ts`**

Khác hai chỗ: kiểm bằng `validateRegister` (có ô `name`), và **thành công cũng dẫn
sang verify-email** — API cố ý trả thành công cả khi email đã có tài khoản, nên màn
verify là nơi duy nhất nói được chuyện đó (dùng `authForms.verifyEmail.existingAccountHint`).

- [ ] **Step 4: Test màn Sign in theo 4 trạng thái của mockup**

```tsx
const base = {
  values: { email: '', password: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  onGoogle: jest.fn(),
  onForgot: jest.fn(),
  onRegister: jest.fn(),
  onClose: jest.fn(),
};

it('2a trống: đủ hai ô, nút chính và đường sang đăng ký', async () => {
  await renderWithTheme(<SignInScreen {...base} />);
  expect(screen.getByPlaceholderText(messages.mobile.auth.signIn.email)).toBeTruthy();
  expect(screen.getByText(messages.mobile.auth.signIn.submit)).toBeTruthy();
  expect(screen.getByText(messages.mobile.auth.signIn.footerAction)).toBeTruthy();
});

it('2b lỗi cấp form: khung lỗi nằm ngay trên nút chính', async () => {
  await renderWithTheme(
    <SignInScreen {...base} formMessage={{ tone: 'error', text: messages.authForms.errors.invalidCredentials }} />,
  );
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByText(messages.authForms.errors.invalidCredentials)).toBeTruthy();
});

it('lỗi của ô hiện dưới đúng ô', async () => {
  await renderWithTheme(<SignInScreen {...base} fieldErrors={{ email: messages.formErrors.email.invalid }} />);
  expect(screen.getByText(messages.formErrors.email.invalid)).toBeTruthy();
});

it('đang gửi thì khoá nút chính', async () => {
  await renderWithTheme(<SignInScreen {...base} pending />);
  expect(screen.getByText(messages.authForms.login.submitting)).toBeTruthy();
});
```

- [ ] **Step 5: Viết `SignInScreen` và `RegisterScreen`**

Bố cục theo mockup: `AuthHero` (ảnh + nút X) → tiêu đề `display` → phụ đề → hai (ba)
`TextField` → link "Forgot password?" canh phải → `FormMessage` (nếu có) → `Button`
primary → gạch "or" → `Button` ghost "Continue with Google" → dòng chân trang.
Register thêm `Checkbox` Terms và **khoá nút** tới khi tick. Không chuỗi hiển thị
nào viết thẳng: tất cả lấy từ `messages.mobile.auth` và `messages.authForms`.

- [ ] **Step 6: Đưa con trỏ về ô sai đầu tiên**

Spec §5 đòi: kiểm ở máy thấy lỗi thì con trỏ nhảy về ô sai ĐẦU TIÊN. Thứ tự ô là
thứ tự khai trong màn, nên tách thành một hàm thuần rồi test thẳng, thay vì đi dò
focus trong cây render:

:

\ref.focus()\

Test trước:

\
 chuyển sang  tới  để màn giữ được ref từng ô.
Task 11 và Task 12 dùng lại chính hàm này cho ô mã OTP và hai ô mật khẩu.

- [ ] **Step 7: Nối vào route**

`app/(auth)/login.tsx` giữ state (`values`, `fieldErrors`, `formMessage`, `pending`),
gọi `useAuthActions()`, dùng `submitSignIn`, rồi:
- `success` → `router.replace('/')`
- `verifyEmail` → `router.push({ pathname: '/verify-email', params: { email, reason: 'blocked' } })`
- `fieldErrors` / `formMessage` → đặt state tương ứng

`app/(auth)/register.tsx` cùng khuôn, `verifyEmail` không kèm `reason`.

- [ ] **Step 8: CỔNG METRO — bundle phải xanh**

Đây là lần đầu `@tourism/core` bị kéo vào cây import CỦA APP (qua `placeAuthError`
và `validateLogin`), nên đây mới là chỗ đo được Metro.

Run: `pnpm turbo run bundle --filter=@tourism/mobile`
Expected: PASS, in ra số module cho cả iOS lẫn Android.
Đỏ vì resolve `@tourism/core` → **DỪNG, báo user** (ADR-0042); không tự thêm
`metro.config.js`.

- [ ] **Step 9: Chạy gate rồi commit**

```bash
pnpm gate
git add apps/mobile/src
git commit -m "feat(mobile): màn Sign in và Create account cùng luồng gửi form"
```

### Task 11: Màn Verify email (khung 4a, 4b, 4c)

**Files:**
- Create: `apps/mobile/src/features/auth/use-countdown.ts` (+ spec), `verify-email-flow.ts` (+ spec), `verify-email-screen.tsx` (+ spec)
- Create: `apps/mobile/src/app/(auth)/verify-email.tsx`

**Interfaces:**
- Produces:
  - `useCountdown(seconds: number): { remaining: number; restart: () => void }`
  - `submitOtp(input: { email: string; otp: string }, actions: AuthActions): Promise<OtpOutcome>` với `OtpOutcome = { kind: 'verified' } | { kind: 'fieldErrors'; errors: { otp: string } } | { kind: 'formMessage'; tone: 'error'; text: string }`
  - `resendCode(email: string, actions: AuthActions): Promise<{ kind: 'sent' } | { kind: 'formMessage'; tone: 'error'; text: string }>`
  - `VerifyEmailScreen(props)` — nhận thêm `reason: 'signup' | 'blocked'` để chọn phụ đề

- [ ] **Step 1: Test `useCountdown` bằng đồng hồ giả**

```ts
it('đếm ngược từng giây rồi dừng ở 0', () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useCountdown(3));
  expect(result.current.remaining).toBe(3);
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current.remaining).toBe(0);
  act(() => jest.advanceTimersByTime(5000));
  expect(result.current.remaining).toBe(0);
  jest.useRealTimers();
});

it('restart đưa về mốc đầu', () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useCountdown(60));
  act(() => jest.advanceTimersByTime(10_000));
  act(() => result.current.restart());
  expect(result.current.remaining).toBe(60);
  jest.useRealTimers();
});
```

- [ ] **Step 2: Test `submitOtp` và `resendCode`, rồi viết**

`validateOtp` của `@tourism/core` chặn mã trống hoặc chưa đủ 6 số TRƯỚC khi gọi
action (đúng bài học web: submit trống mà vẫn gọi API thì khách nhận "mã sai" oan).
Mã `000000` → `placeAuthError('invalidOtp', 'verifyEmail')` → kênh 1 dưới ô mã.
`resendCode` thành công → màn hiện `FormMessage` tông thông tin
(`messages.mobile.auth.verifyEmail.resent`) và đếm ngược chạy lại.

- [ ] **Step 3: Test màn theo ba khung**

```tsx
it('4a sau đăng ký: phụ đề thường + câu nhắc trùng email + đếm ngược', async () => {
  await renderWithTheme(<VerifyEmailScreen {...base} reason="signup" remaining={42} />);
  expect(screen.getByText(messages.authForms.verifyEmail.existingAccountHint)).toBeTruthy();
  expect(screen.getByText(/0:42/)).toBeTruthy();
});

it('4b vào từ Sign in: phụ đề nói lý do, KHÔNG có dải riêng', async () => {
  await renderWithTheme(<VerifyEmailScreen {...base} reason="blocked" />);
  expect(screen.getByText(new RegExp(messages.mobile.auth.verifyEmail.blockedBody))).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('4c vừa gửi lại mã: khung thông tin nằm trên nút ghim', async () => {
  await renderWithTheme(
    <VerifyEmailScreen {...base} formMessage={{ tone: 'info', text: messages.mobile.auth.verifyEmail.resent }} />,
  );
  expect(screen.getByText(messages.mobile.auth.verifyEmail.resent)).toBeTruthy();
});

it('mã sai hiện dưới ô mã', async () => {
  await renderWithTheme(<VerifyEmailScreen {...base} fieldErrors={{ otp: messages.authForms.errors.invalidOtp }} />);
  expect(screen.getByText(messages.authForms.errors.invalidOtp)).toBeTruthy();
});
```

- [ ] **Step 4: Viết màn và route**

Màn không có ảnh: nút back `IconButton variant="plain"`, tiêu đề `display`, phụ đề
kèm email in đậm, `OtpInput`, dòng gửi lại (đếm ngược hoặc link), câu nhắc trùng
email chỉ hiện khi `reason === 'signup'`, nút `Verify` ghim đáy cùng `FormMessage`.

Route `(auth)/verify-email.tsx` đọc `email` và `reason` từ `useLocalSearchParams`.
Thiếu `email` → kênh 3: dùng `authForms.verifyEmail.noEmail.*` và nút quay về Sign in.
Xác minh xong → `router.replace({ pathname: '/success', params: { kind: 'verified' } })`.

- [ ] **Step 5: Chạy, xanh, commit**

```bash
pnpm turbo run test --filter=@tourism/mobile
git add apps/mobile/src
git commit -m "feat(mobile): màn xác minh email với mã 6 số và đếm ngược gửi lại"
```
### Task 12: Quên mật khẩu, đặt lại mật khẩu và màn kết quả (khung 5a–5d, 6a, 6b)

**Files:**
- Create: `apps/mobile/src/features/auth/forgot-password-flow.ts` (+ spec), `forgot-password-screen.tsx` (+ spec), `reset-password-flow.ts` (+ spec), `reset-password-screen.tsx` (+ spec)
- Create: `apps/mobile/src/app/(auth)/reset-password.tsx`, `apps/mobile/src/app/(auth)/success.tsx`
- Modify: `apps/mobile/src/app/(auth)/forgot-password.tsx`

**Interfaces:**
- Produces:
  - `submitForgotPassword(email: string, actions: AuthActions): Promise<{ kind: 'sent' } | { kind: 'fieldErrors'; errors: { email: string } } | { kind: 'formMessage'; tone: 'error'; text: string }>`
  - `submitResetPassword(input: { token: string; password: string; confirm: string }, actions: AuthActions): Promise<{ kind: 'done' } | { kind: 'fieldErrors'; errors: ResetPasswordErrors } | { kind: 'formMessage'; tone: 'error'; text: string } | { kind: 'invalidLink' }>`
  - `ForgotPasswordScreen(props)` (có `sent: boolean` để đổi sang khung 5b) · `ResetPasswordScreen(props)`

- [ ] **Step 1: Test hai flow**

```ts
it('email sai định dạng thì chặn ở máy', async () => {
  const requestPasswordReset = jest.fn();
  const outcome = await submitForgotPassword('lan@', { ...ok, requestPasswordReset });
  expect(outcome).toMatchObject({ kind: 'fieldErrors' });
  expect(requestPasswordReset).not.toHaveBeenCalled();
});

it('email lạ vẫn báo đã gửi — API cố ý không nói email nào tồn tại', async () => {
  await expect(submitForgotPassword('khong-ton-tai@example.com', ok)).resolves.toEqual({ kind: 'sent' });
});

it('xác nhận không khớp thì lỗi nằm ở ô confirm', async () => {
  const outcome = await submitResetPassword({ token: 't', password: 'correct-horse', confirm: 'correct-house' }, ok);
  expect(outcome).toMatchObject({ kind: 'fieldErrors', errors: { confirm: messages.formErrors.confirmPassword.mismatch } });
});

it('token hỏng thì cả màn đổi trạng thái', async () => {
  await expect(
    submitResetPassword({ token: 'expired', password: 'correct-horse', confirm: 'correct-horse' }, ok),
  ).resolves.toEqual({ kind: 'invalidLink' });
});
```

- [ ] **Step 2: Viết hai flow**

`submitForgotPassword` dùng `validateForgotPassword`; `submitResetPassword` dùng
`validateResetPassword` rồi `placeAuthError(error, 'resetPassword')` — nhánh
`channel: 'screen'` thành `{ kind: 'invalidLink' }`.

- [ ] **Step 3: Test hai màn theo bốn khung**

```tsx
it('5a: một ô email và nút ghim đáy', async () => {
  await renderWithTheme(<ForgotPasswordScreen {...base} sent={false} />);
  expect(screen.getByPlaceholderText(messages.mobile.auth.signIn.email)).toBeTruthy();
  expect(screen.getByText(messages.authForms.forgotPassword.submit)).toBeTruthy();
});

it('5b: đã gửi thì đổi sang lời nhắn hộp thư, không còn ô nhập', async () => {
  await renderWithTheme(<ForgotPasswordScreen {...base} sent email="lan@example.com" />);
  expect(screen.getByText(messages.authForms.forgotPassword.sentBody)).toBeTruthy();
  expect(screen.queryByPlaceholderText(messages.mobile.auth.signIn.email)).toBeNull();
});

it('5c: lỗi lệch xác nhận nằm dưới ô confirm', async () => {
  await renderWithTheme(
    <ResetPasswordScreen {...base} fieldErrors={{ confirm: messages.formErrors.confirmPassword.mismatch }} />,
  );
  expect(screen.getByText(messages.formErrors.confirmPassword.mismatch)).toBeTruthy();
});

it('5d: link hỏng thì thay cả thân màn và mời xin link mới', async () => {
  await renderWithTheme(<ResetPasswordScreen {...base} invalidLink />);
  expect(screen.getByText(messages.authForms.resetPassword.invalidToken.heading)).toBeTruthy();
  expect(screen.getByText(messages.authForms.resetPassword.invalidToken.backLink)).toBeTruthy();
  expect(screen.queryByPlaceholderText(messages.mobile.auth.resetPassword.newPassword)).toBeNull();
});
```

- [ ] **Step 4: Viết hai màn**

Cả hai đều là màn không ảnh, nút ghim đáy. 5b và 5d dùng chung khối "icon vuông bo
góc + tiêu đề + mô tả" (`big-icon` trong mockup) — tách thành một component nội bộ
`InfoState` trong `features/auth` để hai chỗ không chép nhau.

- [ ] **Step 5: Ba route**

- `(auth)/forgot-password.tsx`: state `sent` đổi khung tại chỗ, không đổi route.
- `(auth)/reset-password.tsx`: đọc `token` từ `useLocalSearchParams`; thiếu token →
  vào thẳng trạng thái `invalidLink` (không gọi action nào); xong → `router.replace({ pathname: '/success', params: { kind: 'password-updated' } })`.
- `(auth)/success.tsx`: đọc `kind`; `verified` dùng `authForms.verifyEmail.toast.*` với
  icon `check`; `password-updated` dùng `authForms.resetPassword.toast.*` với icon `key`;
  nút đưa về `/login` bằng `router.replace`.

- [ ] **Step 6: Chạy, xanh, commit**

```bash
pnpm turbo run test --filter=@tourism/mobile
git add apps/mobile/src
git commit -m "feat(mobile): màn quên mật khẩu, đặt lại mật khẩu và màn kết quả"
```

### Task 13: Splash và onboarding (khung 1a–1d)

**Files:**
- Create: `apps/mobile/src/features/onboarding/onboarding-store.ts` (+ spec), `onboarding-screen.tsx` (+ spec)
- Create: `apps/mobile/src/app/onboarding.tsx`, `apps/mobile/assets/splash-mark.png`
- Modify: `apps/mobile/app.json`, `apps/mobile/src/app/_layout.tsx`
- Create (test): `apps/mobile/src/app-config.spec.ts`

**Interfaces:**
- Produces:
  - `interface OnboardingStore { hasSeen(): Promise<boolean>; markSeen(): Promise<void> }`
  - `createMemoryOnboardingStore(): OnboardingStore` — bản giả lập, nhớ trong RAM nên mỗi lần mở lạnh app lại thấy onboarding một lần (tiện review)
  - `OnboardingScreen(props: { index: number; onNext: () => void; onSkip: () => void; onStart: () => void; onSignIn: () => void })`

- [ ] **Step 1: Ảnh splash và cấu hình app.json**

Xuất logo hai viên kim cương ra PNG 512×512 nền trong suốt, lưu ở
`apps/mobile/assets/splash-mark.png` (dựng một lần bằng `sharp` từ SVG logo của web:
`apps/web/src/components/logo.tsx`). Trong `app.json` thêm:

```json
"splash": {
  "image": "./assets/splash-mark.png",
  "resizeMode": "contain",
  "backgroundColor": "#202a28"
}
```

- [ ] **Step 2: Test canh màu splash khớp token (viết trước)**

`apps/mobile/src/app-config.spec.ts`:

```ts
import { theme } from '@tourism/tokens/theme';
import appConfig from '../app.json';

// app.json là JSON nên không import được token — màu phải gõ tay. Test này là
// thứ giữ cho lời gõ tay đó không trôi khỏi token (cùng tinh thần lưới
// tokens-only, vốn chỉ quét file nguồn).
it('nền splash đúng bằng màu background của chế độ tối', () => {
  expect(appConfig.expo.splash.backgroundColor).toBe(theme.colors.dark.background);
});
```

Run → FAIL nếu chưa thêm khối `splash`; thêm xong → PASS.

- [ ] **Step 3: Test rồi viết `onboarding-store.ts`**

```ts
it('lần đầu chưa xem, đánh dấu xong thì nhớ', async () => {
  const store = createMemoryOnboardingStore();
  await expect(store.hasSeen()).resolves.toBe(false);
  await store.markSeen();
  await expect(store.hasSeen()).resolves.toBe(true);
});
```

Comment đầu file phải nói rõ: người làm hạ tầng thay bản này bằng `expo-secure-store`
hoặc AsyncStorage, giữ nguyên interface.

- [ ] **Step 4: Test rồi viết `OnboardingScreen`**

```tsx
it('trang 1 và 2 có Skip và nút đi tiếp', async () => {
  await renderWithTheme(<OnboardingScreen {...base} index={0} />);
  expect(screen.getByText(messages.mobile.auth.onboarding.skip)).toBeTruthy();
  expect(screen.getByText(messages.mobile.auth.onboarding.slides[0].title)).toBeTruthy();
  expect(screen.getByLabelText(messages.mobile.auth.onboarding.next)).toBeTruthy();
});

it('trang cuối đổi sang hai nút và bỏ Skip', async () => {
  await renderWithTheme(<OnboardingScreen {...base} index={2} />);
  expect(screen.getByText(messages.mobile.auth.onboarding.start)).toBeTruthy();
  expect(screen.getByText(messages.mobile.auth.onboarding.haveAccount)).toBeTruthy();
  expect(screen.queryByText(messages.mobile.auth.onboarding.skip)).toBeNull();
});
```

Bố cục: ảnh dọc phủ toàn màn (`AUTH_PHOTOS.onboarding[index]`), `LinearGradient` phủ
từ trong suốt xuống `colors.scrim`, nội dung ghim đáy: nhãn địa danh, tiêu đề
`display`, mô tả, ba chấm (chấm đang chọn dài ra, màu `primary-emphasis`).

- [ ] **Step 5: Route `onboarding.tsx` và đường vào**

Route giữ `index`, `onNext` tăng index, `onSkip`/`onStart` gọi `markSeen()` rồi
`router.replace('/')`, `onSignIn` gọi `markSeen()` rồi `router.replace('/login')`.

Trong `_layout.tsx`: đọc `hasSeen()` một lần lúc mở app; chưa xem thì
`router.replace('/onboarding')`. Splash chỉ gỡ khi **cả** font xong **và** đã đọc
xong cờ — tránh một nháy Home rồi mới nhảy sang onboarding.

- [ ] **Step 6: Chạy, xanh, commit**

```bash
pnpm turbo run test --filter=@tourism/mobile
git add apps/mobile
git commit -m "feat(mobile): splash theo token và ba trang onboarding lần đầu mở app"
```

### Task 14: Gallery cho máy dev, kiểm kê route, runbook, tài liệu bàn giao

**Files:**
- Create: `apps/mobile/src/features/dev/gallery-entries.ts`, `apps/mobile/src/app/dev/gallery.tsx` (+ spec)
- Create: `apps/mobile/src/lib/dev-only.ts`
- Modify: `apps/mobile/src/routes.spec.tsx`
- Create: `docs/conventions/mobile-auth-handoff.md`
- Modify: `docs/conventions/mobile-dev-loop.md`, `docs/README.md`, `docs/CHANGELOG.md`

- [ ] **Step 1: Cập nhật kiểm kê route (test trước, đỏ trước)**

Thêm vào `EXPECTED_ROUTES` của `routes.spec.tsx`, giữ thứ tự alphabet:

```ts
'(auth)/reset-password',
'(auth)/success',
'(auth)/verify-email',
'dev/gallery',
'onboarding',
```

Run: `pnpm turbo run test --filter=@tourism/mobile` → đỏ cho tới khi `dev/gallery.tsx`
tồn tại (bốn route kia đã có từ Task 11–13).

- [ ] **Step 2: Cổng `__DEV__` cho gallery**

`apps/mobile/src/lib/dev-only.ts`:

```ts
/** Tách ra thành hàm để test mock được — `__DEV__` là hằng do Metro nội tuyến. */
export function isDevBuild(): boolean {
  return __DEV__;
}
```

Test của gallery:

```tsx
jest.mock('@/lib/dev-only', () => ({ isDevBuild: jest.fn() }));

it('bản phát hành không có đường vào gallery', async () => {
  (isDevBuild as jest.Mock).mockReturnValue(false);
  const app = renderRouter('src/app', { initialUrl: '/dev/gallery' });
  await app;
  expect(app.getPathname()).toBe('/');
});

it('ở chế độ dev thì liệt kê đủ khung của cụm auth', async () => {
  (isDevBuild as jest.Mock).mockReturnValue(true);
  await renderWithTheme(<GalleryScreen />);
  expect(screen.getAllByTestId('gallery-entry').length).toBe(GALLERY_ENTRIES.length);
});
```

`gallery-entries.ts` khai một mảng `{ id: string; title: string; render: () => ReactNode }`
đủ 17 khung của spec §4, mỗi khung dựng màn với props cứng (không đi qua action).

- [ ] **Step 3: Sửa runbook**

Trong `docs/conventions/mobile-dev-loop.md` §1, đổi dòng build:

```bash
pnpm turbo run build --filter=@tourism/mobile^...
```

kèm một câu nói vì sao: Metro cần `dist` của `tokens`, `i18n` và `core`; bản cũ chỉ
build `tokens` nên máy sạch sẽ chết ở `@tourism/i18n`. Thêm một mục ở §5 nói về
`/dev/gallery`: mở bằng `nexora://dev/gallery` hoặc gõ đường dẫn trong Expo Go.

- [ ] **Step 4: Viết `docs/conventions/mobile-auth-handoff.md`**

Bắt buộc có đủ các mục sau (spec §6):

| Method | Lệnh Better Auth tương ứng |
| --- | --- |
| `signInWithEmail` | `authClient.signIn.email({ email, password })`; nếu `error.code === 'EMAIL_NOT_VERIFIED'` thì gọi `authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })` rồi trả `{ ok: false, error: 'emailNotVerified' }` |
| `signInWithGoogle` | `authClient.signIn.social({ provider: 'google', callbackURL })` |
| `signUpWithEmail` | `authClient.signUp.email({ name, email, password })` |
| `verifyEmail` | `authClient.emailOtp.verifyEmail({ email, otp })` |
| `resendVerificationCode` | `authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })` |
| `requestPasswordReset` | `authClient.requestPasswordReset({ email, redirectTo: 'nexora://reset-password' })` |
| `resetPassword` | `authClient.resetPassword({ newPassword, token })` |

Cộng thêm: mọi lỗi đi qua `mapAuthError` của `@tourism/core`, fetch ném thì trả
`generic`; việc phía API theo ADR-0017 §9 (bật plugin `expo()`, thêm trusted origin
`nexora://`, rà trần request và CORS); chỗ đổi provider (`_layout.tsx`); chỗ thay
`createMemoryOnboardingStore`; ảnh trong `auth-media.ts` đang là URL cố định, nối
thật thì lấy từ khe site-media; và danh sách **không được sửa**: màn, luật kiểm ô
nhập, copy.

- [ ] **Step 5: Docs sweep**

- `docs/README.md`: thêm dòng cho `conventions/mobile-auth-handoff.md`; cập nhật
  hàng roadmap P5 và hàng spec P5b-1 sang trạng thái "thi công xong, chờ review".
- `docs/CHANGELOG.md`: một entry mới ghi rõ **"CHƯA merge, chờ review"**, kèm kết quả
  cổng (jest-expo ở Task 3, Metro ở Task 10), số test thêm, và mục **CÒN TREO** đúng
  như spec §10. Nhớ luật dấu `+` đầu dòng (CLAUDE.md gotcha CHANGELOG).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src docs/conventions docs/README.md docs/CHANGELOG.md
git commit -m "feat(mobile): gallery xem màn khi dev, runbook và tài liệu bàn giao auth"
```

### Nghiệm thu nhánh 2 (trước khi báo user)

- [ ] **Step 1:** `pnpm gate:int` xanh trọn bộ.
- [ ] **Step 2:** `pnpm turbo run bundle --filter=@tourism/mobile` xanh (iOS và Android).
- [ ] **Step 3:** `cd apps/mobile && pnpm exec expo-doctor` không có mục đỏ.
- [ ] **Step 4:** `grep -rn --exclude-dir=.expo "eslint\|prettier" apps/mobile libs/mobile` rỗng.
- [ ] **Step 5:** `node scripts/check-mobile-tokens-only.mjs` xanh.
- [ ] **Step 6:** `git diff --cached --name-only | grep docs/screenshot` rỗng.
- [ ] **Step 7:** Đẩy nhánh lên cho CI soi: `git push -u origin feat/p5b-auth-screens` rồi `gh run list --branch feat/p5b-auth-screens --limit 1`.
- [ ] **Step 8:** Báo user nghiệm thu bằng máy thật: quét QR Expo Go, mở `/dev/gallery`, xem 17 khung ở cả nền tối lẫn nền sáng. **Không tự merge.**

---

## Ghi chú cho người thi công

- Mỗi task là một commit. Chạy `pnpm gate` trong vòng lặp; `gate:int` chỉ ở bước
  nghiệm thu mỗi nhánh.
- Gặp chỗ spec chưa nói rõ thì **hỏi user**, đừng tự quyết — nhất là ba chỗ có CỔNG
  (jest-expo ở Task 3, Metro ở Task 10, `expo-doctor` ở Task 4).
- Không đụng `docs/specs/2026-09-15-refund-deadline-design.md`, `docs/plans/2026-09-15-refund-deadline*`
  và `docs/screenshot/` — của session khác và của user.
