# Media Write Surface (ADR-0021) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở bề mặt GHI media đầu tiên theo ADR-0021 (Accepted): ký Cloudinary
direct upload cho khách (`media.signUpload`), lưu avatar (`account.setAvatar`
→ `User.image`), đính ảnh vào review (`reviews.create.photos` → `MediaAsset`
ownerType `REVIEW`), hiển thị avatar (navbar/hộ chiếu/Settings) và ảnh review
(trang tour) — thay các mảnh static-first đã chốt UI.

**Architecture:** Signed direct upload (browser POST bytes thẳng Cloudinary,
API chỉ ký — `api_secret` không rời server; folder + publicId do server
quyết). Contract-first oRPC: mọi bề mặt mới khai trong `@tourism/contract`
trước. Ảnh review tái dùng `MediaAsset` polymorphic (+ giá trị enum `REVIEW`),
đọc theo khuôn batch `resolveForOwners` của ADR-0005.

**Tech Stack:** NestJS 11 + oRPC (`@Implement`) + Prisma 7 + `cloudinary` SDK
(mới thêm, chỉ dùng `utils.api_sign_request`) · Next 16 + XHR upload có
progress · Vitest (unit + int với Postgres).

## Global Constraints

- **PATH trước MỌI lệnh node/pnpm:** `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (shell mặc định dính pnpm Windows qua /mnt/c).
- Comment code (kể cả JSDoc) **tiếng Việt**; identifier tiếng Anh; copy user-facing **English-only qua `@tourism/i18n`**.
- Commit: Conventional Commits, message **tiếng Việt CÓ DẤU**, **KHÔNG trailer AI** — sau mỗi commit chạy `git log -1 --format='%(trailers)'` phải rỗng, dính thì `git commit --amend`.
- **KHÔNG commit `apps/web/AGENTS.md`** (file WIP của user) — `git add` đường dẫn tường minh, cấm `-A`/`.`.
- **KHÔNG sửa file `migration.sql` đã apply** — enum mới = migration MỚI.
- Biome là formatter/linter duy nhất; token màu từ `@tourism/tokens`, không hex.
- Test đặt cạnh code (`*.spec.ts` unit, `*.int.spec.ts` integration); tên test tiếng Việt.
- Sau khi sửa `libs/shared/contract`: `pnpm turbo run build --filter=@tourism/contract`; sau khi sửa `libs/shared/i18n`: `pnpm turbo run build --filter=@tourism/i18n` (trước khi chạy test web).
- `pnpm gate` (root) cho vòng lặp nhanh; **`pnpm gate:int` bắt buộc trước khi khai xong cụm** (cần `docker start tourism-v2-postgres-1`).

---

### Task 1: Contract — hằng chia sẻ + `media.signUpload` + `account.setAvatar` + mở rộng reviews

**Files:**
- Modify: `libs/shared/contract/src/schemas/media.ts` (thêm cuối file)
- Modify: `libs/shared/contract/src/schemas/reviews.ts`
- Modify: `libs/shared/contract/src/contract.ts`
- Test: `libs/shared/contract/src/schemas/media.spec.ts`, `libs/shared/contract/src/contract.spec.ts`

**Interfaces (Produces):**
- `ALLOWED_IMAGE_EXTENSIONS: readonly ['jpg','jpeg','png','webp','avif','gif']`, `AVATAR_MAX_BYTES = 2*1024*1024`, `REVIEW_PHOTO_MAX_BYTES = 10*1024*1024`, `REVIEW_PHOTOS_MAX = 5`
- `SignUploadInputSchema` (discriminated union theo `purpose`), `SignedUploadParamsSchema`, type `SignedUploadParams`
- `contract.media.signUpload` (POST `/api/media/upload-signatures`), `contract.account.setAvatar` (PATCH `/api/account/avatar`)
- `CreateReviewInputSchema.photos?: string[]` (≤5), `PublicReviewSchema.media: MediaItem[]`, error `REVIEW_PHOTO_INVALID`

- [ ] **Step 1: Viết test schema mới (fail trước)** — thêm vào `libs/shared/contract/src/schemas/media.spec.ts`:

```ts
describe('SignUploadInputSchema', () => {
  it('AVATAR: chỉ cần purpose + ext hợp lệ', () => {
    expect(SignUploadInputSchema.parse({ purpose: 'AVATAR', ext: 'png' })).toEqual({
      purpose: 'AVATAR',
      ext: 'png',
    });
  });

  it('REVIEW_PHOTO: bắt buộc bookingCode đúng khuôn BK-XXXXXXXX', () => {
    expect(() =>
      SignUploadInputSchema.parse({ purpose: 'REVIEW_PHOTO', ext: 'jpg' }),
    ).toThrow();
    expect(
      SignUploadInputSchema.parse({
        purpose: 'REVIEW_PHOTO',
        ext: 'jpg',
        bookingCode: 'BK-ABCD1234',
      }).bookingCode,
    ).toBe('BK-ABCD1234');
  });

  it('đuôi file ngoài whitelist ảnh → loại ngay tầng schema', () => {
    expect(() => SignUploadInputSchema.parse({ purpose: 'AVATAR', ext: 'exe' })).toThrow();
    expect(() => SignUploadInputSchema.parse({ purpose: 'AVATAR', ext: 'mp4' })).toThrow();
  });
});
```

Import bổ sung ở đầu spec: `SignUploadInputSchema` từ `'./media.js'`.

- [ ] **Step 2: Chạy để thấy fail** — `cd libs/shared/contract && pnpm vitest run src/schemas/media.spec.ts` → FAIL (`SignUploadInputSchema` chưa export).

- [ ] **Step 3: Thêm schema + hằng vào `schemas/media.ts`** (cuối file, sau `MediaItemSchema`):

```ts
/**
 * ── Bề mặt GHI media (ADR-0021) ──
 * Đuôi ảnh được phép ký upload — để dạng enum trong contract nên request
 * sai đuôi chết ngay tầng validate, server không cần luật riêng.
 */
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'] as const;

/**
 * Trần dung lượng/số lượng dùng CHUNG client + server (ADR-0021 §2). Bytes
 * đi thẳng Cloudinary nên API không cân được file — enforce thật nằm ở
 * client; hằng sống ở contract để hai bên đọc MỘT nguồn, đổi số đổi một chỗ.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const REVIEW_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const REVIEW_PHOTOS_MAX = 5;

/** Input ký upload — REVIEW_PHOTO phải khai booking để server soi quyền. */
export const SignUploadInputSchema = z.discriminatedUnion('purpose', [
  z.object({
    purpose: z.literal('AVATAR'),
    ext: z.enum(ALLOWED_IMAGE_EXTENSIONS),
  }),
  z.object({
    purpose: z.literal('REVIEW_PHOTO'),
    ext: z.enum(ALLOWED_IMAGE_EXTENSIONS),
    bookingCode: BookingCodeSchema,
  }),
]);

/**
 * Bộ tham số browser cần để POST file thẳng lên Cloudinary. Chữ ký phủ
 * `{folder, public_id, timestamp}` — form phải gửi đúng các giá trị này,
 * đổi một ký tự là Cloudinary từ chối. KHÔNG BAO GIỜ chứa api_secret.
 */
export const SignedUploadParamsSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.int().positive(),
  apiKey: z.string().min(1),
  cloudName: z.string().min(1),
  folder: z.string().min(1),
  /** BASENAME server sinh (không kèm folder) — form gửi nguyên ở field `public_id`. */
  publicId: z.string().min(1),
  uploadUrl: z.url(),
});

export type SignUploadInput = z.infer<typeof SignUploadInputSchema>;
export type SignedUploadParams = z.output<typeof SignedUploadParamsSchema>;
```

Import đầu file thêm: `import { BookingCodeSchema } from './bookings.js';`

- [ ] **Step 4: Mở rộng `schemas/reviews.ts`**:

```ts
// import đầu file:
import { MediaItemSchema, REVIEW_PHOTOS_MAX } from './media.js';
```

`PublicReviewSchema` thêm field (sau `createdAt`):

```ts
  /** Ảnh chuyến đi khách đính kèm (ADR-0021) — URL đã dựng, rỗng nếu không có. */
  media: z.array(MediaItemSchema),
```

`CreateReviewInputSchema` thêm field (sau `body`):

```ts
  /**
   * publicId Cloudinary đã upload xong qua media.signUpload (ADR-0021 §4) —
   * thứ tự mảng = thứ tự hiển thị (ảnh đầu là đại diện). Server kiểm mỗi
   * publicId thuộc đúng folder reviews/<bookingCode>.
   */
  photos: z.array(z.string().min(1)).max(REVIEW_PHOTOS_MAX).optional(),
