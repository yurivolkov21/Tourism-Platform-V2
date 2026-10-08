import { createCachedStorage, type SyncReadStorage } from './cached-storage';

function fakeBacking(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const backing = {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  } satisfies SyncReadStorage;
  return backing;
}

describe('createCachedStorage (L1)', () => {
  it('đọc lặp cùng key: chỉ chạm kho bền MỘT lần', () => {
    const backing = fakeBacking({ cookie: '{"a":1}' });
    const storage = createCachedStorage(backing);

    expect(storage.getItem('cookie')).toBe('{"a":1}');
    expect(storage.getItem('cookie')).toBe('{"a":1}');
    expect(backing.getItem).toHaveBeenCalledTimes(1);
  });

  it('key chưa có: cache cả giá trị null, không đọc lại', () => {
    const backing = fakeBacking();
    const storage = createCachedStorage(backing);

    expect(storage.getItem('missing')).toBeNull();
    expect(storage.getItem('missing')).toBeNull();
    expect(backing.getItem).toHaveBeenCalledTimes(1);
  });

  it('ghi: lần đọc sau thấy NGAY giá trị mới và kho bền cũng được ghi', () => {
    const backing = fakeBacking({ cookie: 'old' });
    const storage = createCachedStorage(backing);
    storage.getItem('cookie');

    storage.setItem('cookie', 'new');

    expect(storage.getItem('cookie')).toBe('new');
    expect(backing.setItem).toHaveBeenCalledWith('cookie', 'new');
  });

  it('trả nguyên kết quả setItem của kho bền (Promise để thư viện await)', async () => {
    const backing = {
      getItem: () => null,
      setItem: jest.fn(async () => undefined),
    };
    const storage = createCachedStorage(backing);

    await expect(storage.setItem('k', 'v')).resolves.toBeUndefined();
  });
});
