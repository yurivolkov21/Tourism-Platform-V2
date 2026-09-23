# Mobile Browse T0 — Tầng dữ liệu + Token + Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng tầng dữ liệu oRPC + TanStack Query cho `apps/mobile`, mở 5 token màu, và
dựng 6 primitive mới (`SearchField`, `Chip`, `BottomSheet`, `AppImage`, `LoadErrorState`
qua `EmptyState` mở rộng, tab bar có icon) — hạ tầng bắt buộc trước khi bất kỳ màn nào
của cụm xem tour (T1–T7) nối được dữ liệu thật.

**Architecture:** oRPC `OpenAPILink` (client-only, không SSR) + `@orpc/tanstack-query` cho
cache/pull-to-refresh/retry. Không có tầng "module fetch riêng từng resource" như web —
màn gọi thẳng `orpc.<resource>.queryOptions()` qua `useQuery`. Tri-state
(loading/error/empty) port thuần từ web (`settle()`/`contentState()`), không viết lại.

**Tech Stack:** `@orpc/client` · `@orpc/openapi-client` · `@orpc/tanstack-query` ·
`@tanstack/react-query` (ghim `1.14.8` cho bộ `@orpc/*`) · `expo-image` · React Native ·
Expo Router · jest-expo + RNTL 14.

**Spec:** [docs/adr/0047-mobile-data-layer.md](../adr/0047-mobile-data-layer.md) ·
[docs/handoff/mobile-browse-handoff.md](../handoff/mobile-browse-handoff.md)

## Global Constraints

- **Token, không hex.** Mọi màu qua `useTheme()`. Lưới: `node scripts/check-mobile-tokens-only.mjs`.
- **Copy qua `@tourism/i18n`, tiếng Anh.** Comment code tiếng Việt.
- **Chỉ Biome** — không ESLint/Prettier.
- **Test bằng jest-expo + RNTL 14: mọi `fireEvent.*`, `unmount()`, `rerender()` phải `await`**
  — thiếu một chỗ thì các test SAU trong cùng file render ra cây rỗng.
- **`@orpc/*` ghim đúng `1.14.8`** khớp `apps/web`/`apps/api`/`libs/shared/contract`.
- **`OpenAPILink`, không `RPCLink`** — API mount contract theo path REST.
- **Không auto-retry mutation** — giữ default TanStack Query (mutation không tự retry).
- **Không sửa `apps/web/src/lib/cloudinary-loader.ts`** — mobile có bản pure function
  riêng, cùng thuật toán, khác chữ ký gọi (xem ADR-0047 §4 "Đã cân nhắc và loại").
- **Cổng trước khi báo xong toàn bộ plan:** `pnpm gate:int` · `pnpm turbo run bundle --filter=@tourism/mobile`
  · `node scripts/check-mobile-tokens-only.mjs` · `pnpm --filter @tourism/mobile exec expo-doctor`.

---

## Task 1: oRPC client (`apps/mobile/src/lib/api/client.ts`)

**Files:**
- Modify: `apps/mobile/package.json` (thêm dependency)
- Create: `apps/mobile/src/lib/api/client.ts`

**Interfaces:**
- Consumes: `env().apiUrl` từ `apps/mobile/src/lib/env.ts` (đã có, đã test).
- Produces: `export const orpc: JsonifiedClient<ContractRouterClient<typeof contract>>` —
  Task 2 và mọi resource module sau này (T1+) import `orpc` từ đây.

Không có bước TDD cho file này: nó chỉ là dây nối `OpenAPILink` (không có nhánh logic
thuần nào để test độc lập) — cùng tiền lệ `apps/web/src/lib/api/client.ts`, vốn cũng
không có `client.spec.ts`. Xác nhận bằng typecheck + Task 2 (integration qua
`query-client.ts`), không phải unit test riêng.

- [ ] **Step 1: Thêm dependency**

```bash
pnpm --filter @tourism/mobile add @tourism/contract@workspace:* @orpc/client@1.14.8 @orpc/openapi-client@1.14.8 @orpc/tanstack-query@1.14.8 @tanstack/react-query
```

- [ ] **Step 2: Viết `client.ts`**

```typescript
// apps/mobile/src/lib/api/client.ts
import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contract } from '@tourism/contract';
import { env } from '@/lib/env';

/**
 * Link OpenAPI (KHÔNG phải RPCLink, ADR-0016 §1 / ADR-0047 §1): API mount
 * contract theo path REST qua @orpc/nest.
 *
 * `url` LƯỜI (hàm, không giá trị) — `env()` ném lỗi khi thiếu biến; gọi ở
 * module scope là nổ lúc import, trước khi ErrorBoundary của app kịp dựng.
 */
const link = new OpenAPILink(contract, {
  url: () => env().apiUrl,
  fetch: (request, init) =>
    globalThis.fetch(request, { ...init, signal: AbortSignal.timeout(10_000) }),
  // Chỗ móc session cho wishlist (D6) — nối thật khi hạ tầng @better-auth/expo
  // xong (ADR-0047 §1, ngoài phạm vi T0). Chưa có consumer nào cần header ở đây.
});

export const orpc: JsonifiedClient<ContractRouterClient<typeof contract>> =
  createORPCClient(link);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tourism/mobile exec tsc --noEmit`
Expected: PASS, không lỗi ở `client.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/lib/api/client.ts
git commit -m "feat(mobile): dựng client oRPC OpenAPILink (ADR-0047 T0)"
```

---

## Task 2: TanStack Query provider (`apps/mobile/src/lib/api/query-client.ts` + mount)

