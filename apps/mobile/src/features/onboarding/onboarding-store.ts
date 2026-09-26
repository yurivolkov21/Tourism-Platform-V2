import * as SecureStore from 'expo-secure-store';
import { createContext, useContext } from 'react';

export interface OnboardingStore {
  /** Đã xem ba trang giới thiệu lần nào chưa. */
  hasSeen(): Promise<boolean>;
  /** Đánh dấu đã xem — gọi khi bấm Skip, Get started hoặc đường sang đăng nhập. */
  markSeen(): Promise<void>;
}

/**
 * Bản GIẢ LẬP cho đợt dựng giao diện tĩnh (P5b-1): nhớ trong RAM, nên mỗi lần mở
 * lạnh app lại thấy onboarding một lần. Không còn dùng trong `_layout.tsx` (xem
 * `createSecureStoreOnboardingStore` bên dưới, nối 26/09) — giữ lại vì
 * `onboarding-store.spec.ts` test thẳng interface qua nó, cùng nếp
 * `createMockAuthActions` (vẫn sống trong `test-utils.tsx` sau khi
 * `createBetterAuthActions` thay ở `_layout.tsx`).
 */
export function createMemoryOnboardingStore(): OnboardingStore {
  let seen = false;

  return {
    hasSeen: () => Promise.resolve(seen),
    markSeen: () => {
      seen = true;
      return Promise.resolve();
    },
  };
}

/** Khoá lưu trong `expo-secure-store` — không phải secret, nhưng cùng chỗ chứa
    session của `auth-client.ts` nên đặt tiền tố cho khỏi đụng key khác. */
const SEEN_KEY = 'nexora-onboarding-seen';

/**
 * Bản THẬT (nối 26/09, thay `createMemoryOnboardingStore` theo đúng chỉ dẫn
 * của nó): "đã xem" ghi xuống `expo-secure-store` nên sống qua lần mở lạnh —
 * KHÔNG liên quan phiên đăng nhập (đăng xuất/đăng nhập lại không làm hiện lại
 * onboarding, đây là cờ cấp THIẾT BỊ chứ không phải cấp tài khoản).
 */
export function createSecureStoreOnboardingStore(): OnboardingStore {
  return {
    hasSeen: async () => (await SecureStore.getItemAsync(SEEN_KEY)) === 'true',
    markSeen: async () => {
      await SecureStore.setItemAsync(SEEN_KEY, 'true');
    },
  };
}

/**
 * Bản mà app thật dùng, dựng MỘT lần ở module scope. Để ở đây (không phải trong
 * `_layout.tsx`) vì test cây route cũng cần chạm tới nó: mặc định là "chưa xem",
 * mà phần lớn test lại mô phỏng người đã xem — `jest.setup.js` mock sẵn
 * `expo-secure-store` bằng một `Map` trong bộ nhớ nên hành vi test không đổi.
 */
export const onboardingStore = createSecureStoreOnboardingStore();

const OnboardingStoreContext = createContext<OnboardingStore | null>(null);

export const OnboardingStoreProvider = OnboardingStoreContext.Provider;

/** Ném lỗi rõ nghĩa thay vì trả `undefined` — cùng nếp `useAuthActions`. */
export function useOnboardingStore(): OnboardingStore {
  const store = useContext(OnboardingStoreContext);

  if (store === null) {
    throw new Error('useOnboardingStore phải nằm trong <OnboardingStoreProvider>');
  }

  return store;
}
