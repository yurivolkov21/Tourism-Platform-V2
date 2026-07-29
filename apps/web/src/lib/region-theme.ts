import type { MockRegionKey } from '@/mocks/types';

/** Biến thể khu Signature. Tên theo CẤU TRÚC nó dựng, không theo tên vùng —
    `itinerary`/`timeline`/`postcards` đọc là biết render gì.
    `stats` đã BỎ (29/07): dải số liệu chuyển lên hero, nên vùng Bắc cần một khu
    khác chứ không phải in lại cùng bốn con số ở khu thứ hai. */
export type SignatureVariant = 'itinerary' | 'timeline' | 'postcards';

export interface RegionTheme {
  signature: SignatureVariant;
  /** Chiều cao tối thiểu hero — "mood" riêng từng vùng (Nexora: `heroHeight`).
      Đo bằng `vh` chứ không bằng `rem` (29/07): hero giờ mang breadcrumb, badge,
      h1, tagline, hai nút và hàng số liệu, nên nó phải chiếm phần lớn màn đầu như
      `AboutHero`. `rem` cố định làm nội dung tràn trên màn cao và thừa trên màn thấp. */
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
 *
 * `signatureFirst` đã BỎ (29/07): khu Highlights không còn đứng riêng (gộp vào
 * cột phải của Intro), nên không còn gì để "lật thứ tự" với Signature nữa —
 * giữ cờ lại là một field chết không ai đọc.
 */
const THEMES: Record<MockRegionKey, RegionTheme> = {
  north: {
    signature: 'itinerary',
    heroMinH: 'min-h-[80vh]',
    scrim: 'from-scrim via-scrim/60 to-scrim/30',
  },
  central: {
    signature: 'timeline',
    heroMinH: 'min-h-[70vh]',
    scrim: 'from-scrim via-scrim/45 to-scrim/30',
  },
  south: {
    signature: 'postcards',
    heroMinH: 'min-h-[70vh]',
    scrim: 'from-scrim via-scrim/40 to-scrim/30',
  },
};

export function regionTheme(key: MockRegionKey): RegionTheme {
  return THEMES[key];
}
