import type { MockRegionKey } from '@/mocks/types';

/** Biến thể khu Signature. Tên theo CẤU TRÚC nó dựng, không theo tên vùng —
    `stats`/`timeline`/`postcards` đọc là biết render gì. */
export type SignatureVariant = 'stats' | 'timeline' | 'postcards';

export interface RegionTheme {
  signature: SignatureVariant;
  /** Bắc để Signature TRƯỚC Highlights; hai vùng kia ngược lại. Đây là nhánh
      `isAdventure` trong `page.tsx` của Nexora, giữ nguyên. */
  signatureFirst: boolean;
  /** Chiều cao tối thiểu hero — "mood" riêng từng vùng (Nexora: `heroHeight`). */
  heroMinH: string;
  /** Độ đậm scrim hero (Nexora: `heroScrim`). */
  scrim: string;
}

/**
 * "Xương chung — da riêng": ba vùng dùng chung bộ khung nhưng mỗi vùng một biến
 * thể Signature và một mood hero. Port thẳng ý của `lib/region-theme.ts` bên
 * Nexora, KHÁC hai chỗ:
 *  · Không có `accentText`/`accentBg`/`chipOn`: v2 đã có lớp token `[data-region]`
 *    nên màu đến từ `--region-*`, không cần chuỗi class Tailwind theo vùng.
 *  · Khoá bằng `MockRegionKey` (`north`) chứ không bằng slug URL — cùng lý do §7
 *    đã bỏ khoá-bằng-chuỗi-user-facing.
 */
const THEMES: Record<MockRegionKey, RegionTheme> = {
  north: {
    signature: 'stats',
    signatureFirst: true,
    heroMinH: 'min-h-[26rem] lg:min-h-[34rem]',
    scrim: 'from-scrim via-scrim/55 to-scrim/15',
  },
  central: {
    signature: 'timeline',
    signatureFirst: false,
    heroMinH: 'min-h-80 lg:min-h-96',
    scrim: 'from-scrim via-scrim/35 to-transparent',
  },
  south: {
    signature: 'postcards',
    signatureFirst: false,
    heroMinH: 'min-h-80 lg:min-h-96',
    scrim: 'from-scrim via-scrim/25 to-transparent',
  },
};

export function regionTheme(key: MockRegionKey): RegionTheme {
  return THEMES[key];
}
