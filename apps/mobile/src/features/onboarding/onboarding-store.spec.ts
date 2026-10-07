import {
  createMemoryOnboardingStore,
  createSecureStoreOnboardingStore,
  readHasSeen,
} from './onboarding-store';

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

// F9 (review 06/10): SecureStore có thể ném (Keychain khoá, máy Android hỏng
// keystore). Đọc cờ hỏng mà không bắt thì splash không bao giờ gỡ.
describe('readHasSeen', () => {
  it('đọc được thì trả đúng giá trị của store', async () => {
    const store = createMemoryOnboardingStore();

    await expect(readHasSeen(store)).resolves.toBe(false);
    await store.markSeen();
    await expect(readHasSeen(store)).resolves.toBe(true);
  });

  it('store ném lỗi thì coi như đã xem — cho vào app thay vì kẹt ở splash', async () => {
    const broken = {
      hasSeen: () => Promise.reject(new Error('keystore unavailable')),
      markSeen: () => Promise.resolve(),
    };

    await expect(readHasSeen(broken)).resolves.toBe(true);
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