```

- [ ] **Step 5: Thêm 2 namespace vào `contract.ts`** — import bổ sung `SignedUploadParamsSchema, SignUploadInputSchema` từ `'./schemas/media.js'`. Chèn hai khối mới (đặt `media` sau `siteMedia`, `account` ngay sau `media`, trước `admin`):

```ts
  media: {
    signUpload: oc
      .route({
        method: 'POST',
        path: '/api/media/upload-signatures',
        summary: 'Sign a direct-to-Cloudinary upload (ADR-0021)',
      })
      .input(SignUploadInputSchema)
      .output(SignedUploadParamsSchema)
      .errors({
        // 503 chứ không 500: thiếu cặp CLOUDINARY_API_KEY/SECRET là trạng
        // thái cấu hình hợp lệ (CI, môi trường chỉ-đọc) — API vẫn boot.
        MEDIA_UPLOAD_NOT_CONFIGURED: { status: 503, message: 'Uploads are not configured' },
        BOOKING_NOT_FOUND: { status: 404, message: 'Booking not found' },
        BOOKING_FORBIDDEN: { status: 403, message: 'Not your booking' },
        REVIEW_NOT_ELIGIBLE: { status: 400, message: 'Booking is not eligible for review' },
        REVIEW_TRIP_NOT_COMPLETED: { status: 400, message: 'Trip has not finished yet' },
      }),
  },

  // Namespace account: procedure oRPC ĐẦU TIÊN ở đây — me/delete vẫn là REST
  // thuần trong AccountController (gắn Better Auth session, không đáng port).
  account: {
    setAvatar: oc
      .route({
        method: 'PATCH',
        path: '/api/account/avatar',
        summary: 'Set or clear own avatar (ADR-0021)',
      })
      .input(
        z.object({
          /** publicId Cloudinary đã upload; null = gỡ avatar về chữ-cái-đầu. */
          publicId: z.string().min(1).nullable(),
        }),
      )
      .output(z.object({ image: z.url().nullable() }))
      .errors({
        AVATAR_PUBLIC_ID_INVALID: {
          status: 400,
          message: 'publicId is not one of your uploaded avatars',
        },
      }),
  },
```

`reviews.create.errors` thêm một dòng (sau `REVIEW_ALREADY_EXISTS`):

```ts
        REVIEW_PHOTO_INVALID: { status: 400, message: 'A photo does not belong to this booking' },
```

- [ ] **Step 6: Pin route mới vào `contract.spec.ts`** — thêm vào bảng `it.each` hai dòng theo đúng format sẵn có (`'POST /api/media/upload-signatures'` ứng `contract.media.signUpload`, `'PATCH /api/account/avatar'` ứng `contract.account.setAvatar`), và nếu spec có kiểm errorMap thì thêm case `REVIEW_PHOTO_INVALID` cho `reviews.create`. Đọc format thật của bảng trong file trước khi thêm.

- [ ] **Step 7: Chạy test contract** — `cd libs/shared/contract && pnpm vitest run` → PASS toàn bộ. Rồi build: `pnpm turbo run build --filter=@tourism/contract` (chạy từ root) → xanh.

- [ ] **Step 8: Typecheck toàn repo để lộ chỗ vỡ do `PublicReviewSchema.media`** — `pnpm typecheck` từ root. **Kỳ vọng ĐỎ** ở `apps/api` (`toPublicReview` thiếu `media`) và `apps/web` (mocks/fixtures pin 7 field) — đó là việc của Task 5–7, KHÔNG sửa ở đây. Ghi lại danh sách file đỏ vào báo cáo task.

- [ ] **Step 9: Commit**

```bash
git add libs/shared/contract/src/schemas/media.ts libs/shared/contract/src/schemas/media.spec.ts libs/shared/contract/src/schemas/reviews.ts libs/shared/contract/src/contract.ts libs/shared/contract/src/contract.spec.ts
git commit -m "feat(contract): bề mặt ghi media — media.signUpload, account.setAvatar, reviews nhận photos (ADR-0021)"
git log -1 --format='%(trailers)'   # phải rỗng
```

---

### Task 2: Prisma — thêm `REVIEW` vào enum `MediaOwnerType`

**Files:**
- Modify: `apps/api/prisma/schema.prisma:74-80` (enum `MediaOwnerType`)
- Create: `apps/api/prisma/migrations/<timestamp>_media_owner_type_review/migration.sql` (prisma sinh)

**Interfaces (Produces):** `MediaOwnerType.REVIEW` dùng được từ `@prisma/client` generated enums.

- [ ] **Step 1: Sửa schema** — trong enum `MediaOwnerType` thêm `REVIEW` (đặt cuối danh sách, sau `SITE` — thứ tự khai báo là thứ tự sort Postgres, thêm cuối để không xáo trộn giá trị cũ):

```prisma
enum MediaOwnerType {
  TOUR
  DESTINATION
  USER
  POST
  SITE
  REVIEW
}
```

- [ ] **Step 2: Đảm bảo Postgres chạy** — `docker start tourism-v2-postgres-1` (bỏ qua nếu đã chạy).

- [ ] **Step 3: Sinh migration** —

```bash
cd apps/api && pnpm prisma migrate dev --name media_owner_type_review
```

Kỳ vọng: một migration mới chứa đúng `ALTER TYPE "MediaOwnerType" ADD VALUE 'REVIEW';`. **Không đụng bất kỳ migration cũ nào.**

- [ ] **Step 4: Kiểm generated client** — `pnpm --filter @tourism/api typecheck` → xanh (client tái sinh trong bước migrate).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): thêm REVIEW vào enum MediaOwnerType — chỗ đứng cho ảnh review (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 3: API — dependency `cloudinary` + lib ký thuần `upload-signing.ts` (TDD)

**Files:**
- Modify: `apps/api/package.json` (dep mới), `apps/api/.env.example:85-88` (bỏ comment)
- Create: `apps/api/src/lib/upload-signing.ts`
- Test: `apps/api/src/lib/upload-signing.spec.ts`

**Interfaces (Produces):**
```ts
export interface UploadSigningConfig { cloudName: string; apiKey: string; apiSecret: string; rootFolder: string; }
export function resolveUploadConfig(env: { CLOUDINARY_CLOUD_NAME: string; CLOUDINARY_API_KEY?: string; CLOUDINARY_API_SECRET?: string; CLOUDINARY_UPLOAD_FOLDER: string }): UploadSigningConfig | null;
export function uploadFolderFor(rootFolder: string, req: { purpose: 'AVATAR'; userId: string } | { purpose: 'REVIEW_PHOTO'; bookingCode: string }): string;
export function buildSignedUploadParams(cfg: UploadSigningConfig, folder: string, publicId: string, timestamp: number): SignedUploadParams;
export function isOwnAvatarPublicId(rootFolder: string, userId: string, publicId: string): boolean;
```
(`SignedUploadParams` import từ `@tourism/contract`.)

- [ ] **Step 1: Cài dep** —

```bash
pnpm --filter @tourism/api add cloudinary
```

- [ ] **Step 2: Viết test thuần (fail trước)** — `apps/api/src/lib/upload-signing.spec.ts`:

```ts
import { v2 as cloudinary } from 'cloudinary';
import {
  buildSignedUploadParams,
  isOwnAvatarPublicId,
  resolveUploadConfig,
  uploadFolderFor,
} from './upload-signing.js';

const CFG = {
  cloudName: 'demo-cloud',
  apiKey: 'key-123',
  apiSecret: 'secret-abc',
  rootFolder: 'tourism',
};

describe('resolveUploadConfig', () => {
  it('đủ cặp key/secret → config; thiếu một trong hai → null (API vẫn boot, ADR-0021 §6)', () => {
    const base = {
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_UPLOAD_FOLDER: 'tourism',
    };
    expect(
      resolveUploadConfig({ ...base, CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }),
    ).toEqual({ cloudName: 'demo-cloud', apiKey: 'k', apiSecret: 's', rootFolder: 'tourism' });
    expect(resolveUploadConfig(base)).toBeNull();
    expect(resolveUploadConfig({ ...base, CLOUDINARY_API_KEY: 'k' })).toBeNull();
  });
});

