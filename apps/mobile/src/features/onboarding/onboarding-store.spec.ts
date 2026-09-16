import { createMemoryOnboardingStore } from './onboarding-store';

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
