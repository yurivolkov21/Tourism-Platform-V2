import * as SecureStore from 'expo-secure-store';

/**
 * Tập `id` thông báo đã đọc, lưu theo từng tài khoản trong `expo-secure-store` (chỉ ở máy — spec
 * 2026-10-25). Khoá SecureStore chỉ nhận chữ, số và `. - _`, nên nối `userId` bằng dấu chấm.
 */
const KEY_PREFIX = 'nexora-notifications-read-v1';
/** Giữ tối đa chừng này id mới nhất: thông báo cũ rơi khỏi danh sách thì id của nó không cần nhớ mãi. */
const MAX_KEPT = 300;

const keyFor = (userId: string) => `${KEY_PREFIX}.${userId}`;

/** Đọc tệp lưu thành tập id. Thiếu/hỏng/sai dạng thì trả tập rỗng — không bao giờ ném. */
export function parseReadIds(raw: string | null): Set<string> {
  if (raw === null || raw === '') return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

/** Ghi tập id thành chuỗi JSON, chỉ giữ `MAX_KEPT` id thêm vào sau cùng (Set giữ thứ tự thêm). */
export function serializeReadIds(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].slice(-MAX_KEPT));
}

/** Đọc từ kho bền; lỗi Keychain/keystore thì coi như chưa đọc cái nào (cùng tinh thần `readHasSeen`). */
export async function loadReadIds(userId: string): Promise<Set<string>> {
  try {
    return parseReadIds(await SecureStore.getItemAsync(keyFor(userId)));
  } catch {
    return new Set();
  }
}

/** Ghi xuống kho bền; lỗi thì chỉ mất trạng thái "đã đọc", không ném lên màn. */
export async function saveReadIds(userId: string, ids: ReadonlySet<string>): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyFor(userId), serializeReadIds(ids));
  } catch {
    // Chấp nhận: lần mở sau các thông báo đó hiện lại như chưa đọc.
  }
}
