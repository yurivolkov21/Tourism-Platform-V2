import { createMemoryOnboardingStore, createSecureStoreOnboardingStore } from './onboarding-store';

describe('createMemoryOnboardingStore', () => {
  it('lần đầu chưa xem, đánh dấu xong thì nhớ', async () => {
    const store = createMemoryOnboardingStore();

    await expect(store.hasSeen()).resolves.toBe(false);
    await store.markSeen();
    await expect(store.hasSeen()).resolves.toBe(true);
  });

  it('mỗi bản là một trí nhớ riêng — mở lạnh app là thấy lại onboarding', async () => {
    const first = createMemoryOnboardingStore();
    await first.markSeen();

    await expect(createMemoryOnboardingStore().hasSeen()).resolves.toBe(false);
  });
});

describe('createSecureStoreOnboardingStore', () => {
  it('lần đầu chưa xem, đánh dấu xong thì nhớ', async () => {
    const store = createSecureStoreOnboardingStore();

    await expect(store.hasSeen()).resolves.toBe(false);
    await store.markSeen();
    await expect(store.hasSeen()).resolves.toBe(true);
  });

  it('sống qua "mở lạnh" — bản dựng MỚI vẫn đọc lại được cờ đã ghi (khác bản RAM)', async () => {
    const first = createSecureStoreOnboardingStore();
    await first.markSeen();

    // `expo-secure-store` ghi xuống đĩa thật; jest.setup.js mock bằng Map
    // NGOÀI closure của hàm tạo, nên một instance MỚI vẫn đọc thấy — đúng
    // hành vi cần: sống qua lần mở lạnh app, không như bản RAM.
    await expect(createSecureStoreOnboardingStore().hasSeen()).resolves.toBe(true);
  });
});
