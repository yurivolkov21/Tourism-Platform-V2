import { KeyedThrottlerStorage } from './keyed-throttler-storage.js';

/**
 * ADR-0037 AMEND 1: storage keyed theo từng key. Ca tái hiện đúng bug của
 * `ThrottlerStorageService` 6.5.0: một key hết block không được đụng tới
 * bộ đếm của key khác.
 */
describe('KeyedThrottlerStorage', () => {
  it('đếm và block theo TỪNG key; hết block ở key này không đóng băng key kia', async () => {
    const storage = new KeyedThrottlerStorage();
    const ttl = 60_000;
    const limit = 2;
    const block = 60_000;

    // Key A vượt trần → block.
    await storage.increment('A', ttl, limit, block, 'default');
    await storage.increment('A', ttl, limit, block, 'default');
    const overA = await storage.increment('A', ttl, limit, block, 'default');
    expect(overA.isBlocked).toBe(true);
    expect(overA.timeToBlockExpire).toBeGreaterThan(0);

    // Key B độc lập: 2 hit đầu qua, hit thứ 3 mới block.
    expect((await storage.increment('B', ttl, limit, block, 'default')).isBlocked).toBe(false);
    expect((await storage.increment('B', ttl, limit, block, 'default')).isBlocked).toBe(false);
    expect((await storage.increment('B', ttl, limit, block, 'default')).isBlocked).toBe(true);
  });

  it('hit rời cửa sổ ttl thì không còn được đếm (không cần timer)', async () => {
    const storage = new KeyedThrottlerStorage();
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now');
    try {
      spy.mockReturnValue(now);
      await storage.increment('K', 1_000, 5, 1_000, 'default');
      await storage.increment('K', 1_000, 5, 1_000, 'default');
      expect((await storage.increment('K', 1_000, 5, 1_000, 'default')).totalHits).toBe(3);
      // 1,5s sau: mọi hit cũ rời cửa sổ 1s → đếm lại từ 1.
      spy.mockReturnValue(now + 1_500);
      expect((await storage.increment('K', 1_000, 5, 1_000, 'default')).totalHits).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('đang block thì không cộng thêm hit, và hết block thì tự mở', async () => {
    const storage = new KeyedThrottlerStorage();
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now');
    try {
      spy.mockReturnValue(now);
      await storage.increment('L', 60_000, 1, 2_000, 'default');
      const blocked = await storage.increment('L', 60_000, 1, 2_000, 'default');
      expect(blocked.isBlocked).toBe(true);
      const still = await storage.increment('L', 60_000, 1, 2_000, 'default');
      expect(still.isBlocked).toBe(true);
      expect(still.totalHits).toBe(2); // không tăng khi đang block
      spy.mockReturnValue(now + 2_500);
      // Hết block, nhưng 2 hit vẫn trong cửa sổ 60s → hit mới lại vượt trần.
      expect((await storage.increment('L', 60_000, 1, 2_000, 'default')).isBlocked).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