**Files:**
- Create: `apps/mobile/src/lib/api/query-client.ts`
- Modify: `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes: `orpc` (Task 1).
- Produces: `export const queryClient: QueryClient` — mọi hook `useQuery` sau này
  (T1+) dùng qua `<QueryClientProvider client={queryClient}>` đã mount ở root.

- [ ] **Step 1: Viết `query-client.ts`**

```typescript
// apps/mobile/src/lib/api/query-client.ts
import { QueryClient } from '@tanstack/react-query';

/**
 * Một instance DUY NHẤT ở module scope — dựng lại trong thân render sẽ xoá
 * cache mỗi lần RootLayout render lại (cùng lý do `authActions` ở _layout.tsx
 * dựng ở module scope, không trong thân component).
 */
export const queryClient = new QueryClient();
```

- [ ] **Step 2: Mount `QueryClientProvider` trong `_layout.tsx`**

Sửa `apps/mobile/src/app/_layout.tsx` — thêm import và bọc `<RootStack />`:

```typescript
// Thêm vào khối import đầu file:
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/query-client';
```

```typescript
// Trong return của RootLayout(), bọc RootStack bằng QueryClientProvider —
// NẰM TRONG AuthActionsProvider (query T7/D6 cần biết đã đăng nhập hay chưa,
// AuthActionsProvider phải sẵn sàng trước):
return (
  <ThemeProvider>
    <SafeAreaProvider>
      <AuthActionsProvider value={authActions}>
        <QueryClientProvider client={queryClient}>
          <OnboardingStoreProvider value={onboardingStore}>
            <StatusBar style="auto" />
            <RootStack />
          </OnboardingStoreProvider>
        </QueryClientProvider>
      </AuthActionsProvider>
    </SafeAreaProvider>
  </ThemeProvider>
);
```

- [ ] **Step 3: Test mount không vỡ cây render**

Kiểm tra file `apps/mobile/src/routes.spec.tsx` đã có (kiểm kê route) chạy qua được
không lỗi provider:

Run: `pnpm --filter @tourism/mobile test routes.spec`
Expected: PASS — nếu `QueryClientProvider` thiếu `client` hợp lệ, mọi màn dùng
`useQuery` sau này sẽ ném ngay lúc render; ở bước này (chưa màn nào dùng query)
bài kiểm tra chỉ xác nhận cây render KHÔNG vỡ vì provider mới.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/api/query-client.ts apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): mount QueryClientProvider ở root layout (ADR-0047 T0)"
```

---

## Task 3: Tri-state thuần (`resilience.ts`)

**Files:**
- Create: `apps/mobile/src/lib/api/resilience.ts`
- Test: `apps/mobile/src/lib/api/resilience.spec.ts`

**Interfaces:**
- Produces: `settle<T>(promise: Promise<T>): Promise<Settled<T>>`,
  `contentState(input: {failed: boolean; isEmpty: boolean}): 'error'|'empty'|'content'`
  — mọi hook màn (T1+) dùng để suy trạng thái UI từ kết quả `useQuery`.

- [ ] **Step 1: Viết test trước (port nguyên từ `apps/web/src/lib/api/resilience.spec.ts`)**

```typescript
// apps/mobile/src/lib/api/resilience.spec.ts
import { contentState, settle } from './resilience';

describe('settle', () => {
  it('promise resolve → {ok:true, data}', async () => {
    expect(await settle(Promise.resolve([1]))).toEqual({ ok: true, data: [1] });
  });
  it('promise reject → {ok:false, data:null} và KHÔNG throw', async () => {
    expect(await settle(Promise.reject(new Error('down')))).toEqual({ ok: false, data: null });
  });
});

describe('contentState', () => {
  it('failed thắng isEmpty — API sập không được hiện empty-state (nói dối)', () => {
    expect(contentState({ failed: true, isEmpty: true })).toBe('error');
  });
  it('rỗng thật → empty; có dữ liệu → content', () => {
    expect(contentState({ failed: false, isEmpty: true })).toBe('empty');
    expect(contentState({ failed: false, isEmpty: false })).toBe('content');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile test resilience.spec`
Expected: FAIL — `Cannot find module './resilience'`.

- [ ] **Step 3: Viết implementation**

```typescript
// apps/mobile/src/lib/api/resilience.ts
/**
 * Tri-state của mọi section dữ liệu API (ADR-0047 §3, port từ
 * `apps/web/src/lib/api/resilience.ts` — ADR-0016 §4): lỗi ≠ rỗng ≠ có nội dung.
 */
export type Settled<T> = { ok: true; data: T } | { ok: false; data: null };

export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch {
    return { ok: false, data: null };
  }
}

/** `failed` thắng `isEmpty`: empty-state khi API lỗi là nói dối người dùng. */
export function contentState(input: {
  failed: boolean;
  isEmpty: boolean;
}): 'error' | 'empty' | 'content' {
  if (input.failed) return 'error';
  return input.isEmpty ? 'empty' : 'content';
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile test resilience.spec`
Expected: PASS — 4/4 test xanh.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/api/resilience.ts apps/mobile/src/lib/api/resilience.spec.ts
git commit -m "feat(mobile): port settle()/contentState() từ web (ADR-0047 T0)"
```

---

## Task 4: `cloudinaryUrl()` thuần

**Files:**
- Create: `apps/mobile/src/lib/cloudinary-url.ts`
- Test: `apps/mobile/src/lib/cloudinary-url.spec.ts`

**Interfaces:**
- Produces: `cloudinaryUrl(src: string, width: number, quality?: number): string` —
  Task 7 (`AppImage`) là consumer đầu tiên.

- [ ] **Step 1: Viết test trước (port + đổi chữ ký từ `apps/web/src/lib/cloudinary-loader.spec.ts`)**

```typescript
// apps/mobile/src/lib/cloudinary-url.spec.ts
import { cloudinaryUrl } from './cloudinary-url';

