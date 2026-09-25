# Return-to-auth hạ tầng + AuthGateScreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng cơ chế "quay lại đúng chỗ sau đăng nhập" (return-to) dùng chung cho toàn
cụm auth, component `AuthGateScreen` (khối chặn tab full-screen dùng cho Saved/Account),
và đóng nợ D6 cũ của P5b-2 (tim khi chưa đăng nhập giờ tự lưu lại sau khi đăng nhập xong).

**Architecture:** Một module-scope singleton (`return-to.ts`, không thêm thư viện state)
giữ `{ path, replay? }`. Mọi điểm "đăng nhập/đăng ký thành công" hiện đang hardcode
`router.replace('/')` đổi sang đọc `consumeReturnPath()`. Màn đích (ví dụ tour detail) tự
đọc `consumePendingReplay()` trong một effect riêng để làm nốt việc dở (lưu wishlist).
Hai hàm đọc TÁCH RIÊNG vì hai thời điểm đọc khác nhau (chặng auth đọc path ngay khi
điều hướng; màn đích đọc replay sau khi đã mount lại) — gộp làm một sẽ khiến chặng auth
vô tình xoá mất `replay` trước khi màn đích kịp đọc.

**Tech Stack:** React Native + Expo Router (đã có) — KHÔNG thêm dependency nào.

**Spec:** [docs/plans/2026-09-25-mobile-account-screens.md](2026-09-25-mobile-account-screens.md)
mục 1 (kiến trúc), mục 1c (đóng nợ D6) · [mobile-account-handoff.md](../handoff/mobile-account-handoff.md)
mục "Ba tab chặn giống hệt nhau".

## Global Constraints

- **Token, không hex** — mọi màu qua `useTheme()`. Lưới: `node scripts/check-mobile-tokens-only.mjs`.
- **Copy qua `@tourism/i18n`, tiếng Anh.** Comment code tiếng Việt.
- **Chỉ Biome** — không ESLint/Prettier.
- **Test bằng jest-expo + RNTL 14: mọi `fireEvent.*`/`unmount()`/`rerender()` phải `await`.**
- **`@tourism/mobile-ui` app chỉ import từ barrel `index.ts`**, không với tay vào `src/lib/*`.
- **KHÔNG thêm dependency nào ở plan này** — mọi thứ dựng từ React/Expo Router sẵn có.
- **Cổng trước khi báo xong:** `pnpm --filter @tourism/mobile exec tsc --noEmit` ·
  `pnpm --filter @tourism/mobile test` · `pnpm exec biome check .` ·
  `node scripts/check-mobile-tokens-only.mjs`.

---

## Task 1: `return-to.ts` — hộp nhớ path/replay

**Files:**
- Create: `apps/mobile/src/features/auth/return-to.ts`
- Test: `apps/mobile/src/features/auth/return-to.spec.ts`

**Interfaces:**
- Consumes: không gì (module thuần, không phụ thuộc file khác).
- Produces: `setPendingReturn(next: PendingReturn): void`,
  `consumeReturnPath(): string | null`,
  `consumePendingReplay(): PendingReturn['replay']`,
  `type PendingReturn = { path: string; replay?: { kind: 'wishlist'; tourId: string } }`
  — Task 3 dùng `setPendingReturn`+`consumeReturnPath`, Task 4 dùng cả ba.

- [ ] **Step 1: Viết test trước (TDD)**