describe('uploadFolderFor', () => {
  it('AVATAR → <root>/avatars/<userId>; REVIEW_PHOTO → <root>/reviews/<bookingCode>', () => {
    expect(uploadFolderFor('tourism', { purpose: 'AVATAR', userId: 'u-1' })).toBe(
      'tourism/avatars/u-1',
    );
    expect(
      uploadFolderFor('tourism', { purpose: 'REVIEW_PHOTO', bookingCode: 'BK-ABCD1234' }),
    ).toBe('tourism/reviews/BK-ABCD1234');
  });
});

describe('buildSignedUploadParams', () => {
  it('chữ ký khớp api_sign_request của SDK với cùng bộ {folder, public_id, timestamp}', () => {
    const params = buildSignedUploadParams(CFG, 'tourism/avatars/u-1', 'pid-1', 1_760_000_000);
    expect(params.signature).toBe(
      cloudinary.utils.api_sign_request(
        { folder: 'tourism/avatars/u-1', public_id: 'pid-1', timestamp: 1_760_000_000 },
        CFG.apiSecret,
      ),
    );
    expect(params).toMatchObject({
      timestamp: 1_760_000_000,
      apiKey: 'key-123',
      cloudName: 'demo-cloud',
      folder: 'tourism/avatars/u-1',
      publicId: 'pid-1',
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
    });
  });
});

describe('isOwnAvatarPublicId', () => {
  it('đúng folder avatar của chính user → true; user khác / folder khác / prefix giả → false', () => {
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/avatars/u-1/pid')).toBe(true);
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/avatars/u-2/pid')).toBe(false);
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/reviews/BK-X/pid')).toBe(false);
    // Prefix giả kiểu "u-1-evil" không được lọt — phải so theo SEGMENT.
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/avatars/u-1-evil/pid')).toBe(false);
  });
});
```

- [ ] **Step 3: Chạy để thấy fail** — `pnpm --filter @tourism/api exec vitest run src/lib/upload-signing.spec.ts` → FAIL (module chưa tồn tại).

- [ ] **Step 4: Viết `apps/api/src/lib/upload-signing.ts`**:

```ts
import { v2 as cloudinary } from 'cloudinary';
import type { SignedUploadParams } from '@tourism/contract';

/**
 * Lõi THUẦN của bề mặt ghi media (ADR-0021) — mọi thứ tính được không cần
 * DB/env sống ở đây để TDD với secret giả. Service chỉ còn orchestration
 * (soi quyền booking + sinh publicId/timestamp).
 */

export interface UploadSigningConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  rootFolder: string;
}

/**
 * Cặp key/secret là optional theo env schema (môi trường chỉ-đọc như CI
 * không mang secret vẫn boot) — thiếu một nửa cặp coi như CHƯA cấu hình,
 * trả null để service ném MEDIA_UPLOAD_NOT_CONFIGURED.
 */
export function resolveUploadConfig(env: {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_UPLOAD_FOLDER: string;
}): UploadSigningConfig | null {
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return null;
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
  };
}

/** Folder do SERVER quyết theo purpose (ADR-0021 §1) — client không được chọn chỗ đặt file. */
export function uploadFolderFor(
  rootFolder: string,
  req: { purpose: 'AVATAR'; userId: string } | { purpose: 'REVIEW_PHOTO'; bookingCode: string },
): string {
  return req.purpose === 'AVATAR'
    ? `${rootFolder}/avatars/${req.userId}`
    : `${rootFolder}/reviews/${req.bookingCode}`;
}

/**
 * Ký bộ `{folder, public_id, timestamp}` bằng api_sign_request của SDK —
 * đúng thuật toán Cloudinary xác thực phía họ; api_secret chỉ đi vào hàm
 * này, không bao giờ nằm trong giá trị trả về. Cụm này chỉ ký ẢNH nên
 * uploadUrl cố định resource `image` (video là chuyện P4).
 */
export function buildSignedUploadParams(
  cfg: UploadSigningConfig,
  folder: string,
  publicId: string,
  timestamp: number,
): SignedUploadParams {
  const signature = cloudinary.utils.api_sign_request(
    { folder, public_id: publicId, timestamp },
    cfg.apiSecret,
  );
  return {
    signature,
    timestamp,
    apiKey: cfg.apiKey,
    cloudName: cfg.cloudName,
    folder,
    publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
  };
}

/**
 * publicId Cloudinary trả về có dạng `<folder>/<basename>` — avatar hợp lệ
 * của CHÍNH user phải nằm trọn trong segment `<root>/avatars/<userId>/`.
 * So theo segment (kèm dấu `/` chốt đuôi) để 'u-1-evil' không giả được 'u-1'.
 */
export function isOwnAvatarPublicId(
  rootFolder: string,
  userId: string,
  publicId: string,
): boolean {
  return publicId.startsWith(`${rootFolder}/avatars/${userId}/`);
}
```

- [ ] **Step 5: Chạy test** — `pnpm --filter @tourism/api exec vitest run src/lib/upload-signing.spec.ts` → PASS (4 test).

- [ ] **Step 6: Bỏ comment env mẫu** — trong `apps/api/.env.example`, bỏ dấu `#` ba dòng `CLOUDINARY_API_KEY=` / `CLOUDINARY_API_SECRET=` / `CLOUDINARY_UPLOAD_FOLDER=tourism` (giữ nguyên comment giải thích phía trên, cập nhật chữ "P4" nếu comment cũ nói tầng upload là P4 — giờ là ADR-0021).

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/lib/upload-signing.ts apps/api/src/lib/upload-signing.spec.ts apps/api/.env.example
git commit -m "feat(api): lõi ký Cloudinary thuần + dependency cloudinary (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 4: API — `UploadSigningService` + `MediaController` (signUpload) + int test

**Files:**
- Create: `apps/api/src/modules/media/upload-signing.service.ts`, `apps/api/src/modules/media/media.controller.ts`
- Modify: `apps/api/src/modules/media/media.module.ts`, `apps/api/src/app.module.ts` (imports thêm `MediaModule`), `apps/api/vitest.int.config.ts` (env thêm cặp Cloudinary giả)
- Test: `apps/api/src/modules/media/upload-signing.int.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`contract.media.signUpload`, `SignUploadInput`), Task 3 (`resolveUploadConfig`, `uploadFolderFor`, `buildSignedUploadParams`), `checkReviewEligibility` từ `apps/api/src/modules/reviews/review-eligibility.ts`, các error class `BookingNotFoundError/BookingForbiddenError/ReviewNotEligibleError/ReviewTripNotCompletedError` export từ `apps/api/src/modules/reviews/reviews.service.ts`.
- Produces: `UploadSigningService.signUpload(callerId: string, input: SignUploadInput): Promise<SignedUploadParams>`; throw `UploadsNotConfiguredError` khi thiếu cặp secret.

- [ ] **Step 1: Thêm env giả cho int test** — trong `apps/api/vitest.int.config.ts`, khối `env` thêm:

```ts
      CLOUDINARY_API_KEY: 'int-test-key',
      CLOUDINARY_API_SECRET: 'int-test-secret',
