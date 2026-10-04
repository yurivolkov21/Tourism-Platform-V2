import * as SecureStore from 'expo-secure-store';

/**
 * Ô tích "Packing checklist" (P2) — ghi chú RIÊNG của máy, không phải dữ
 * liệu đơn hàng (handoff mục 6: API không có và không nên có chỗ chứa).
 * `expo-secure-store` chứ không phải `AsyncStorage` của bản vẽ gốc — repo
 * chưa cài package đó (chỉ `expo-secure-store`, đã dùng cho onboarding/
 * session); thêm dependency mới cần ADR riêng (ADR-0040 §AMEND 1), còn ý
 * nghĩa ("lưu cấp máy, theo mã booking") thì `expo-secure-store` đáp ứng y
 * hệt — cùng khuôn `onboarding-store.ts`.
 */
export interface PackingListStore {
  getChecked(bookingCode: string): Promise<string[]>;
  setChecked(bookingCode: string, checked: readonly string[]): Promise<void>;
}

function storageKey(bookingCode: string): string {
  return `nexora-packing-${bookingCode}`;
}

/** Bật/tắt một dòng trong danh sách đã tích — dòng nhận diện bằng CHÍNH chữ
 *  của nó (không có id riêng, danh sách ngắn và tĩnh trong một phiên xem). */
export function toggleChecked(checked: readonly string[], item: string): string[] {
  return checked.includes(item) ? checked.filter((i) => i !== item) : [...checked, item];
}

export function createSecureStorePackingListStore(): PackingListStore {
  return {
    getChecked: async (bookingCode) => {
      const raw = await SecureStore.getItemAsync(storageKey(bookingCode));
      if (raw === null) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
          ? parsed.filter((v): v is string => typeof v === 'string')
          : [];
      } catch {
        return [];
      }
    },
    setChecked: async (bookingCode, checked) => {
      await SecureStore.setItemAsync(storageKey(bookingCode), JSON.stringify(checked));
    },
  };
}

export const packingListStore = createSecureStorePackingListStore();
