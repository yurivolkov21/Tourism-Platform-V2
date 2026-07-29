import type { MockRegionKey } from '@/mocks/types';

/** Biến thể khu Signature. Tên theo CẤU TRÚC nó dựng, không theo tên vùng —
    `seasons`/`timeline`/`postcards` đọc là biết render gì.
    Miền Bắc đã đi qua HAI biến thể chết, ghi lại để không ai chọn lại:
     · `stats` (bỏ 29/07) — dải số liệu chuyển lên hero, giữ ở đây là in cùng bốn
       con số hai lần trên một trang.
     · `itinerary` (bỏ 29/07) — nó kể hành trình theo ngày của MỘT tour, tức là
       nội dung của `/tours/[slug]`, nơi `ItineraryTimeline` đã làm đúng việc đó.
       Trang VÙNG phải nói về vùng, nên `seasons` (mùa đẹp của chính vùng). */
export type SignatureVariant = 'seasons' | 'timeline' | 'postcards';

export interface RegionTheme {
  signature: SignatureVariant;
}

/**
 * Nền băng của khu Signature — MỘT nguồn cho cả ba biến thể (`seasons`,
 * `timeline`, `postcards`). Trước ADR-0015 mỗi file tự gõ công thức và chúng đã
 * trôi khỏi nhau (88% · 88% · 92%); gom về đây để ba khu luôn cùng một sắc.
 *
 * Vì sao 55% chứ không giữ 88% như công thức cũ: công thức cũ pha
 * `--region-surface` — một token SÁNG và BẤT BIẾN theo theme — vào `--background`
 * (lật). Thay bằng `--muted` (cũng lật) thì phép pha tự triệt tiêu: ở dark ΔL so
 * với nền trang rơi từ +0.080 xuống chỉ +0.014 và băng gần như biến mất. Kéo tỉ
 * lệ muted lên 45% đưa băng về lại đúng biên độ cũ mà nay CÂN ở cả hai theme —
 * đo được ΔL −0.028 (light) và +0.053 (dark), so với −0.008 / +0.080 trước đây.
 * Chữ trên băng vẫn thoải mái: `muted-foreground` 5.72:1 light / 6.04:1 dark.
 */
export const SIGNATURE_BAND_BG = 'color-mix(in oklch, var(--muted), var(--background) 55%)';

/**
 * "Xương chung — da riêng": ba vùng dùng chung bộ khung, khác nhau ở CẤU TRÚC
 * khu Signature. Port thẳng ý của `lib/region-theme.ts` bên Nexora, KHÁC hai chỗ:
 *  · Không có `accentText`/`accentBg`/`chipOn`: cả ba vùng dùng CHUNG bảng màu
 *    brand, không có chuỗi class Tailwind riêng theo vùng.
 *  · Khoá bằng `MockRegionKey` (`north`) chứ không bằng slug URL — cùng lý do §7
 *    đã bỏ khoá-bằng-chuỗi-user-facing.
 *
 * `signatureFirst` đã BỎ (29/07): khu Highlights không còn đứng riêng (gộp vào
 * cột phải của Intro), nên không còn gì để "lật thứ tự" với Signature nữa —
 * giữ cờ lại là một field chết không ai đọc.
 *
 * `heroMinH` và `scrim` đã BỎ (ADR-0015, 29/07): user bác lớp màu theo vùng và
 * chốt luôn ba hero đồng nhất, nên "mood riêng từng vùng" không còn là bất biến.
 * Chiều cao hero giờ là một hằng tại chỗ trong `region-hero.tsx`, còn scrim thì
 * không còn đối tượng để phủ — hero đã đổi sang nền đặc `bg-hero`.
 */
const THEMES: Record<MockRegionKey, RegionTheme> = {
  north: { signature: 'seasons' },
  central: { signature: 'timeline' },
  south: { signature: 'postcards' },
};

export function regionTheme(key: MockRegionKey): RegionTheme {
  return THEMES[key];
}