```

- [ ] **Step 2: Viết int test (fail trước)** — `apps/api/src/modules/media/upload-signing.int.spec.ts`, bootstrap `Test.createTestingModule({ imports: [AppModule] })` + Fastify adapter y khuôn `reviews.int.spec.ts:28-48` (kèm truncate `beforeEach` rút gọn: `TRUNCATE reviews, bookings, tour_departures, tours, tour_categories, destinations, users, sessions, accounts RESTART IDENTITY CASCADE`). Dùng lại helper kiểu `signUpAndSignIn`/`seedCompletedBooking` — CHÉP hàm helper từ reviews.int.spec.ts (helper ở đó là hàm file-local, không export; chép kèm comment nguồn). Case:

```ts
describe('media.signUpload', () => {
  it('chưa đăng nhập → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/media/upload-signatures',
      payload: { purpose: 'AVATAR', ext: 'png' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('AVATAR: trả đủ bộ tham số, folder khoá theo userId, chữ ký verify được bằng SDK', async () => {
    const { cookie, userId } = await signUpAndSignIn();
    const res = await app.inject({
      method: 'POST',
      url: '/api/media/upload-signatures',
      headers: { cookie },
      payload: { purpose: 'AVATAR', ext: 'png' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.folder).toBe(`tourism/avatars/${userId}`);
    expect(body.cloudName).toBeTruthy();
    expect(body.uploadUrl).toContain('/image/upload');
    expect(body.signature).toBe(
      cloudinary.utils.api_sign_request(
        { folder: body.folder, public_id: body.publicId, timestamp: body.timestamp },
        'int-test-secret',
      ),
    );
  });

  it('REVIEW_PHOTO: booking đủ điều kiện → folder reviews/<code>', async () => { /* seedCompletedBooking rồi assert folder */ });
  it('REVIEW_PHOTO: booking của người khác → 403 BOOKING_FORBIDDEN', async () => { /* user B ký cho booking user A */ });
  it('REVIEW_PHOTO: booking chưa PAID → 400 REVIEW_NOT_ELIGIBLE', async () => { /* seed booking PENDING */ });
  it('REVIEW_PHOTO: chuyến chưa kết thúc → 400 REVIEW_TRIP_NOT_COMPLETED', async () => { /* departureEndDate tương lai */ });
  it('REVIEW_PHOTO: mã không tồn tại → 404 BOOKING_NOT_FOUND', async () => { /* BK-KHONGCO1 */ });
  it('đuôi file lạ → 400 từ tầng validate contract', async () => { /* ext: 'exe' → statusCode 400 */ });
});
```

(Các case comment `/* */` ở trên phải viết THẬT đủ — seed theo khuôn `seedCompletedBooking` của reviews.int.spec.ts, chỉnh `status`/`departureEndDate` theo case. Lưu ý helper `signUpAndSignIn` của reviews trả cookie; cần thêm bước lấy `userId` — query `prisma.user.findUniqueOrThrow({ where: { email } })` sau khi sign-up.)

- [ ] **Step 3: Chạy để thấy fail** — `pnpm --filter @tourism/api test:int -- src/modules/media/upload-signing.int.spec.ts` → FAIL 404 (route chưa có).

- [ ] **Step 4: Viết service** — `apps/api/src/modules/media/upload-signing.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SignedUploadParams, SignUploadInput } from '@tourism/contract';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import {
  buildSignedUploadParams,
  resolveUploadConfig,
  uploadFolderFor,
} from '../../lib/upload-signing.js';
import { checkReviewEligibility } from '../reviews/review-eligibility.js';
import {
  BookingForbiddenError,
  BookingNotFoundError,
  ReviewNotEligibleError,
  ReviewTripNotCompletedError,
} from '../reviews/reviews.service.js';

/** Thiếu cặp CLOUDINARY_API_KEY/SECRET — trạng thái hợp lệ (ADR-0021 §6). */
export class UploadsNotConfiguredError extends Error {}

/**
 * Ký upload trực-tiếp-lên-Cloudinary cho KHÁCH (ADR-0021). Server quyết
 * WHO (AVATAR: chính chủ; REVIEW_PHOTO: cùng luật eligibility với
 * reviews.create) và WHERE (folder theo purpose) — client chỉ cầm chữ ký.
 */
@Injectable()
export class UploadSigningService {
  async signUpload(callerId: string, input: SignUploadInput): Promise<SignedUploadParams> {
    const cfg = resolveUploadConfig(env);
    if (!cfg) throw new UploadsNotConfiguredError();

    if (input.purpose === 'REVIEW_PHOTO') {
      // Soi CÙNG luật với reviews.create — ký được nghĩa là review được;
      // lệch luật là khách upload xong mới bị từ chối ở bước gửi review.
      const booking = await prisma.booking.findUnique({
        where: { code: input.bookingCode },
        select: { userId: true, status: true, departureEndDate: true },
      });
      if (!booking) throw new BookingNotFoundError();
      const eligibility = checkReviewEligibility({
        bookingStatus: booking.status,
        departureEndDate: booking.departureEndDate,
        now: new Date(),
        ownerId: booking.userId,
        callerId,
      });
      if (!eligibility.ok) {
        if (eligibility.reason === 'NOT_OWNER') throw new BookingForbiddenError();
        if (eligibility.reason === 'TRIP_NOT_COMPLETED') throw new ReviewTripNotCompletedError();
        throw new ReviewNotEligibleError();
      }
    }

    const folder = uploadFolderFor(
      cfg.rootFolder,
      input.purpose === 'AVATAR'
        ? { purpose: 'AVATAR', userId: callerId }
        : { purpose: 'REVIEW_PHOTO', bookingCode: input.bookingCode },
    );
    // publicId server sinh (ADR-0021 §1) — client không được đặt tên file.
    return buildSignedUploadParams(cfg, folder, randomUUID(), Math.floor(Date.now() / 1000));
  }
}
```

(Nếu các error class chưa được `export` từ `reviews.service.ts` thì export chúng — chỉ thêm từ khoá `export`, không đổi gì khác.) Kiểm tra import prisma đúng đường dẫn thật — xem cách `media.service.ts` import.

- [ ] **Step 5: Viết controller** — `apps/api/src/modules/media/media.controller.ts` theo đúng khuôn `reviews.controller.ts` (bare `@Controller()`, `@UseGuards(AuthGuard)`, `@Implement`, map `instanceof` → `errors.CODE()`; thêm `@UseGuards(ThrottlerGuard)` cho chống spam ký — import `ThrottlerGuard` từ `@nestjs/throttler`, kèm comment: endpoint ghi đã-auth đầu tiên có throttle, dùng chung config `PUBLIC_WRITE_THROTTLE` toàn cục):

```ts
import { Controller, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
import {
  BookingForbiddenError,
  BookingNotFoundError,
  ReviewNotEligibleError,
  ReviewTripNotCompletedError,
} from '../reviews/reviews.service.js';
import { UploadSigningService, UploadsNotConfiguredError } from './upload-signing.service.js';

/** Adapter mỏng cho media.signUpload — luật thật nằm trong service. */
@Controller()
export class MediaController {
  constructor(private readonly signing: UploadSigningService) {}

  @UseGuards(AuthGuard, ThrottlerGuard)
  @Implement(contract.media.signUpload)
  signUpload(@CurrentUser() user: SessionUser) {
    return implement(contract.media.signUpload).handler(async ({ input, errors }) => {
      try {
        return await this.signing.signUpload(user.id, input);
      } catch (err) {
        if (err instanceof UploadsNotConfiguredError) throw errors.MEDIA_UPLOAD_NOT_CONFIGURED();
        if (err instanceof BookingNotFoundError) throw errors.BOOKING_NOT_FOUND();
        if (err instanceof BookingForbiddenError) throw errors.BOOKING_FORBIDDEN();
        if (err instanceof ReviewTripNotCompletedError) throw errors.REVIEW_TRIP_NOT_COMPLETED();
        if (err instanceof ReviewNotEligibleError) throw errors.REVIEW_NOT_ELIGIBLE();
        throw err;
      }
    });
  }
}
```

(Đối chiếu import `SessionUser` với cách reviews.controller.ts import — dùng đúng đường dẫn đó.)

- [ ] **Step 6: Đăng ký** — `media.module.ts` thêm `controllers: [MediaController]` + provider `UploadSigningService`; `app.module.ts` thêm `MediaModule` vào mảng imports (kèm comment: từ ADR-0021 media có controller riêng nên phải đứng tên trong AppModule, trước đây chỉ đi ké qua Catalog/Posts).

- [ ] **Step 7: Chạy int test** — `docker start tourism-v2-postgres-1` rồi `pnpm --filter @tourism/api test:int -- src/modules/media/upload-signing.int.spec.ts` → PASS 8 case.

- [ ] **Step 8: Gate nhanh** — `pnpm gate` từ root → xanh phần api (web vẫn đỏ do mocks — Task 7 xử).

Nếu web đỏ làm `pnpm gate` fail toàn cục thì chạy `pnpm turbo run build typecheck test lint --filter=@tourism/api --filter=@tourism/contract` thay thế và ghi rõ vào báo cáo.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/media apps/api/src/app.module.ts apps/api/vitest.int.config.ts apps/api/src/modules/reviews/reviews.service.ts
git commit -m "feat(api): endpoint media.signUpload — ký direct upload theo purpose, soi quyền booking (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 5: API — `account.setAvatar` ghi `User.image`

**Files:**
- Create: `apps/api/src/auth/account-avatar.controller.ts`
- Modify: `apps/api/src/auth/account.service.ts` (thêm method), `apps/api/src/auth/auth.module.ts` (đăng ký controller)
- Test: `apps/api/src/auth/account-avatar.int.spec.ts`

**Interfaces:**
- Consumes: `contract.account.setAvatar` (Task 1), `isOwnAvatarPublicId` + `buildCloudinaryUrl` (Task 3 / lib sẵn có), `AvatarPublicIdInvalidError` (mới).
- Produces: `AccountService.setAvatar(userId: string, publicId: string | null): Promise<string | null>` — trả URL mới hoặc null.

- [ ] **Step 1: Viết int test (fail trước)** — `apps/api/src/auth/account-avatar.int.spec.ts`, bootstrap AppModule như trên (truncate `users, sessions, accounts`):

```ts
describe('account.setAvatar', () => {
  it('chưa đăng nhập → 401', async () => { /* PATCH /api/account/avatar không cookie */ });

  it('publicId đúng folder của mình → 200, image là URL delivery; /api/account/me phản chiếu', async () => {
    const { cookie, userId } = await signUpAndSignIn();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/account/avatar',
      headers: { cookie },
      payload: { publicId: `tourism/avatars/${userId}/pid-1` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().image).toBe(
      `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/avatars/${userId}/pid-1`,
    );
    const me = await app.inject({ method: 'GET', url: '/api/account/me', headers: { cookie } });
    expect(me.json().image).toBe(res.json().image);
  });

  it('publicId ở folder người khác / folder reviews → 400 AVATAR_PUBLIC_ID_INVALID', async () => { /* hai payload xấu */ });

  it('null → gỡ avatar, image về null', async () => { /* set rồi PATCH {publicId: null} */ });
});
```

(URL kỳ vọng dùng cloud `demo` — `CLOUDINARY_CLOUD_NAME` không set trong vitest.int.config nên rơi về default `demo`; nếu config int có set giá trị khác thì dùng giá trị đó.)

- [ ] **Step 2: Chạy để thấy fail** — 404 route.

- [ ] **Step 3: Service method** — thêm vào `apps/api/src/auth/account.service.ts`:

```ts
/** publicId không nằm trong folder avatar của CHÍNH user (ADR-0021 §3). */
export class AvatarPublicIdInvalidError extends Error {}
```

và method (đọc file trước, đặt theo cấu trúc sẵn có; import `env`, `prisma`, `buildCloudinaryUrl`, `isOwnAvatarPublicId`, `MediaType`):

```ts
  /**
   * Ghi avatar qua đường ĐÓNG (ADR-0021 §3): server tự dựng URL delivery từ
   * publicId đã kiểm chủ quyền rồi mới chạm User.image — cố ý KHÔNG mở
   * updateUser.image từ client vì field đó nhận chuỗi bất kỳ.
   */
  async setAvatar(userId: string, publicId: string | null): Promise<string | null> {
    if (publicId === null) {
      await prisma.user.update({ where: { id: userId }, data: { image: null } });
      return null;
    }
    if (!isOwnAvatarPublicId(env.CLOUDINARY_UPLOAD_FOLDER, userId, publicId)) {
      throw new AvatarPublicIdInvalidError();
    }
    const { url } = buildCloudinaryUrl(env.CLOUDINARY_CLOUD_NAME, {
      type: MediaType.IMAGE,
      publicId,
    });
    await prisma.user.update({ where: { id: userId }, data: { image: url } });
    return url;
  }
```

- [ ] **Step 4: Controller** — `apps/api/src/auth/account-avatar.controller.ts`, bare `@Controller()` (tách khỏi `AccountController` vì class đó mang prefix `@Controller('api/account')` REST — `@Implement` tự mang path riêng, trộn prefix dễ lệch route):

```ts
import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AuthGuard } from './auth.guard.js';
import type { SessionUser } from './auth.config.js';
import { CurrentUser } from './current-user.decorator.js';
import { AccountService, AvatarPublicIdInvalidError } from './account.service.js';

/**
 * Procedure oRPC ĐẦU TIÊN của namespace account (ADR-0021 §3) — me/delete
 * vẫn là REST thuần bên AccountController. Tách class vì prefix
 * @Controller('api/account') bên đó không dành cho @Implement.
 */
@Controller()
export class AccountAvatarController {
  constructor(private readonly account: AccountService) {}

  @UseGuards(AuthGuard)
  @Implement(contract.account.setAvatar)
  setAvatar(@CurrentUser() user: SessionUser) {
    return implement(contract.account.setAvatar).handler(async ({ input, errors }) => {
      try {
        return { image: await this.account.setAvatar(user.id, input.publicId) };
      } catch (err) {
        if (err instanceof AvatarPublicIdInvalidError) throw errors.AVATAR_PUBLIC_ID_INVALID();
        throw err;
      }
    });
  }
}
```

Đăng ký vào `auth.module.ts` (mảng `controllers`).

- [ ] **Step 5: Chạy int test** — PASS 4 case. Chạy thêm toàn bộ unit api: `pnpm --filter @tourism/api test` → xanh.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/account-avatar.controller.ts apps/api/src/auth/account-avatar.int.spec.ts apps/api/src/auth/account.service.ts apps/api/src/auth/auth.module.ts
git commit -m "feat(api): account.setAvatar — kiểm chủ quyền publicId rồi dựng URL ghi User.image (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 6: API — `reviews.create` nhận `photos` + chiều đọc trả `media`

**Files:**
- Modify: `apps/api/src/modules/reviews/reviews.service.ts` (create + toPublicReview + listByTour/mine/adminList), `apps/api/src/modules/reviews/reviews.controller.ts` (map lỗi mới), `apps/api/src/modules/reviews/reviews.module.ts` (import MediaModule), `apps/api/src/modules/reviews/reviews.int.spec.ts` (truncate + case mới)

**Interfaces:**
- Consumes: `MediaService.resolveForOwners(MediaOwnerType.REVIEW, ids)` (sẵn có), `uploadFolderFor` (Task 3), enum `MediaOwnerType.REVIEW` (Task 2).
- Produces: `PublicReview` giờ luôn có `media: MediaItem[]`; error class `ReviewPhotoInvalidError`.

- [ ] **Step 1: Viết int test (fail trước)** — thêm vào `reviews.int.spec.ts`:
  - Sửa câu TRUNCATE ở `beforeEach` thành có `media_assets` (thêm vào đầu danh sách).
  - Case mới trong describe create:

```ts
  it('photos hợp lệ → review kèm media, URL dựng từ publicId, đúng thứ tự gửi lên', async () => {
    const { cookie } = await seedCompletedBooking();
    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: {
        bookingCode: 'BK-TESTREV1',
        rating: 5,
        body: 'Great trip with lovely photos!',
        photos: [
          'tourism/reviews/BK-TESTREV1/pid-b',
          'tourism/reviews/BK-TESTREV1/pid-a',
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const media = res.json().media;
    expect(media.map((m: { publicId: string }) => m.publicId)).toEqual([
      'tourism/reviews/BK-TESTREV1/pid-b',
      'tourism/reviews/BK-TESTREV1/pid-a',
    ]);
    expect(media[0].url).toContain('/image/upload/');
    expect(media[0].role).toBe('gallery');
  });

  it('photos trỏ folder booking KHÁC → 400 REVIEW_PHOTO_INVALID, không tạo review lẫn asset', async () => {
    const { cookie } = await seedCompletedBooking();
    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: {
        bookingCode: 'BK-TESTREV1',
        rating: 5,
        body: 'Photo smuggling attempt!',
        photos: ['tourism/reviews/BK-KHAC9999/pid-x'],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('REVIEW_PHOTO_INVALID');
    expect(await prisma.review.count()).toBe(0);
    expect(await prisma.mediaAsset.count()).toBe(0);
  });

  it('không gửi photos → media rỗng (không vỡ hợp đồng cũ)', async () => { /* create thường, expect media: [] */ });
```

  - Trong describe listByTour (sau `createAndApprove`): một case review approved kèm ảnh → item có `media.length === 1`.

- [ ] **Step 2: Chạy để thấy fail** — case đầu fail (schema output thiếu media / service chưa xử photos).

- [ ] **Step 3: Sửa service** — `reviews.service.ts`:
  - Thêm error class cạnh các class sẵn có: `export class ReviewPhotoInvalidError extends Error {}`
  - Inject `MediaService` qua constructor (theo mẫu catalog.service.ts); `reviews.module.ts` thêm `MediaModule` vào imports.
  - `toPublicReview(row, media: MediaItem[] = [])` — thêm tham số, gán `media` vào object trả về; sửa các caller nội bộ (`toMyReview`/`toAdminReview` cũng nhận + truyền media).
  - Trong `create`, sau khối eligibility, trước `prisma.review.create`:

```ts
    // Ảnh phải nằm trọn trong folder ĐÚNG booking này (ADR-0021 §4) — ký cho
    // booking nào chỉ đính được vào review của booking đó.
    const photos = input.photos ?? [];
    const reviewFolder = `${uploadFolderFor(env.CLOUDINARY_UPLOAD_FOLDER, {
      purpose: 'REVIEW_PHOTO',
      bookingCode: input.bookingCode,
    })}/`;
    if (photos.some((publicId) => !publicId.startsWith(reviewFolder))) {
      throw new ReviewPhotoInvalidError();
    }
```

  - Đổi `prisma.review.create` thành `prisma.$transaction` tạo review + asset (giữ nguyên khối try/P2002 bọc ngoài):

```ts
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: { /* GIỮ NGUYÊN data hiện tại */ },
        });
        if (photos.length > 0) {
          // sortOrder = vị trí trong mảng — ảnh đầu là ảnh đại diện.
          await tx.mediaAsset.createMany({
            data: photos.map((publicId, idx) => ({
              publicId,
              type: MediaType.IMAGE,
              ownerType: MediaOwnerType.REVIEW,
              ownerId: created.id,
              role: MediaRole.gallery,
              sortOrder: idx,
            })),
          });
        }
        return created;
      });
      const media = (await this.media.resolveForOwners(MediaOwnerType.REVIEW, [row.id])).get(row.id);
      return toPublicReview(row, media ?? []);
```

  - **Chiều đọc:** trong `listByTour`, `mine`, `adminList` — sau khi có mảng rows:

```ts
    // MỘT query media cho cả trang (chống N+1) — cùng khuôn catalog/posts.
    const mediaMap = await this.media.resolveForOwners(
      MediaOwnerType.REVIEW,
      rows.map((r) => r.id),
    );
```

rồi truyền `mediaMap.get(row.id) ?? []` vào mỗi lời gọi `toPublicReview`/`toMyReview`/`toAdminReview`. Đọc kỹ ba hàm trước khi sửa — giữ nguyên cấu trúc paging.

**Lưu ý resolveForOwners sort theo `sortOrder` rồi `role`** — đúng thứ tự mảng photos đã ghi.

- [ ] **Step 4: Map lỗi mới ở controller** — `reviews.controller.ts` create thêm:

```ts
        if (err instanceof ReviewPhotoInvalidError) throw errors.REVIEW_PHOTO_INVALID();
```

- [ ] **Step 5: Chạy toàn bộ test reviews** — `pnpm --filter @tourism/api exec vitest run src/modules/reviews` (unit) + `pnpm --filter @tourism/api test:int -- src/modules/reviews/reviews.int.spec.ts` → PASS hết (kể cả case cũ — `media: []` không phá).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/reviews
git commit -m "feat(api): reviews nhận photos trong transaction + trả media theo batch (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 7: Web — hằng dời về contract + mocks/fixtures + lib upload client (TDD)

**Files:**
- Modify: `apps/web/src/lib/avatar.ts`, `apps/web/src/lib/review-photos.ts` (re-export hằng từ contract), `apps/web/src/mocks/types.ts` + fixture liên quan (`apps/web/test/fixtures/catalog.ts:24` và mọi chỗ `mocks.spec.ts` đỏ) — thêm `media: []`
- Create: `apps/web/src/lib/media-upload.ts`
- Test: `apps/web/src/lib/media-upload.spec.ts` (project node)

**Interfaces (Produces):**
```ts
export function imageExtensionOf(filename: string): (typeof ALLOWED_IMAGE_EXTENSIONS)[number] | null;
export function buildUploadFormData(file: Blob, params: SignedUploadParams): FormData;
export function uploadToCloudinary(file: Blob, params: SignedUploadParams, onProgress?: (pct: number) => void): Promise<string>; // trả publicId ĐẦY ĐỦ (kèm folder) từ response
```

- [ ] **Step 1: Re-point hằng** — đầu `lib/avatar.ts`:

```ts
import { AVATAR_MAX_BYTES } from '@tourism/contract';

/** Re-export từ contract (ADR-0021) — client/server đọc MỘT nguồn trần. */
export const MAX_AVATAR_BYTES = AVATAR_MAX_BYTES;
```

(xoá dòng `export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;` cũ; cập nhật JSDoc file — lời hứa "server sẽ dùng cùng trần" đã thành sự thật). Tương tự `review-photos.ts`: `MAX_PHOTOS = REVIEW_PHOTOS_MAX`, `MAX_PHOTO_BYTES = REVIEW_PHOTO_MAX_BYTES`. Chạy `cd apps/web && pnpm vitest run src/lib/avatar.spec.ts src/lib/review-photos.spec.ts` → PASS không sửa test (giá trị không đổi).

- [ ] **Step 2: Viết test lib upload (fail trước)** — `apps/web/src/lib/media-upload.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildUploadFormData, imageExtensionOf } from './media-upload';

const PARAMS = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'tourism/avatars/u-1',
  publicId: 'pid-1',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

describe('imageExtensionOf', () => {
  it('đuôi whitelist (không phân biệt hoa thường) → chuẩn hoá lowercase', () => {
    expect(imageExtensionOf('trip.JPG')).toBe('jpg');
    expect(imageExtensionOf('a.b.webp')).toBe('webp');
  });
  it('đuôi lạ / không đuôi → null', () => {
    expect(imageExtensionOf('malware.exe')).toBeNull();
    expect(imageExtensionOf('noext')).toBeNull();
  });
});

describe('buildUploadFormData', () => {
  it('gửi ĐÚNG bộ field chữ ký phủ — file, api_key, timestamp, signature, folder, public_id', () => {
    const file = new Blob(['x'], { type: 'image/png' });
    const form = buildUploadFormData(file, PARAMS);
    expect(form.get('api_key')).toBe('key');
    expect(form.get('timestamp')).toBe('1760000000');
    expect(form.get('signature')).toBe('sig');
    expect(form.get('folder')).toBe('tourism/avatars/u-1');
    expect(form.get('public_id')).toBe('pid-1');
    expect(form.get('file')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Chạy fail** — `cd apps/web && pnpm vitest run src/lib/media-upload.spec.ts` → FAIL.

- [ ] **Step 4: Viết `lib/media-upload.ts`**:

```ts
import { ALLOWED_IMAGE_EXTENSIONS, type SignedUploadParams } from '@tourism/contract';

/**
 * Đường upload trực tiếp browser → Cloudinary (ADR-0021): API chỉ ký, bytes
 * không đi qua Nest. Phần thuần (đuôi file, dựng form) tách riêng để TDD;
 * riêng uploadToCloudinary dùng XHR vì fetch chưa có tiến trình upload.
 */

type AllowedExt = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

/** Đuôi ảnh từ tên file, chuẩn hoá lowercase; ngoài whitelist → null. */
export function imageExtensionOf(filename: string): AllowedExt | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExt) : null;
}

/** Bộ field Cloudinary xác thực — khớp chữ ký {folder, public_id, timestamp}. */
export function buildUploadFormData(file: Blob, params: SignedUploadParams): FormData {
  const form = new FormData();
  form.set('file', file);
  form.set('api_key', params.apiKey);
  form.set('timestamp', String(params.timestamp));
  form.set('signature', params.signature);
  form.set('folder', params.folder);
  form.set('public_id', params.publicId);
  return form;
}

/**
 * POST file lên Cloudinary, báo tiến trình 0–100. Trả `public_id` ĐẦY ĐỦ
 * (Cloudinary tự ghép `<folder>/<basename>`) — đúng chuỗi API cần nhận lại
 * ở account.setAvatar / reviews.create.photos.
 */
export function uploadToCloudinary(
  file: Blob,
  params: SignedUploadParams,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.uploadUrl);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const body: unknown = JSON.parse(xhr.responseText);
        const publicId =
          typeof body === 'object' && body !== null && 'public_id' in body
            ? String((body as { public_id: unknown }).public_id)
            : '';
        if (publicId) return resolve(publicId);
      }
      reject(new Error(`Cloudinary upload failed (${xhr.status})`));
    });
    xhr.addEventListener('error', () => reject(new Error('Cloudinary upload failed (network)')));
    xhr.send(buildUploadFormData(file, params));
  });
}
```

- [ ] **Step 5: Chạy pass** — spec Step 2 PASS.

- [ ] **Step 6: Vá mocks/fixtures** — `apps/web/src/mocks/types.ts` (chỗ pin "đúng 7 field" của PublicReview): thêm `media` (giờ 8 field — sửa cả comment đếm); fixture `apps/web/test/fixtures/catalog.ts` + mọi mock review thêm `media: []`. Chạy `cd apps/web && pnpm vitest run --project node` → PASS. `pnpm typecheck` từ root → **giờ phải XANH toàn repo**.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/avatar.ts apps/web/src/lib/review-photos.ts apps/web/src/lib/media-upload.ts apps/web/src/lib/media-upload.spec.ts apps/web/src/mocks apps/web/test/fixtures
git commit -m "feat(web): lib upload Cloudinary client + trần dùng chung từ contract + vá mocks nhận media (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 8: Web — nối avatar thật (upload + hiển thị 3 nơi)

**Files:**
- Modify: `apps/web/src/components/account/avatar-upload.tsx`, `apps/web/src/app/(site)/account/settings/page.tsx:57-63`, `apps/web/src/lib/api/account.ts` (+`image`), `apps/web/src/lib/api/session.ts` (+`image`), `apps/web/src/components/user-menu.tsx:80-83`, `apps/web/src/components/passport/passport-card.tsx:74-84`, `apps/web/src/app/(site)/account/page.tsx` (truyền image), `libs/shared/i18n/src/lib/messages.ts` (accountProfile.avatar thêm key)
- Test: `apps/web/src/components/account/avatar-upload.spec.tsx` (mới, project dom)

**Interfaces:**
- Consumes: `api.media.signUpload` + `api.account.setAvatar` (+`withBrowserAuth`), `imageExtensionOf`/`uploadToCloudinary` (Task 7), `validateAvatar`.
- Produces: `AvatarUpload({ initial, image }: { initial: string; image: string | null })`; `PassportCard` nhận thêm `image?: string | null`.

- [ ] **Step 1: i18n keys** — `messages.ts`, block `accountProfile.avatar` thêm:

```ts
      uploading: (pct: number) => `Uploading… ${pct}%`,
      errUpload: 'Upload failed. Please try again.',
```

Build: `pnpm turbo run build --filter=@tourism/i18n`.

- [ ] **Step 2: Viết spec component (fail trước)** — `avatar-upload.spec.tsx` theo khuôn mock của `review-form.spec.tsx:7-14`:

```tsx
const { signUpload, setAvatar } = vi.hoisted(() => ({
  signUpload: vi.fn(),
  setAvatar: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload }, account: { setAvatar } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/lib/media-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media-upload')>()),
  uploadToCloudinary: upload,
}));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
```

Case chính: (1) chọn file png hợp lệ → gọi `signUpload({purpose:'AVATAR', ext:'png'}, …)` → `uploadToCloudinary` → `setAvatar({publicId: '<full id upload trả về>'})` → `refresh()`; (2) `image` prop có sẵn → render `<img>` với src đó + nút gỡ; (3) bấm gỡ → `setAvatar({publicId: null})` + refresh; (4) upload reject → hiện `errUpload`, không gọi setAvatar. (Dùng `URL.createObjectURL` mock nếu jsdom thiếu — xem vitest.setup.ts có sẵn chưa.)

- [ ] **Step 3: Chạy fail** — `cd apps/web && pnpm vitest run src/components/account/avatar-upload.spec.tsx`.

- [ ] **Step 4: Nối `avatar-upload.tsx`** — đổi props thành `{ initial, image }: { initial: string; image: string | null }`; giữ nguyên toàn bộ khung JSX/style. Thay đổi logic:
  - Hiển thị: ưu tiên `preview` (đang upload) → `image` (đã lưu) → chữ cái đầu. Nút X hiện khi có `preview || image`.
  - `onPick` async: `validateAvatar` → `imageExtensionOf(file.name)` (null → lỗi `errNotImage`) → set preview + `phase='uploading'` → `api.media.signUpload({ purpose: 'AVATAR', ext }, { context: withBrowserAuth() })` → `uploadToCloudinary(file, params, setPct)` → `api.account.setAvatar({ publicId }, { context: withBrowserAuth() })` → `router.refresh()` (giữ preview tới khi server trả image mới qua refresh). Catch: `ORPCError` map code qua bảng nhỏ (chỉ cần generic `errUpload`), set errors, thu hồi preview.
  - `removeAvatar` async: `api.account.setAvatar({ publicId: null }, …)` → refresh; nếu chỉ có preview cục bộ (đang lỗi giữa chừng) thì thu hồi Object URL như cũ.
  - Dòng phụ hiển thị `t.uploading(pct)` khi đang upload; disable nút trong lúc bận.
  - Cập nhật JSDoc: bỏ câu `authClient.updateUser({ image })` (ADR-0021 §3 chọn đường setAvatar đóng — ghi rõ), bỏ chữ STATIC-FIRST.
- [ ] **Step 5: Luồng dữ liệu image** — `lib/api/session.ts` + `lib/api/account.ts`: thêm `image: string | null` vào interface + mapping `fetchAccountMe` (đọc comment "chỉ khai field UI thật sự đọc" — giờ UI đọc thật, cập nhật câu đó). Settings page: `<AvatarUpload initial={…} image={profile.image} />`. `user-menu.tsx`: import thêm `AvatarImage`, trong `<Avatar>` thêm `{user.image ? <AvatarImage src={user.image} alt="" /> : null}` trước Fallback. `passport-card.tsx`: prop mới `image?: string | null`; trong ô avatar vuông render `<img src={image} alt="" className="size-full rounded-2xl object-cover" />` khi có (giữ `aria-hidden` — tên đứng ngay cạnh; thêm `biome-ignore lint/performance/noImgElement` với lý do URL Cloudinary ngoài, `next/image` chưa khai remotePatterns — nợ ADR-0020); `account/page.tsx` truyền `image={me?.image ?? null}` (kiểm shape `me` trước).
- [ ] **Step 6: Chạy pass + gate nhanh** — spec Step 2 PASS; `cd apps/web && pnpm test` xanh toàn bộ; `pnpm typecheck` root xanh.
- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/account/avatar-upload.tsx apps/web/src/components/account/avatar-upload.spec.tsx apps/web/src/app/\(site\)/account/settings/page.tsx apps/web/src/app/\(site\)/account/page.tsx apps/web/src/lib/api/account.ts apps/web/src/lib/api/session.ts apps/web/src/components/user-menu.tsx apps/web/src/components/passport/passport-card.tsx libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(web): avatar lưu thật qua signUpload + setAvatar, hiển thị navbar/hộ chiếu/Settings (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 9: Web — nối ảnh review thật (composer + upload + đính vào create)

**Files:**
- Create: `apps/web/src/components/account/review-composer.tsx`
- Modify: `apps/web/src/components/account/review-photo-upload.tsx`, `apps/web/src/components/account/review-form.tsx`, `apps/web/src/app/(site)/account/bookings/[code]/page.tsx:255-267`, `libs/shared/i18n/src/lib/messages.ts` (reviews.photos.errUpload + reviews.errors.REVIEW_PHOTO_INVALID)
- Test: `apps/web/src/components/account/review-form.spec.tsx` (case photos), `apps/web/src/components/account/review-composer.spec.tsx` (mới)

**Interfaces:**
- Produces: `ReviewPhotoUpload({ bookingCode, onPhotosChange }: { bookingCode: string; onPhotosChange: (s: { publicIds: string[]; busy: boolean }) => void })`; `ReviewForm({ bookingCode, photos = [], photosBusy = false })`; `ReviewComposer({ bookingCode })` render đúng 2 `<FramePanel>` như page đang có.

- [ ] **Step 1: i18n** — `reviews.photos` thêm `errUpload: 'Upload failed. Please try again.'`; bảng `reviews.errors` thêm `REVIEW_PHOTO_INVALID: 'One of the photos could not be attached. Remove them and try again.'`. Build i18n.
- [ ] **Step 2: Spec (fail trước)** — cập nhật `review-form.spec.tsx`: case mới "có photos → payload create kèm photos đúng thứ tự" (render `<ReviewForm bookingCode="BK-ABCD1234" photos={['a','b']} />`, submit hợp lệ, expect `create` nhận `photos: ['a','b']`); case "photosBusy → nút submit disabled". Spec mới `review-composer.spec.tsx`: mock cả `api` + `uploadToCloudinary`; thả 1 file vào dropzone → chờ upload resolve → submit form → `create` nhận `photos` = publicId upload trả về.
- [ ] **Step 3: Sửa `review-photo-upload.tsx`** — props như Interfaces; `PendingPhoto` thêm `publicId?: string`; thay `startFakeUpload` bằng `startUpload(id, file)` thật:

```ts
  // Upload THẬT thay mô phỏng (ADR-0021): ký theo booking rồi POST thẳng
  // Cloudinary — lỗi ở bất kỳ bước nào thì gỡ ảnh khỏi hàng chờ + báo Alert.
  const startUpload = useCallback(
    async (id: string, file: File) => {
      try {
        const ext = imageExtensionOf(file.name);
        if (!ext) throw new Error('ext');
        const params = await api.media.signUpload(
          { purpose: 'REVIEW_PHOTO', ext, bookingCode },
          { context: withBrowserAuth() },
        );
        const publicId = await uploadToCloudinary(file, params, (pct) =>
          setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, progress: pct } : p))),
        );
        setPhotos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, publicId, progress: 100, status: 'completed' } : p)),
        );
      } catch {
        setPhotos((prev) => {
          const target = prev.find((p) => p.id === id);
          if (target) URL.revokeObjectURL(target.preview);
          return prev.filter((p) => p.id !== id);
        });
        setErrors((prev) => [...prev, `${file.name}: ${t.errUpload}`]);
      }
    },
    [bookingCode, t.errUpload],
  );
```

`addFiles` gọi `startUpload(photo.id, file)` (giữ map file theo id). Đồng bộ ra ngoài bằng MỘT `useEffect` theo `photos`:

```ts
  // Báo cha: publicIds theo ĐÚNG thứ tự sortable + cờ busy khi còn ảnh dang dở.
  useEffect(() => {
    onPhotosChange({
      publicIds: photos.flatMap((p) => (p.publicId ? [p.publicId] : [])),
      busy: photos.some((p) => p.status === 'uploading'),
    });
  }, [photos, onPhotosChange]);
```

Cập nhật JSDoc đầu file (bỏ đoạn STATIC-FIRST/mô phỏng). Kiểm `imageExtensionOf` cho file không đuôi ngay trong `addFiles` (validatePhoto pass nhưng ext null → đẩy vào `rejected` với `errorText('notImage')`).

- [ ] **Step 4: Sửa `review-form.tsx`** — props `{ bookingCode, photos = [], photosBusy = false }`; payload create thêm `...(photos.length > 0 ? { photos } : {})`; nút submit `disabled={pending || photosBusy}`. JSDoc nhắc: thứ tự photos do composer giữ.
- [ ] **Step 5: `review-composer.tsx`** — client component:

```tsx
'use client';

import { Frame, FramePanel } from '@tourism/ui/components/reui/frame'; // ĐỌC page hiện tại để lấy đúng import + props Frame đang dùng
import { useCallback, useState } from 'react';
import { ReviewForm } from './review-form';
import { ReviewPhotoUpload } from './review-photo-upload';

/**
 * Cầu nối state giữa hai FramePanel (page là Server Component nên không giữ
 * state được): ảnh upload xong ở panel trên chảy xuống form ở panel dưới.
 */
export function ReviewComposer({ bookingCode }: { bookingCode: string }) {
  const [photos, setPhotos] = useState<{ publicIds: string[]; busy: boolean }>({
    publicIds: [],
    busy: false,
  });
  const onPhotosChange = useCallback(
    (next: { publicIds: string[]; busy: boolean }) => setPhotos(next),
    [],
  );
  return (
    <>
      <FramePanel>
        <ReviewPhotoUpload bookingCode={bookingCode} onPhotosChange={onPhotosChange} />
      </FramePanel>
      <FramePanel>
        <ReviewForm bookingCode={bookingCode} photos={photos.publicIds} photosBusy={photos.busy} />
      </FramePanel>
    </>
  );
}
```

**QUAN TRỌNG:** đọc `bookings/[code]/page.tsx:255-267` trước — chép đúng className/props hai `FramePanel` hiện có vào composer (kể cả heading/hint nếu panel đang chứa), rồi thay hai panel trong page bằng `<ReviewComposer bookingCode={booking.code} />` bên trong `<Frame stacked>` giữ nguyên.

- [ ] **Step 6: Chạy pass** — spec Step 2 PASS; `cd apps/web && pnpm test` xanh.
- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/account/review-composer.tsx apps/web/src/components/account/review-composer.spec.tsx apps/web/src/components/account/review-photo-upload.tsx apps/web/src/components/account/review-form.tsx apps/web/src/components/account/review-form.spec.tsx "apps/web/src/app/(site)/account/bookings/[code]/page.tsx" libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(web): ảnh review upload thật và đính vào reviews.create qua composer (ADR-0021)"
git log -1 --format='%(trailers)'
```

---

### Task 10: Web — hiển thị ảnh review công khai trên trang tour

**Files:**
- Modify: `apps/web/src/components/tours/tour-reviews.tsx` (ReviewBody, sau `<p>{review.body}</p>` ~dòng 218)
- Check/Modify: `apps/web/src/components/destinations/region-reviews.tsx` (nếu render thân review tương tự thì thêm cùng strip; nếu chỉ trích đoạn thì bỏ qua và ghi vào báo cáo)

- [ ] **Step 1: Thêm strip ảnh vào `ReviewBody`** — ngay sau thẻ `<p>` body:

```tsx
      {review.media.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.media.map((m) => (
            // biome-ignore lint/performance/noImgElement: URL Cloudinary ngoài — next/image chưa khai remotePatterns (nợ ADR-0020).
            <img
              key={m.publicId}
              src={m.url}
              alt={m.alt ?? ''}
              loading="lazy"
              className="h-20 w-28 rounded-md border border-border object-cover"
            />
          ))}
        </div>
      ) : null}
```

(`review.media` tự có trong `TourReviewVM` vì type suy từ contract — Task 1.)

- [ ] **Step 2: Test hiện có của tour-reviews** — nếu có spec cho tour-reviews thì bổ sung fixture 1 review có media và assert render 1 `<img>`; nếu chưa có spec, thêm case vào spec gần nhất đang render ReviewBody (tìm `tour-reviews.spec`). Chạy `cd apps/web && pnpm test` → xanh.
- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tours/tour-reviews.tsx
git commit -m "feat(web): trang tour hiển thị ảnh đính kèm của review đã duyệt (ADR-0021)"
git log -1 --format='%(trailers)'
```

(Thêm `region-reviews.tsx` + spec vào lệnh add nếu có sửa.)

---

### Task 11: Tổng nghiệm thu — gate:int đầy đủ + smoke tay

- [ ] **Step 1:** `docker start tourism-v2-postgres-1`; nếu web build cần API sống (SSG): build api trước rồi chạy tạm `cd apps/api && node --env-file-if-exists=.env.local dist/main.js &` (nhớ kill sau).
- [ ] **Step 2:** `pnpm gate:int` từ ROOT → xanh toàn bộ. Ghi tổng số test vào báo cáo.
- [ ] **Step 3:** Smoke đầu-cuối cần **key Cloudinary thật** trong `apps/api/.env.local` — user cấp. Nếu chưa có: dừng ở gate xanh, báo user điền key rồi tự test tay trên dev server (avatar ở Settings + ảnh ở form review). KHÔNG merge khi user chưa duyệt (luật 2).
- [ ] **Step 4:** Không commit gì ở task này trừ khi có fix; `apps/web/AGENTS.md` giữ nguyên trạng thái WIP của user.

---

## Self-review (đã chạy)

- **Phủ ADR-0021:** §1 signUpload (T1/T3/T4) · §2 hai purpose + trần chia sẻ (T1/T4/T7) · §3 setAvatar đóng (T1/T5/T8) · §4 MediaAsset REVIEW + transaction + đọc batch + moderation ăn theo (T2/T6) · §5 web nối UI giữ nguyên (T8/T9) + hiển thị (T8/T10) · §6 env boot được khi thiếu (T3 resolveUploadConfig → null; T4 503).
- **Type nhất quán:** `SignedUploadParams` (contract) chảy qua T3→T4→T7→T8/T9; `publicId` trong `setAvatar`/`photos` luôn là bản ĐẦY ĐỦ kèm folder (Cloudinary response), còn `SignedUploadParams.publicId` là BASENAME — đã ghi chú ở cả hai đầu (T1 schema comment, T7 uploadToCloudinary comment).
- **Gap có chủ đích:** không enforce bytes phía server (bất khả với direct upload — ghi ở T1 comment hằng); rác Cloudinary để P4 (ADR); `me`/`delete` không port sang oRPC; video/lightbox/crop ngoài scope.