```typescript
// apps/mobile/src/features/auth/return-to.spec.ts
import { consumePendingReplay, consumeReturnPath, setPendingReturn } from './return-to';

describe('return-to', () => {
  it('chưa set gì: consumeReturnPath trả null, consumePendingReplay trả undefined', () => {
    expect(consumeReturnPath()).toBeNull();
    expect(consumePendingReplay()).toBeUndefined();
  });

  it('set rồi consumeReturnPath: trả đúng path, KHÔNG xoá replay', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    expect(consumeReturnPath()).toBe('/tours/hoi-an');
    // replay còn nguyên sau khi đọc path — hai hàm đọc độc lập.
    expect(consumePendingReplay()).toEqual({ kind: 'wishlist', tourId: 't1' });
  });

  it('consumePendingReplay xoá hẳn — gọi lần hai trả undefined', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    consumePendingReplay();
    expect(consumePendingReplay()).toBeUndefined();
    expect(consumeReturnPath()).toBeNull();
  });

  it('set không có replay: consumePendingReplay trả undefined', () => {
    setPendingReturn({ path: '/(tabs)/saved' });
    expect(consumeReturnPath()).toBe('/(tabs)/saved');
    expect(consumePendingReplay()).toBeUndefined();
  });

  it('set lần hai ĐÈ lần một (chưa consume gì)', () => {
    setPendingReturn({ path: '/(tabs)/saved' });
    setPendingReturn({ path: '/(tabs)/account' });
    expect(consumeReturnPath()).toBe('/(tabs)/account');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL vì module chưa tồn tại**

Run: `cd apps/mobile && npx jest return-to.spec.ts`
Expected: FAIL — `Cannot find module './return-to'`.

- [ ] **Step 3: Viết `return-to.ts`**

```typescript
// apps/mobile/src/features/auth/return-to.ts

/**
 * Hộp nhớ MỘT đường quay lại sau khi có phiên (D6, mục 1b spec P5b-4) —
 * module-scope, KHÔNG persist qua app kill (đúng ý: mất phiên giữa chừng thì
 * thôi, không cố khôi phục qua nhiều lần mở app).
 */
export interface PendingReturn {
  /** Đường expo-router điều hướng TỚI sau khi có phiên, vd '/(tabs)/saved'. */
  path: string;
  /** Việc dở màn đích tự làm nốt (D6: tự lưu wishlist). Chuỗi định danh + payload
      thay vì closure — closure sống sót qua unmount/remount của chuỗi màn auth là
      giả định không chắc chắn. */
  replay?: { kind: 'wishlist'; tourId: string };
}

let pending: PendingReturn | null = null;

/** Gọi lúc bấm "Sign in"/"Create account" từ một chỗ bị chặn (AuthGateScreen/AuthGateSheet). */
export function setPendingReturn(next: PendingReturn): void {
  pending = next;
}

/** Gọi Ở CHẶNG AUTH khi thành công — chỉ lấy path, KHÔNG xoá `replay` (màn đích
    còn cần đọc nó sau khi điều hướng tới). */
export function consumeReturnPath(): string | null {
  return pending?.path ?? null;
}

/** Gọi Ở MÀN ĐÍCH (effect mount-once, sau khi `signedIn` vừa bật) — lấy VÀ xoá
    hẳn `pending`. Đây mới là điểm thật sự dọn hộp nhớ về rỗng. */