describe('cloudinaryUrl', () => {
  it('chèn w_<width> vào URL đã có f_auto,q_auto (dạng API dựng)', () => {
    expect(
      cloudinaryUrl('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero', 640),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/v1/tourism/hero');
  });

  it('idempotent: đã có w_ thì THAY chứ không chồng thêm', () => {
    const once = cloudinaryUrl(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
      640,
    );
    const twice = cloudinaryUrl(once, 1280);
    expect(twice).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1280/v1/tourism/hero',
    );
    expect(twice.match(/w_/g)?.length).toBe(1);
  });

  it('URL không có segment transformation → chèn đủ f_auto,q_auto,w_', () => {
    expect(
      cloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v1/tourism/hero', 320),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v1/tourism/hero');
  });

  it('quality truyền vào thay q_auto', () => {
    expect(
      cloudinaryUrl(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
        640,
        80,
      ),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_80,w_640/v1/tourism/hero');
  });

  it('publicId phẳng có gạch dưới (my_photo.jpg) KHÔNG bị nuốt vào segment transform', () => {
    expect(
      cloudinaryUrl('https://res.cloudinary.com/demo/image/upload/my_photo.jpg', 640),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/my_photo.jpg');
  });

  it('thư mục đầu kiểu ab_cd/ giữ nguyên, chèn segment MỚI trước nó', () => {
    expect(
      cloudinaryUrl('https://res.cloudinary.com/demo/image/upload/ab_cd/folder/pic.jpg', 640),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/ab_cd/folder/pic.jpg');
  });

  it('URL ký (s--…--) trả NGUYÊN — chèn gì cũng làm chữ ký sai (401)', () => {
    const signed = 'https://res.cloudinary.com/demo/image/upload/s--AbCdEf12--/v1/tourism/hero';
    expect(cloudinaryUrl(signed, 640)).toBe(signed);
  });

  it('giữ tham số khác (c_limit) ở đuôi khi merge', () => {
    expect(
      cloudinaryUrl(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1600,c_limit/v1/tourism/hero',
        640,
      ),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640,c_limit/v1/tourism/hero',
    );
  });

  it('URL ngoài Cloudinary trả NGUYÊN', () => {
    for (const src of [
      'https://images.example.com/photo.jpg',
      '/local/static.png',
      'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/clip',
    ]) {
      expect(cloudinaryUrl(src, 640)).toBe(src);
    }
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile test cloudinary-url.spec`
Expected: FAIL — `Cannot find module './cloudinary-url'`.

- [ ] **Step 3: Viết implementation (port từ `apps/web/src/lib/cloudinary-loader.ts`, đổi chữ ký)**

```typescript
// apps/mobile/src/lib/cloudinary-url.ts
/**
 * Build URL transform Cloudinary cho RN (ADR-0047 §4, port thuật toán từ
 * `apps/web/src/lib/cloudinary-loader.ts` — ADR-0020 §Hệ quả). Chữ ký khác
 * loader Next (`{src,width,quality}`) vì RN không có hợp đồng `next/image`.
 *
 * Hợp đồng (có test): chỉ đụng URL Cloudinary (`/image/upload/`), idempotent,
 * escape-hatch URL ký, publicId phẳng không bị nuốt vào segment transform.
 */

const IMAGE_UPLOAD_MARKER = '/image/upload/';

function isTransformationSegment(segment: string): boolean {
  if (segment.includes(',')) return /^[a-z]{1,3}_/.test(segment);
  return /^(f_auto|q_auto|q_\d{1,3}|w_\d+)$/.test(segment);
}

export function cloudinaryUrl(src: string, width: number, quality?: number): string {
  if (!src.startsWith('https://res.cloudinary.com/')) return src;
  const markerAt = src.indexOf(IMAGE_UPLOAD_MARKER);
  if (markerAt === -1) return src;

  const prefix = src.slice(0, markerAt + IMAGE_UPLOAD_MARKER.length);
  const rest = src.slice(prefix.length);
  if (rest.startsWith('s--')) return src;
  const [head = '', ...tail] = rest.split('/');

  const q = quality ? `q_${quality}` : 'q_auto';
  if (tail.length > 0 && isTransformationSegment(head)) {
    const others = head
      .split(',')
      .filter((p) => !p.startsWith('f_') && !p.startsWith('q_') && !p.startsWith('w_'));
    return `${prefix}${['f_auto', q, `w_${width}`, ...others].join(',')}/${tail.join('/')}`;
  }
  return `${prefix}f_auto,${q},w_${width}/${rest}`;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile test cloudinary-url.spec`
Expected: PASS — 8/8 test xanh.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/cloudinary-url.ts apps/mobile/src/lib/cloudinary-url.spec.ts
git commit -m "feat(mobile): cloudinaryUrl() thuần, port thuật toán loader web (ADR-0047 T0)"
```

---

## Task 5: Mở 5 token màu (`rating`, `rating-muted`, `price-compare`, `warning`, `overlay`)

**Files:**
- Modify: `libs/mobile/ui/src/lib/theme.ts`
- Modify: `libs/mobile/ui/src/lib/theme.spec.ts`

**Interfaces:**
- Produces: `MOBILE_COLOR_KEYS` có thêm 5 khoá — Task 8 (Chip dùng `rating` cho sao
  ở D7 sau này), Task 7 (`AppImage` dùng `overlay` cho scrim khi tải).

- [ ] **Step 1: Viết test trước — thêm describe block mirror "bốn khoá màu thêm cho cụm auth"**

Thêm vào `libs/mobile/ui/src/lib/theme.spec.ts`, ngay sau block `'bốn khoá màu thêm cho cụm auth'`:

```typescript
describe('năm khoá màu thêm cho cụm browse (P5b-2)', () => {
  it.each(['rating', 'rating-muted', 'price-compare', 'warning', 'overlay'] as const)(
    'khoá "%s" có mặt ở cả hai chế độ và lấy đúng giá trị cầu token',
    (key) => {
      expect(buildTheme('light').colors[key]).toBe(tokens.colors.light[key]);
      expect(buildTheme('dark').colors[key]).toBe(tokens.colors.dark[key]);
    },
  );
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile-ui test theme.spec`
Expected: FAIL — kiểu TypeScript báo `key` không nằm trong `MobileColorKey` (biên dịch
lỗi trước khi kịp chạy), hoặc runtime lỗi nếu bản build cũ còn cache.

- [ ] **Step 3: Mở khoá trong `MOBILE_COLOR_KEYS`**

Sửa `libs/mobile/ui/src/lib/theme.ts`, mảng `MOBILE_COLOR_KEYS`:

```typescript
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
  // P5b-1: bốn khoá cụm auth thật sự dùng — chữ nằm trên ảnh, câu lỗi, viền ô
  // nhập, và màu phủ ảnh.
  'destructive-emphasis',
  'input',
  'on-media',
  'primary-emphasis',
  'scrim',
  // P5b-2 (ADR-0047): sao đánh giá, giá gạch, cảnh báo, scrim ảnh gallery.
  'rating',
  'rating-muted',
  'price-compare',
  'warning',
  'overlay',
] as const;
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile-ui test theme.spec`
Expected: PASS — mọi test cũ + 5 test mới đều xanh (kể cả `it('lấy màu ĐÚNG bằng giá
trị trong cầu token...')` vốn lặp qua `MOBILE_COLOR_KEYS` — tự động phủ 5 khoá mới).

- [ ] **Step 5: Commit**

```bash
git add libs/mobile/ui/src/lib/theme.ts libs/mobile/ui/src/lib/theme.spec.ts
git commit -m "feat(mobile-ui): mở 5 token màu cho cụm browse (ADR-0047 T0)"
```

---

## Task 6: `LoadErrorState` — mở rộng `EmptyState` có sẵn thêm khe icon

**Quyết định thi công (không cần sửa ADR):** ADR-0047 gọi khối "icon vuông + câu + nút"
là "component `LoadErrorState`". `EmptyState` đã có sẵn (title/body/children) và đã
được `ErrorBoundary` ở `_layout.tsx` dùng cho đúng việc này (title lỗi + `Button` retry
trong `children`). Thay vì dựng component song song trùng layout, mở rộng `EmptyState`
thêm khe `icon?: ReactNode` — dùng CHUNG cho cả ba trạng thái (loading dùng riêng khung
xám, không qua đây; error/empty dùng `EmptyState` với `icon` khác nhau). Đây là quyết
định "reuse trước khi build mới" — không đổi hợp đồng cũ (mọi chỗ gọi hiện tại không
truyền `icon` vẫn chạy y hệt).

**Files:**
- Modify: `libs/mobile/ui/src/lib/empty-state.tsx`
- Modify: `libs/mobile/ui/src/lib/empty-state.spec.tsx`

**Interfaces:**
- Consumes: `AppText`, `Card`, `useTheme` (đã có).
- Produces: `EmptyStateProps.icon?: ReactNode` — màn T1+ dùng `<EmptyState icon={<Feather name="wifi-off" .../>} title=... body=...><Button label="Retry" onPress={refetch} /></EmptyState>` cho cả tri-state lỗi lẫn rỗng.

- [ ] **Step 1: Đọc test hiện có để biết khuôn**

```bash
cat libs/mobile/ui/src/lib/empty-state.spec.tsx
```

(File đã tồn tại — đọc trước khi thêm case mới, không đoán khuôn.)

- [ ] **Step 2: Viết test trước cho khe `icon`**

Thêm vào cuối `libs/mobile/ui/src/lib/empty-state.spec.tsx`:

```typescript
it('vẽ icon khi có truyền, không vẽ gì thêm khi không truyền (hợp đồng cũ không đổi)', async () => {
  const { queryByTestId, rerender } = await renderWithTheme(
    <EmptyState title="Không có gì" icon={<Text testID="empty-icon">★</Text>} />,
  );
  expect(queryByTestId('empty-icon')).toBeTruthy();

  await rerender(<EmptyState title="Không có gì" />);
  expect(queryByTestId('empty-icon')).toBeNull();
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile-ui test empty-state.spec`
Expected: FAIL — `icon` không phải prop hợp lệ của `EmptyStateProps` (lỗi kiểu) hoặc
không render gì khác biệt.

- [ ] **Step 4: Thêm khe `icon`**

```typescript
// libs/mobile/ui/src/lib/empty-state.tsx
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { AppText } from './app-text';
import { Card } from './card';
import { useTheme } from './theme-provider';

export interface EmptyStateProps extends ViewProps {
  /** Icon vuông phía trên câu chính — dùng chung cho tri-state lỗi/rỗng (ADR-0047 §3). */
  icon?: ReactNode;
  /** Câu chính — tiếng Anh, lấy từ `@tourism/i18n` (luật 7). */
  title: string;
  /** Câu phụ giải thích hoặc gợi ý bước tiếp theo. */
  body?: string;
  /** Khe cho hành động đi kèm (thường là một `Button`). */
  children?: ReactNode;
}

/** Ô "chưa có gì ở đây" / "không tải được" — dùng chung cho danh sách rỗng, lỗi tải, và màn giữ chỗ. */
export function EmptyState({ icon, title, body, children, style, ...rest }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <Card style={[{ alignItems: 'center', gap: theme.spacing(2) }, style]} {...rest}>
      {icon}
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body === undefined ? null : (
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      )}
      {children}
    </Card>
  );
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile-ui test empty-state.spec`
Expected: PASS — test cũ vẫn xanh (hợp đồng không đổi) + test icon mới xanh.

- [ ] **Step 6: Commit**

```bash
git add libs/mobile/ui/src/lib/empty-state.tsx libs/mobile/ui/src/lib/empty-state.spec.tsx
git commit -m "feat(mobile-ui): EmptyState thêm khe icon, dùng chung cho tri-state lỗi (ADR-0047 T0)"
```

---

## Task 7: `AppImage` — bọc `expo-image` + `cloudinaryUrl()`

**Files:**
- Modify: `libs/mobile/ui/package.json`, `apps/mobile/package.json` (thêm `expo-image`)
- Create: `libs/mobile/ui/src/lib/app-image.tsx`
- Test: `libs/mobile/ui/src/lib/app-image.spec.tsx`
- Modify: `libs/mobile/ui/src/index.ts` (export)

**Interfaces:**
- Consumes: `cloudinaryUrl()` — nhưng `@tourism/mobile-ui` KHÔNG phụ thuộc `apps/mobile`
  (ranh giới package ngược chiều cấm, ADR-0040 §2). `cloudinaryUrl()` vì vậy nhận vào
  làm THAM SỐ (`transformUrl` prop có default), không import trực tiếp — xem Step 3.
- Produces: `<AppImage source={uri} width={number} />` — Task 9+ (Chip/card ảnh, T1+)
  dùng để vẽ mọi ảnh tour.

- [ ] **Step 1: Thêm dependency**

```bash
pnpm --filter @tourism/mobile-ui add expo-image
pnpm --filter @tourism/mobile add expo-image
```

- [ ] **Step 2: Viết test trước**

```typescript
// libs/mobile/ui/src/lib/app-image.spec.tsx
import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { AppImage } from './app-image';

describe('AppImage', () => {
  it('build source.uri qua transformUrl với đúng width truyền vào', async () => {
    const transformUrl = jest.fn((src: string, width: number) => `${src}?w=${width}`);
    await renderWithTheme(
      <AppImage
        source="https://res.cloudinary.com/demo/image/upload/hero.jpg"
        width={320}
        alt="Hero"
        transformUrl={transformUrl}
      />,
    );

    expect(transformUrl).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/hero.jpg',
      320,
    );
    expect(screen.getByLabelText('Hero').props.source).toEqual({
      uri: 'https://res.cloudinary.com/demo/image/upload/hero.jpg?w=320',
    });
  });

  it('accessibilityLabel lấy từ prop alt', async () => {
    await renderWithTheme(
      <AppImage source="https://res.cloudinary.com/demo/image/upload/hero.jpg" width={100} alt="Vịnh Hạ Long" />,
    );
    expect(screen.getByLabelText('Vịnh Hạ Long')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile-ui test app-image.spec`
Expected: FAIL — `Cannot find module './app-image'`.

- [ ] **Step 4: Viết implementation**

```typescript
// libs/mobile/ui/src/lib/app-image.tsx
import { Image, type ImageProps } from 'expo-image';
import { useTheme } from './theme-provider';

export interface AppImageProps extends Omit<ImageProps, 'source' | 'style' | 'accessibilityLabel'> {
  /** URL gốc (thường là Cloudinary) — CHƯA transform. */
  source: string;
  /** Bề rộng dp cần render — truyền vào `transformUrl` để Cloudinary co ảnh đúng cỡ. */
  width: number;
  height?: number;
  alt: string;
  /**
   * Hàm build URL transform. Mặc định KHÔNG transform gì (trả nguyên `source`) —
   * `@tourism/mobile-ui` không phụ thuộc ngược `apps/mobile` (ADR-0040 §2) nên
   * không tự import `cloudinaryUrl()`; app truyền vào lúc dùng, hoặc dựng một
   * `AppImage` đã curry sẵn `transformUrl` ở tầng app nếu muốn khỏi truyền lặp lại.
   */
  transformUrl?: (source: string, width: number) => string;
}

/** Ảnh chuẩn của app — cache đĩa + placeholder nền `muted` lúc tải (ADR-0047 §4). */
export function AppImage({
  source,
  width,
  height,
  alt,
  transformUrl = (src) => src,
  ...rest
}: AppImageProps) {
  const theme = useTheme();
  const uri = transformUrl(source, width);

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt}
      style={{ width, height: height ?? width, backgroundColor: theme.colors.muted }}
      transition={200}
      {...rest}
    />
  );
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile-ui test app-image.spec`
Expected: PASS — 2/2 test xanh.

- [ ] **Step 6: Export từ `index.ts`**

Thêm vào `libs/mobile/ui/src/index.ts`:

```typescript
export type { AppImageProps } from './lib/app-image';
export { AppImage } from './lib/app-image';
```

- [ ] **Step 7: Commit**

```bash
git add libs/mobile/ui/package.json apps/mobile/package.json pnpm-lock.yaml \
  libs/mobile/ui/src/lib/app-image.tsx libs/mobile/ui/src/lib/app-image.spec.tsx \
  libs/mobile/ui/src/index.ts
git commit -m "feat(mobile-ui): AppImage bọc expo-image, nhận transformUrl (ADR-0047 T0)"
```

---

## Task 8: `SearchField`

**Files:**
- Create: `libs/mobile/ui/src/lib/search-field.tsx`
- Test: `libs/mobile/ui/src/lib/search-field.spec.tsx`
- Modify: `libs/mobile/ui/src/index.ts`

**Interfaces:**
- Consumes: `useTheme`, `AppText`, `Feather` (`FeatherIconName` re-export từ `text-field.tsx`).
- Produces: `<SearchField value onChangeText placeholder />` — Task E2/E3 (T2/T3, ngoài
  phạm vi plan này) dùng cho ô tìm Explore.

Số đo port từ CSS mockup `.search` (`docs/design/mockups/mobile-browse-screens.src.html:120-121`):
`height: var(--touch)` → `theme.touchTargetMin`; bo tròn pill; nền `card`; viền 1px `border`;
gap `spacing(2.5)`; padding ngang `spacing(4)`; chữ/placeholder `muted-foreground`. Focus:
viền 2px `primary-emphasis`, chữ `foreground`.

- [ ] **Step 1: Viết test trước**

```typescript
// libs/mobile/ui/src/lib/search-field.spec.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { SearchField } from './search-field';

describe('SearchField', () => {
  it('gọi onChangeText khi gõ', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <SearchField value="" onChangeText={onChangeText} placeholder="Search tours" />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('Search tours'), 'ha');
    expect(onChangeText).toHaveBeenCalledWith('ha');
  });

  it('nền pill và viền mặc định lấy đúng token', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<SearchField value="" onChangeText={jest.fn()} placeholder="Search" />);
    const style = StyleSheet.flatten(screen.getByTestId('search-field-shell').props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.borderColor).toBe(theme.colors.border);
    expect(style.borderWidth).toBe(1);
  });

  it('focus đổi viền sang 2px primary-emphasis', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<SearchField value="" onChangeText={jest.fn()} placeholder="Search" />);
    const input = screen.getByPlaceholderText('Search');
    await fireEvent(input, 'focus');
    const style = StyleSheet.flatten(screen.getByTestId('search-field-shell').props.style);
    expect(style.borderWidth).toBe(2);
    expect(style.borderColor).toBe(theme.colors['primary-emphasis']);
  });

  it('có nút xoá khi value không rỗng, bấm thì gọi onChangeText("")', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <SearchField value="ha noi" onChangeText={onChangeText} placeholder="Search" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /clear/i }));
    expect(onChangeText).toHaveBeenCalledWith('');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile-ui test search-field.spec`
Expected: FAIL — `Cannot find module './search-field'`.

- [ ] **Step 3: Viết implementation**

```typescript
// libs/mobile/ui/src/lib/search-field.tsx
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface SearchFieldProps
  extends Omit<TextInputProps, 'style' | 'onFocus' | 'onBlur'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Nhãn a11y cho nút xoá — mặc định "Clear search". */
  clearLabel?: string;
}

/** Ô tìm pill (bản vẽ 18/09, `.search` — ADR-0047 T3). */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  clearLabel = 'Clear search',
  ...rest
}: SearchFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      testID="search-field-shell"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: theme.touchTargetMin,
        borderRadius: 999,
        backgroundColor: theme.colors.card,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? theme.colors['primary-emphasis'] : theme.colors.border,
        gap: theme.spacing(2.5),
        paddingHorizontal: theme.spacing(4),
      }}
    >
      <Feather name="search" size={18} color={theme.colors['muted-foreground']} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors['muted-foreground']}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          color: focused ? theme.colors.foreground : theme.colors['muted-foreground'],
          fontFamily: theme.fonts.normal,
          fontSize: theme.type.base.fontSize,
          padding: 0,
        }}
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          hitSlop={theme.spacing(2)}
          onPress={() => onChangeText('')}
        >
          <Feather name="x" size={16} color={theme.colors['muted-foreground']} />
        </Pressable>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile-ui test search-field.spec`
Expected: PASS — 4/4 test xanh.

- [ ] **Step 5: Export từ `index.ts`**

```typescript
export type { SearchFieldProps } from './lib/search-field';
export { SearchField } from './lib/search-field';
```

- [ ] **Step 6: Commit**

```bash
git add libs/mobile/ui/src/lib/search-field.tsx libs/mobile/ui/src/lib/search-field.spec.tsx libs/mobile/ui/src/index.ts
git commit -m "feat(mobile-ui): primitive SearchField (ADR-0047 T0)"
```

---

## Task 9: `Chip`

**Files:**
- Create: `libs/mobile/ui/src/lib/chip.tsx`
- Test: `libs/mobile/ui/src/lib/chip.spec.tsx`
- Modify: `libs/mobile/ui/src/index.ts`

**Interfaces:**
- Consumes: `AppText`, `useTheme`, `Feather`.
- Produces: `<Chip label variant="default"|"selected"|"removable" onPress? onRemove? />`
  — Task T2/T4 (danh mục/lọc Explore, ngoài phạm vi plan này) dùng.

Số đo port từ CSS mockup (`mobile-browse-screens.src.html:115-117`): height `spacing(8)`,
padding ngang `spacing(3.5)`, radius pill, gap `spacing(1.5)`, viền 1px `border`, chữ
`foreground` cỡ `sm` (14px, khớp `theme.type.sm`) độ đậm medium mặc định. `selected`
("`.chip.on`"): nền + viền `primary`, chữ `primary-foreground`, độ đậm semibold.
`removable` (dòng 587, "`.chip.soft`" cho bộ lọc đang bật): nền + viền `secondary`, chữ
`secondary-foreground`, kèm icon `x`.

- [ ] **Step 1: Viết test trước**

```typescript
// libs/mobile/ui/src/lib/chip.spec.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { Chip } from './chip';

describe('Chip', () => {
  it('variant "default": viền border, nền trong suốt', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Chip label="Trekking" />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.borderColor).toBe(theme.colors.border);
    expect(style.backgroundColor).toBe('transparent');
  });

  it('variant "selected": nền/viền primary, chữ primary-foreground', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Chip label="Trekking" variant="selected" />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.backgroundColor).toBe(theme.colors.primary);
    const textStyle = StyleSheet.flatten(screen.getByText('Trekking').props.style);
    expect(textStyle.color).toBe(theme.colors['primary-foreground']);
  });

  it('variant "removable": nền/viền secondary, có nút x gọi onRemove', async () => {
    const theme = themeFor('light');
    const onRemove = jest.fn();
    await renderWithTheme(<Chip label="Trekking" variant="removable" onRemove={onRemove} />);
    const style = StyleSheet.flatten(screen.getByText('Trekking').parent?.props.style);
    expect(style.backgroundColor).toBe(theme.colors.secondary);

    await fireEvent.press(screen.getByRole('button', { name: /remove trekking/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('bấm chip (không phải nút x) gọi onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Chip label="Trekking" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Trekking'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile-ui test chip.spec`
Expected: FAIL — `Cannot find module './chip'`.

- [ ] **Step 3: Viết implementation**

```typescript
// libs/mobile/ui/src/lib/chip.tsx
import Feather from '@expo/vector-icons/Feather';
import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import type { MobileColorKey } from './theme';
import { useTheme } from './theme-provider';

export type ChipVariant = 'default' | 'selected' | 'removable';

const CHIP_VARIANTS = {
  default: { background: null, border: 'border', foreground: 'foreground' },
  selected: { background: 'primary', border: 'primary', foreground: 'primary-foreground' },
  removable: { background: 'secondary', border: 'secondary', foreground: 'secondary-foreground' },
} as const satisfies Record<
  ChipVariant,
  { background: MobileColorKey | null; border: MobileColorKey; foreground: MobileColorKey }
>;

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
  /** Chỉ dùng khi `variant="removable"`. */
  onRemove?: () => void;
}

/** Chip pill (`.chip`/`.chip.on`/`.chip.soft` bản vẽ 18/09 — ADR-0047 T0). */
export function Chip({ label, variant = 'default', onPress, onRemove }: ChipProps) {
  const theme = useTheme();
  const { background, border, foreground } = CHIP_VARIANTS[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: theme.spacing(8),
        paddingHorizontal: theme.spacing(3.5),
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors[border],
        backgroundColor: background === null ? 'transparent' : theme.colors[background],
        gap: theme.spacing(1.5),
      }}
    >
      <AppText
        variant="label"
        style={{
          color: theme.colors[foreground],
          fontFamily: variant === 'selected' ? theme.fonts.semibold : theme.fonts.medium,
        }}
      >
        {label}
      </AppText>
      {variant === 'removable' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={theme.spacing(2)}
          onPress={onRemove}
        >
          <Feather name="x" size={14} color={theme.colors[foreground]} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile-ui test chip.spec`
Expected: PASS — 4/4 test xanh.

- [ ] **Step 5: Export từ `index.ts`**

```typescript
export type { ChipProps, ChipVariant } from './lib/chip';
export { Chip } from './lib/chip';
```

- [ ] **Step 6: Commit**

```bash
git add libs/mobile/ui/src/lib/chip.tsx libs/mobile/ui/src/lib/chip.spec.tsx libs/mobile/ui/src/index.ts
git commit -m "feat(mobile-ui): primitive Chip (default/selected/removable) (ADR-0047 T0)"
```

---

## Task 10: `BottomSheet`

**Files:**
- Create: `libs/mobile/ui/src/lib/bottom-sheet.tsx`
- Test: `libs/mobile/ui/src/lib/bottom-sheet.spec.tsx`
- Modify: `libs/mobile/ui/src/index.ts`

**Interfaces:**
- Consumes: `useTheme`, RN `Modal`.
- Produces: `<BottomSheet visible onClose>{children}</BottomSheet>` — Task T4/D6 (ngoài
  phạm vi plan này) dùng cho lọc Explore và tấm mời đăng nhập.

Số đo port từ CSS mockup (`.sheet`, `.sheet .handle`, dòng 173-174): góc trên bo
`spacing(7)` (28px, `--spacing`=4px × 7), nền `card`, handle: thanh nhỏ giữa đỉnh, màu
`muted-foreground` pha alpha 0.5 (`withAlpha`). **Không kéo-thả đóng bằng cử chỉ** —
YAGNI cho T0, `onClose` chỉ gọi khi bấm backdrop hoặc app tự đóng; thêm gesture khi có
màn thật cần (T4/D6).

- [ ] **Step 1: Viết test trước**

```typescript
// libs/mobile/ui/src/lib/bottom-sheet.spec.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithTheme } from '../test-utils';
import { BottomSheet } from './bottom-sheet';

describe('BottomSheet', () => {
  it('visible=false không vẽ children', async () => {
    await renderWithTheme(
      <BottomSheet visible={false} onClose={jest.fn()}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('Filters')).toBeNull();
  });

  it('visible=true vẽ children', async () => {
    await renderWithTheme(
      <BottomSheet visible onClose={jest.fn()}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Filters')).toBeTruthy();
  });

  it('bấm backdrop gọi onClose', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <BottomSheet visible onClose={onClose}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    await fireEvent.press(screen.getByTestId('bottom-sheet-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile-ui test bottom-sheet.spec`
Expected: FAIL — `Cannot find module './bottom-sheet'`.

- [ ] **Step 3: Viết implementation**

```typescript
// libs/mobile/ui/src/lib/bottom-sheet.tsx
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Tấm trượt từ đáy (`.sheet` bản vẽ 18/09 — ADR-0047 T0). Không gesture kéo-thả. */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        testID="bottom-sheet-backdrop"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.colors.overlay }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: theme.spacing(7),
          borderTopRightRadius: theme.spacing(7),
          paddingTop: theme.spacing(4),
          paddingBottom: theme.spacing(6),
          paddingHorizontal: theme.spacing(4),
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: theme.spacing(2),
            left: '50%',
            marginLeft: -18,
            width: 36,
            height: 4,
            borderRadius: 999,
            backgroundColor: withAlpha(theme.colors['muted-foreground'], 0.5),
          }}
        />
        {children}
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile-ui test bottom-sheet.spec`
Expected: PASS — 3/3 test xanh.

- [ ] **Step 5: Export từ `index.ts`**

```typescript
export type { BottomSheetProps } from './lib/bottom-sheet';
export { BottomSheet } from './lib/bottom-sheet';
```

- [ ] **Step 6: Commit**

```bash
git add libs/mobile/ui/src/lib/bottom-sheet.tsx libs/mobile/ui/src/lib/bottom-sheet.spec.tsx libs/mobile/ui/src/index.ts
git commit -m "feat(mobile-ui): primitive BottomSheet (ADR-0047 T0)"
```

---

## Task 11: Tab bar có icon (`TabBarIcon` + gắn vào `(tabs)/_layout.tsx`)

**Files:**
- Create: `libs/mobile/ui/src/lib/tab-bar-icon.tsx`
- Test: `libs/mobile/ui/src/lib/tab-bar-icon.spec.tsx`
- Modify: `libs/mobile/ui/src/index.ts`
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Feather`.
- Produces: `<TabBarIcon name="home" focused />` — dùng làm `tabBarIcon` của mỗi
  `Tabs.Screen`.

Icon Feather đúng 5 cái theo handoff §T0: `home`, `compass`, `heart`, `briefcase`,
`user`. Mục đang chọn có viên nền `primary` phía sau icon (handoff §T0).

- [ ] **Step 1: Viết test trước**

```typescript
// libs/mobile/ui/src/lib/tab-bar-icon.spec.tsx
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { TabBarIcon } from './tab-bar-icon';

describe('TabBarIcon', () => {
  it('focused=false: không viên nền', async () => {
    await renderWithTheme(<TabBarIcon name="home" focused={false} />);
    const style = StyleSheet.flatten(screen.getByTestId('tab-bar-icon-pill').props.style);
    expect(style.backgroundColor).toBe('transparent');
  });

  it('focused=true: viên nền primary', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<TabBarIcon name="home" focused />);
    const style = StyleSheet.flatten(screen.getByTestId('tab-bar-icon-pill').props.style);
    expect(style.backgroundColor).toBe(theme.colors.primary);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @tourism/mobile-ui test tab-bar-icon.spec`
Expected: FAIL — `Cannot find module './tab-bar-icon'`.

- [ ] **Step 3: Viết implementation**

```typescript
// libs/mobile/ui/src/lib/tab-bar-icon.tsx
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useTheme } from './theme-provider';

export interface TabBarIconProps {
  name: ComponentProps<typeof Feather>['name'];
  focused: boolean;
}

/** Icon tab với viên nền `primary` khi đang chọn (handoff §T0 — 5 tab). */
export function TabBarIcon({ name, focused }: TabBarIconProps) {
  const theme = useTheme();

  return (
    <View
      testID="tab-bar-icon-pill"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: theme.spacing(9),
        height: theme.spacing(9),
        borderRadius: 999,
        backgroundColor: focused ? theme.colors.primary : 'transparent',
      }}
    >
      <Feather
        name={name}
        size={20}
        color={focused ? theme.colors['primary-foreground'] : theme.colors['muted-foreground']}
      />
    </View>
  );
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm --filter @tourism/mobile-ui test tab-bar-icon.spec`
Expected: PASS — 2/2 test xanh.

- [ ] **Step 5: Export từ `index.ts`**

```typescript
export type { TabBarIconProps } from './lib/tab-bar-icon';
export { TabBarIcon } from './lib/tab-bar-icon';
```

- [ ] **Step 6: Gắn vào `(tabs)/_layout.tsx`**

```typescript
// apps/mobile/src/app/(tabs)/_layout.tsx
import { messages } from '@tourism/i18n';
import { TabBarIcon, useTheme } from '@tourism/mobile-ui';
import { Tabs } from 'expo-router';

const TAB_ICONS = {
  index: 'home',
  explore: 'compass',
  saved: 'heart',
  trips: 'briefcase',
  account: 'user',
} as const;

export default function TabsLayout() {
  const theme = useTheme();
  const { tabs } = messages.mobile;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors['muted-foreground'],
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      {(Object.keys(TAB_ICONS) as (keyof typeof TAB_ICONS)[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: tabs[name === 'index' ? 'home' : name],
            tabBarIcon: ({ focused }) => <TabBarIcon name={TAB_ICONS[name]} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 7: Kiểm route vẫn còn đủ 5 tab**

Run: `pnpm --filter @tourism/mobile test routes.spec`
Expected: PASS — kiểm kê route không đổi (chỉ thêm icon, không đổi tên route).

- [ ] **Step 8: Commit**

```bash
git add libs/mobile/ui/src/lib/tab-bar-icon.tsx libs/mobile/ui/src/lib/tab-bar-icon.spec.tsx \
  libs/mobile/ui/src/index.ts apps/mobile/src/app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): gắn icon Feather cho 5 tab, viên nền primary khi chọn (ADR-0047 T0)"
```

---

## Cổng cuối cùng (sau Task 11)

- [ ] `pnpm gate:int`
- [ ] `pnpm turbo run bundle --filter=@tourism/mobile`
- [ ] `pnpm --filter @tourism/mobile exec expo-doctor`
- [ ] `node scripts/check-mobile-tokens-only.mjs`
- [ ] Soi nền sáng lẫn nền tối trên máy thật/emulator (Expo Go hoặc `pnpm --filter @tourism/mobile dev`)
- [ ] Thêm entry `docs/CHANGELOG.md` (luật 13): ngày · hash · nội dung (T0 xong, T1–T7
      còn treo) · số test mới
