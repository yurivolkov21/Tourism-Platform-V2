import { createContext, useContext } from 'react';

export interface OnboardingStore {
  /** Đã xem ba trang giới thiệu lần nào chưa. */
  hasSeen(): Promise<boolean>;
  /** Đánh dấu đã xem — gọi khi bấm Skip, Get started hoặc đường sang đăng nhập. */
  markSeen(): Promise<void>;
}

/**
 * Bản GIẢ LẬP cho đợt dựng giao diện tĩnh (P5b-1): nhớ trong RAM, nên mỗi lần mở
 * lạnh app lại thấy onboarding một lần — tiện cho vòng review trên máy thật.
 *
 * Người làm hạ tầng thay bằng `expo-secure-store` hoặc AsyncStorage và GIỮ NGUYÊN
 * interface; đổi đúng một dòng dựng store ở `src/app/_layout.tsx`, không màn nào
 * phải sửa. Hình dạng bất đồng bộ giữ từ bây giờ chính là để lần thay đó không
 * phải sửa gì khác: bản thật đọc từ ổ đĩa.
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

/**
 * Bản mà app thật dùng, dựng MỘT lần ở module scope. Để ở đây (không phải trong
 * `_layout.tsx`) vì test cây route cũng cần chạm tới nó: mặc định của bản giả
 * lập là "chưa xem", mà phần lớn test lại mô phỏng người đã xem.
 */
export const onboardingStore = createMemoryOnboardingStore();

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