export function consumePendingReplay(): PendingReturn['replay'] {
  const replay = pending?.replay;
  pending = null;
  return replay;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `cd apps/mobile && npx jest return-to.spec.ts`
Expected: PASS — 5/5 test xanh.

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS, không lỗi ở `return-to.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/auth/return-to.ts apps/mobile/src/features/auth/return-to.spec.ts
git commit -m "feat(mobile): hộp nhớ return-to sau đăng nhập (P5b-4 mục 1b)"
```

---

## Task 2: `AuthGateScreen` — khối chặn tab full-screen

**Files:**
- Create: `apps/mobile/src/features/auth/auth-gate-screen.tsx`
- Test: `apps/mobile/src/features/auth/auth-gate-screen.spec.tsx`

**Interfaces:**
- Consumes: `Screen`, `EmptyState`, `Button`, `AppText`, `useTheme`, `type FeatherIconName`
  từ `@tourism/mobile-ui` (barrel, đã có sẵn).
- Produces: `export function AuthGateScreen(props: AuthGateScreenProps)`,
  `export interface AuthGateScreenProps { icon, title, body, signInLabel,
  createAccountLabel, onSignIn, onCreateAccount, legalLinks? }` — dùng trực tiếp bởi
  `saved.tsx`/`account.tsx` khi wire thẳng theo spec (ngoài phạm vi plan này).

- [ ] **Step 1: Viết test trước (TDD, RNTL)**

```typescript
// apps/mobile/src/features/auth/auth-gate-screen.spec.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { AuthGateScreen, type AuthGateScreenProps } from './auth-gate-screen';

function baseProps(overrides: Partial<AuthGateScreenProps> = {}): AuthGateScreenProps {
  return {
    icon: 'heart',
    title: 'Save tours you love',
    body: 'Sign in to keep a wishlist of tours and find them here anytime.',
    signInLabel: 'Sign in',
    createAccountLabel: 'Create account',
    onSignIn: jest.fn(),
    onCreateAccount: jest.fn(),
    ...overrides,
  };
}

describe('AuthGateScreen', () => {
  it('vẽ tiêu đề + câu giải thích', async () => {
    await renderWithTheme(<AuthGateScreen {...baseProps()} />);
    expect(screen.getByText('Save tours you love')).toBeTruthy();
    expect(
      screen.getByText('Sign in to keep a wishlist of tours and find them here anytime.'),
    ).toBeTruthy();
  });

  it('bấm Sign in/Create account gọi đúng callback', async () => {
    const onSignIn = jest.fn();
    const onCreateAccount = jest.fn();
    await renderWithTheme(
      <AuthGateScreen {...baseProps({ onSignIn, onCreateAccount })} />,
    );
    await fireEvent.press(screen.getByText('Sign in'));
    expect(onSignIn).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Create account'));
    expect(onCreateAccount).toHaveBeenCalled();
  });

  it('không có legalLinks: không vẽ khối link pháp lý nào', async () => {
    await renderWithTheme(<AuthGateScreen {...baseProps()} />);
    expect(screen.queryByText('Privacy policy')).toBeNull();
  });

  it('có legalLinks: vẽ từng dòng, bấm gọi đúng onPress của dòng đó', async () => {
    const onPrivacy = jest.fn();
    await renderWithTheme(
      <AuthGateScreen
        {...baseProps({
          legalLinks: [
            { label: 'Privacy policy', icon: 'file-text', onPress: onPrivacy },
            { label: 'Terms of service', icon: 'file-text', onPress: jest.fn() },
          ],
        })}
      />,
    );
    expect(screen.getByText('Terms of service')).toBeTruthy();
    await fireEvent.press(screen.getByText('Privacy policy'));
    expect(onPrivacy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `cd apps/mobile && npx jest auth-gate-screen.spec.tsx`
Expected: FAIL — `Cannot find module './auth-gate-screen'`.

- [ ] **Step 3: Viết `auth-gate-screen.tsx`**

```typescript
// apps/mobile/src/features/auth/auth-gate-screen.tsx
import Feather from '@expo/vector-icons/Feather';
import {
  AppText,
  Button,
  EmptyState,
  type FeatherIconName,
  Screen,
  SCREEN_EDGES_UNDER_TABS,
  useTheme,
} from '@tourism/mobile-ui';
import { Pressable, View } from 'react-native';

export interface AuthGateScreenLegalLink {
  label: string;
  icon: FeatherIconName;
  onPress: () => void;
}

export interface AuthGateScreenProps {
  icon: FeatherIconName;
  title: string;
  body: string;
  signInLabel: string;
  createAccountLabel: string;
  onSignIn: () => void;
  onCreateAccount: () => void;
  /** A2 riêng: ba dòng pháp lý vẫn mở được dù chưa đăng nhập. Bỏ trống = không có khối này (S3). */
  legalLinks?: readonly AuthGateScreenLegalLink[];
}

/**
 * Khối chặn tab dùng chung cho Saved (S3) và Account (A2) — mockup P5b-4 mục
 * "Một khuôn chặn tab cho cả ba" (Trips chờ cụm P5b-3, chưa nối ở đây). KHÁC
 * `AuthGateSheet` (D6): đây thay TOÀN BỘ nội dung tab, không phải sheet nổi
 * lên trong lúc khách đang xem màn khác.
 */
export function AuthGateScreen({
  icon,
  title,
  body,
  signInLabel,
  createAccountLabel,
  onSignIn,
  onCreateAccount,
  legalLinks,
}: AuthGateScreenProps) {
  const theme = useTheme();

  return (
    // `SCREEN_EDGES_UNDER_TABS` (chỉ 'top'): cả hai chỗ dùng component này đều
    // nằm DƯỚI tab bar (Saved/Account) — dùng edges mặc định ['top','bottom']
    // sẽ đệm đáy hai lần (safe-area + khoảng tab bar đã chừa).
    <Screen edges={SCREEN_EDGES_UNDER_TABS}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
        <EmptyState
          icon={
            <View
              style={{
                width: theme.spacing(16),
                height: theme.spacing(16),
                borderRadius: theme.radius.base * 2,
                backgroundColor: theme.colors.secondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name={icon} size={28} color={theme.colors['primary-emphasis']} />
            </View>
          }
          title={title}
          body={body}
          surface={false}
        >
          <View style={{ gap: theme.spacing(3), alignSelf: 'stretch', marginTop: theme.spacing(3) }}>
            <Button shape="pill" label={signInLabel} onPress={onSignIn} />
            <Button shape="pill" variant="ghost" label={createAccountLabel} onPress={onCreateAccount} />
          </View>
        </EmptyState>
      </View>
      {legalLinks === undefined || legalLinks.length === 0 ? null : (
        <View style={{ paddingHorizontal: theme.spacing(6), paddingBottom: theme.spacing(6) }}>
          {legalLinks.map((link) => (
            <Pressable
              key={link.label}
              accessibilityRole="button"
              onPress={link.onPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(3),
                minHeight: 52,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Feather name={link.icon} size={20} color={theme.colors.foreground} />
              <AppText variant="label" style={{ flex: 1 }}>
                {link.label}
              </AppText>
              <Feather name="external-link" size={16} color={theme.colors['muted-foreground']} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `cd apps/mobile && npx jest auth-gate-screen.spec.tsx`
Expected: PASS — 4/4 test xanh.

- [ ] **Step 5: Typecheck + tokens-only**

Run: `cd apps/mobile && npx tsc --noEmit && cd ../.. && node scripts/check-mobile-tokens-only.mjs`
Expected: cả hai PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/auth/auth-gate-screen.tsx apps/mobile/src/features/auth/auth-gate-screen.spec.tsx
git commit -m "feat(mobile): AuthGateScreen — khối chặn tab dùng chung Saved/Account (P5b-4 V1)"
```

---

## Task 3: Nối `return-to` vào chuỗi đăng nhập/đăng ký

**Files:**
- Modify: `apps/mobile/src/app/(auth)/login.tsx:45,64`
- Modify: `apps/mobile/src/app/(auth)/register.tsx:58`

**Interfaces:**
- Consumes: `consumeReturnPath` từ `apps/mobile/src/features/auth/return-to.ts` (Task 1).
- Produces: không gì mới cho task khác — đây là điểm TIÊU THỤ cuối của `path`.

**Xác nhận phạm vi (đã soát toàn bộ chuỗi auth):** CHỈ ba điểm này thật sự tạo phiên.
`verify-email.tsx` → `/success` → `/login` KHÔNG bao giờ tự tạo phiên (comment sẵn trong
`success.tsx`: "verify KHÔNG tự đăng nhập, ADR-0017 §7c") — khách luôn phải qua lại
`login.tsx` để đăng nhập thật, lúc đó rơi đúng vào 1 trong 3 điểm dưới đây. KHÔNG cần sửa
`verify-email.tsx`/`success.tsx`/`register.tsx`'s email-path (không có nhánh `success`).

Không có bước TDD: đây là đổi 1 dòng logic điều hướng, không có nhánh mới để test đơn vị
— xác nhận bằng đọc lại diff + typecheck, cùng tiền lệ `client.ts` T0 (đổi wiring, không
unit test riêng).

- [ ] **Step 1: Sửa `login.tsx` — 2 điểm**

```typescript
// apps/mobile/src/app/(auth)/login.tsx
// Thêm vào khối import:
import { consumeReturnPath } from '@/features/auth/return-to';
```

Dòng 45 (`submit`, nhánh email) đổi từ:

```typescript
    if (outcome.kind === 'success') router.replace('/');
```

thành:

```typescript
    if (outcome.kind === 'success') router.replace(consumeReturnPath() ?? '/');
```

Dòng 64 (`google`) đổi TƯƠNG TỰ:

```typescript
    if (outcome.kind === 'success') router.replace(consumeReturnPath() ?? '/');
```

- [ ] **Step 2: Sửa `register.tsx` — 1 điểm**

```typescript
// apps/mobile/src/app/(auth)/register.tsx
// Thêm vào khối import:
import { consumeReturnPath } from '@/features/auth/return-to';
```

Dòng 58 (`google`) đổi từ:

```typescript
    if (outcome.kind === 'success') router.replace('/');
```

thành:

```typescript
    if (outcome.kind === 'success') router.replace(consumeReturnPath() ?? '/');
```

- [ ] **Step 3: Chạy lại test toàn bộ mobile, xác nhận không vỡ gì**

`login.tsx`/`register.tsx` là ROUTE (giữ state + gọi router), không có file test riêng
theo tiền lệ đã thiết lập (`apps/mobile/src/app/(auth)/` không có `*.spec.*` nào — chỉ
`sign-in-screen.spec.tsx`/`register-screen.spec.tsx`, test COMPONENT thuần, không đụng
`router`). Đổi ở Task này không phá test nào có sẵn.

Run: `cd apps/mobile && npx jest`
Expected: PASS toàn bộ (baseline trước Task này: 55 suite / 345 test — 344 cũ + 5 mới
của Task 1, chưa cộng 4 của Task 2 vì test đó chạy ở Step 4 Task 2 rồi).

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/\(auth\)/login.tsx apps/mobile/src/app/\(auth\)/register.tsx
git commit -m "feat(mobile): đăng nhập/đăng ký xong quay lại đúng chỗ đã bấm Sign in (P5b-4 mục 1b)"
```

---

## Task 4: Đóng nợ D6 — tim tự lưu lại sau khi đăng nhập từ tour detail

**Files:**
- Modify: `apps/mobile/src/app/tours/[slug].tsx:146-164` (`handleFavoritePress`, đọc thêm),
  `:363-370` (`onSignIn`/`onCreateAccount` của `AuthGateSheet`), thêm 1 `useEffect` mới.

**Interfaces:**
- Consumes: `setPendingReturn`, `consumePendingReplay` từ `return-to.ts` (Task 1).
- Produces: không gì cho task khác — đây là điểm TIÊU THỤ `replay`.

Không có bước TDD: `[slug].tsx` là route (giữ state + gọi API), không có file test riêng
theo tiền lệ đã thiết lập cho route này (D3/D4 cũng không có route-level test, chỉ
`tour-detail-screen.spec.tsx` — component thuần — có test). Xác nhận bằng đọc diff +
typecheck + kiểm tay trên máy thật (bước cuối plan).

- [ ] **Step 1: Đổi `onSignIn`/`onCreateAccount` của `AuthGateSheet` — set path + replay**

Trong `apps/mobile/src/app/tours/[slug].tsx`, thêm vào khối import:

```typescript
import { consumePendingReplay, setPendingReturn } from '@/features/auth/return-to';
```

Đổi khối (hiện ở dòng ~359–370):

```typescript
      // "Sign in"/"Create account" chưa giữ ý định "quay lại tour này + tự lưu"
      // sau khi đăng nhập xong (nợ — chưa có hạ tầng return-to chung cho cụm
      // auth, xem doc comment `TourDetailScreen`). Đóng tấm mời trước khi điều
      // hướng — quay lại tour vẫn thấy đúng trạng thái, chỉ là tim chưa tự lưu.
      onSignIn={() => {
        setAuthGateOpen(false);
        router.navigate('/login');
      }}
      onCreateAccount={() => {
        setAuthGateOpen(false);
        router.navigate('/register');
      }}
```

thành:

```typescript
      // Ghi lại "quay về tour này + tự lưu tim" TRƯỚC khi rời màn — đóng nợ D6 cũ
      // (mục 1c spec P5b-4). `tourId` có thể chưa sẵn sàng (tour đang tải lúc
      // khách bấm tim rất nhanh) — không set `replay` thì đăng nhập xong đơn
      // giản KHÔNG tự lưu, không phải lỗi, chỉ là không có gì để replay.
      onSignIn={() => {
        setAuthGateOpen(false);
        setPendingReturn(
          tourId === undefined
            ? { path: `/tours/${slug}` }
            : { path: `/tours/${slug}`, replay: { kind: 'wishlist', tourId } },
        );
        router.navigate('/login');
      }}
      onCreateAccount={() => {
        setAuthGateOpen(false);
        setPendingReturn(
          tourId === undefined
            ? { path: `/tours/${slug}` }
            : { path: `/tours/${slug}`, replay: { kind: 'wishlist', tourId } },
        );
        router.navigate('/register');
      }}
```

- [ ] **Step 2: Thêm effect đọc `replay` khi vừa có phiên**

Thêm ngay SAU effect hiện có "Đăng xuất giữa chừng (hoặc đổi tour)..." (khớp
`if (!signedIn) setWished(false); }, [signedIn]);`):

```typescript
  // D6 — quay lại từ chặng đăng nhập (mục 1c spec P5b-4): tự lưu tim nếu khách
  // đã bấm tim TRƯỚC khi bị chặn. `consumePendingReplay` chỉ trả giá trị khi có
  // gì đó thật sự đang chờ — lượt ghé màn bình thường (không qua auth gate) luôn
  // trả `undefined`, effect no-op.
  useEffect(() => {
    if (!signedIn || tourId === undefined) return;
    const replay = consumePendingReplay();
    if (replay?.kind !== 'wishlist' || replay.tourId !== tourId) return;
    setWished(true);
    setWishlistMutation.mutate(
      { tourId, wished: true },
      {
        onError: () => {
          setWished(false);
          setWishlistError(messages.wishlist.error);
        },
      },
    );
  }, [signedIn, tourId]);
```

- [ ] **Step 3: Xoá doc comment lỗi thời ở `tour-detail-screen.tsx`**

File `apps/mobile/src/features/tour-detail/tour-detail-screen.tsx` có đoạn doc comment
(trong JSDoc của `TourDetailScreen`, gần "Bấm tim (D1/D2 header gọn)..."):

```
* account" của D6 điều hướng sang `/login`/`/register` — CHƯA giữ được ý định
* "quay lại đúng tour + tự lưu" sau khi đăng nhập xong (nợ, chưa có hạ tầng
* return-to chung cho cụm auth).
```

Đổi thành:

```
* account" của D6 điều hướng sang `/login`/`/register`, route tự ghi lại ý định
* "quay lại đúng tour + tự lưu" qua `setPendingReturn` (P5b-4 mục 1c) trước khi
* điều hướng — đăng nhập xong quay đúng tour, tim tự lưu nếu khách đã bấm.
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Chạy toàn bộ test mobile — xác nhận không vỡ gì**

Run: `cd apps/mobile && npx jest`
Expected: PASS toàn bộ (baseline trước plan này: 55 suite / 344 test xanh — xem
`docs/plans/2026-09-25-mobile-account-screens.md`).

- [ ] **Step 6: Kiểm tay trên máy thật (không tự động hoá được)**

1. Mở tour bất kỳ, chưa đăng nhập, bấm tim → tấm mời D6 hiện ra.
2. Bấm "Sign in" → màn Sign in mở.
3. Đăng nhập thành công → PHẢI quay lại ĐÚNG tour vừa xem (không phải Home).
4. Tim PHẢI đã đặc (đã lưu) mà không cần bấm lại.
5. Lặp lại bước 1–4 với "Create account" (qua verify-email OTP) → sau khi verify
   xong quay lại `/login`, đăng nhập lần đầu bằng tài khoản vừa tạo → cũng phải quay
   đúng tour + tự lưu (vì `pending` vẫn còn trong bộ nhớ suốt chuỗi register→verify→login).

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/src/app/tours/[slug].tsx" apps/mobile/src/features/tour-detail/tour-detail-screen.tsx
git commit -m "fix(mobile): đóng nợ D6 — tim tự lưu lại sau khi đăng nhập từ tour detail (P5b-4 mục 1c)"
```

---

## Self-Review Notes

- **Spec coverage:** mục 1a (AuthGateScreen) → Task 2. Mục 1b (return-to) → Task 1 + 3.
  Mục 1c (đóng nợ D6) → Task 4. Đủ.
- **Không có placeholder:** mọi step có code thật, không có "TODO"/"tương tự Task N".
- **Type consistency:** `PendingReturn`/`setPendingReturn`/`consumeReturnPath`/
  `consumePendingReplay` dùng ĐÚNG tên xuyên suốt Task 1/3/4 — đã soát lại.
- **Chưa làm ở plan này (đúng phạm vi đã thống nhất):** wire `AuthGateScreen` vào
  `saved.tsx`/`account.tsx` thật — đó là việc của phần "làm thẳng theo spec" (Saved/
  Account hub), không phải plan này.
