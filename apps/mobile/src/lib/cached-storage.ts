/** Kho key-value ĐỒNG BỘ khi đọc — đúng chữ ký `storage` mà `expoClient` nhận. */
export interface SyncReadStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => unknown;
}

/**
 * Bọc kho bền (SecureStore) bằng cache bộ nhớ GHI-XUYÊN (L1): đọc lần đầu một
 * key mới chạm kho bền, các lần sau trả từ bộ nhớ; ghi thì cập nhật bộ nhớ
 * TRƯỚC rồi mới ghi xuống kho bền.
 *
 * Vì sao an toàn, không lệch cookie: `@better-auth/expo` chỉ dùng
 * `getItem`/`setItem` (đăng xuất cũng là `setItem(key, "{}")`), và mọi lần ghi
 * cookie phiên đều đi qua CHÍNH adapter này — không ai khác ghi vào key đó
 * trong lúc app chạy. Lợi ích: `getCookie()` (`withMobileAuth`) lẫn hook
 * `onRequest` của thư viện không còn đọc Keychain/EncryptedSharedPreferences
 * blocking trên luồng JS ở MỌI request.
 */
export function createCachedStorage(backing: SyncReadStorage): SyncReadStorage {
  const memory = new Map<string, string | null>();
  return {
    getItem: (key) => {
      if (memory.has(key)) return memory.get(key) ?? null;
      const value = backing.getItem(key);
      memory.set(key, value);
      return value;
    },
    setItem: (key, value) => {
      memory.set(key, value);
      return backing.setItem(key, value);
    },
  };
}
