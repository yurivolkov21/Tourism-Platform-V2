import type { MockRegionKey } from '@/mocks/types';

/**
 * Khu GIỮA hero và footer. Tên theo NỘI DUNG khu nói, không theo tên vùng — đọc
 * `heritage` là biết con đường di sản, đọc `days` là biết khu "bạn có mấy ngày".
 *
 * Chín khoá cho ba trang × năm khu: `intro`/`gallery`/`tours` dùng chung (hai khu
 * đầu khác BIẾN THỂ ở từng vùng), sáu khoá còn lại mỗi khoá chỉ một vùng dựng —
 * `region-theme.spec.ts` canh đúng chuyện đó.
 */
export type RegionSectionKey =
  | 'intro'
  | 'gallery'
  | 'tours'
  | 'heritage'
  | 'worlds'
  | 'days'
  | 'dayTrips'
  | 'seasons'
  | 'reviews';

/** Ba biến thể của section "… in photos" trên trang vùng (`RegionGallery`). */
export type GalleryVariant = 'peaks' | 'lanterns' | 'panorama';

/**
 * Số ô mỗi biến thể. Nằm Ở ĐÂY (module không `'use client'`) chứ không trong
 * `region-gallery.tsx`: page vùng (server component) cần con số này để fetch
 * đúng bấy nhiêu khe `region-gallery-*`, mà hằng export từ module client khi
 * server import sẽ thành client-reference proxy (`TILE_COUNT[variant]` →
 * `undefined`, `Array.from({length: undefined})` → `[]` — đo được 19/08: trang
 * render không lỗi, chỉ… không có ảnh). Cùng bẫy đã ghi ở `AUTH_PANEL_SLOT`.
 * `region-gallery.tsx` re-export để spec/consumer cũ không đổi import.
 *
 * Con số là quyết định thiết kế user duyệt (8·10·3 → 6·6·3, "ảnh gallery quá
 * nhỏ") — `region-gallery.spec.tsx` khoá lại.
 */
export const TILE_COUNT: Record<GalleryVariant, number> = { peaks: 6, lanterns: 6, panorama: 3 };

export interface RegionTheme {
  /** Thứ tự khu GIỮA hero và footer. Hero/footer do layout lo. */
  sections: readonly RegionSectionKey[];
  galleryVariant: GalleryVariant;
  introVariant: 'aside' | 'row' | 'stacked';
}

/**
 * Nền băng phớt — MỘT nguồn cho mọi khu dựng trên băng (`heritage`, `worlds`,
 * `gallery`). Trước ADR-0015 mỗi file tự gõ công thức và chúng đã trôi khỏi nhau
 * (88% · 88% · 92%); gom về đây để các khu luôn cùng một sắc.
 *
 * Vì sao 55% chứ không giữ 88% như công thức cũ: công thức cũ pha
 * `--region-surface` — một token SÁNG và BẤT BIẾN theo theme — vào `--background`
 * (lật). Thay bằng `--muted` (cũng lật) thì phép pha tự triệt tiêu: ở dark ΔL so
 * với nền trang rơi từ +0.080 xuống chỉ +0.014 và băng gần như biến mất. Kéo tỉ
 * lệ muted lên 45% đưa băng về lại đúng biên độ cũ mà nay CÂN ở cả hai theme —
 * đo được ΔL −0.028 (light) và +0.053 (dark), so với −0.008 / +0.080 trước đây.
 * Chữ trên băng vẫn thoải mái: `muted-foreground` 5.72:1 light / 6.04:1 dark.
 *
 * ⚠️ Khu CUỐI của mỗi miền KHÔNG được dùng băng này. `site-footer.tsx` mang
 * `mt-32`, và 128px margin đó sơn màu `--background`; khu cuối có nền riêng thì
 * dải ấy hiện ra thành một vạch sáng kẹp giữa khu cuối và footer. Cơ chế
 * `data-flush-footer` từng vá chuyện đó đã XOÁ (Task 5k) vì khu cuối của cả ba
 * miền giờ đều dùng nền trang — `seasons`, `dayTrips`, `reviews`.
 *
 * ⚠️⚠️ **`in oklab`, KHÔNG `in oklch` — đừng "sửa lại" cho giống chỗ khác.**
 * Bản `oklch` đã ship và user báo ngay: *"nền băng bị hồng"* ở cả ba miền. Nguyên
 * nhân đo được ở Chrome: cả HAI token đầu vào đều chroma ≈ 0 (`--muted` 0.010,
 * `--background` 0.003), nên hue của chúng là POWERLESS và phép nội suy CỰC TOẠ
 * ĐỘ không còn góc nào để giữ — `color-mix(in oklch, …)` trả về
 * `oklch(0.948648 0.00616 none)`, render ra `#f2ecee` (242,236,238): kênh **lục
 * THẤP NHẤT**, dù cả hai đầu vào đều lục trội (220,229,226 và 245,248,247). Tức
 * lệch ~180° hue so với cả hai màu mình pha.
 *
 * `in oklab` nội suy theo trục Descartes a/b nên không có góc để mất: đo lại
 * `#eaefee` (234,239,238), lục trội, ΔL −0.0786 so với −0.0822 → nhịp trang
 * KHÔNG đổi. Ở dark hai công thức gần y hệt (35,50,46 vs 35,50,47).
 *
 * **Luật chung:** mọi `color-mix` giữa các màu GẦN TRUNG TÍNH dùng `in oklab`.
 * Đối chứng KHÔNG hỏng, đừng đụng: `region-group.tsx:44` pha `--primary` (chroma
 * 0.067) với `--background` — chroma đủ lớn để neo hue, đo ra `#dde7e5` và bản
 * `oklab` cho kết quả y hệt. `region-theme.spec.ts` canh hằng số này.
 */
export const SIGNATURE_BAND_BG = 'color-mix(in oklab, var(--muted), var(--background) 55%)';

/**
 * "Xương chung — da riêng": ba vùng dùng chung bộ khung, khác nhau ở THỨ TỰ khu,
 * ở SÁU khu riêng, và ở BIẾN THỂ của hai khu dùng chung.
 *
 * Đây là vòng thiết kế THỨ TƯ của trang vùng. Ba vòng trước bị user bác, và mỗi
 * lần bác đều để lại một luật:
 *  1. Bản đầu (rail số liệu + hàng địa điểm) — *"thiết kế không đâu vào đâu"*.
 *  2. Bản tint theo vùng — *"làm giao diện không đồng nhất"* → rút bằng ADR-0015,
 *     nên bản sắc vùng do CẤU TRÚC gánh, không do màu.
 *  3. Bản Task 5j có khu phổ ngày × độ khó — *"khách du lịch vào trang này để
 *     tham khảo xem những gì đặc sắc có ở miền bắc, nhưng ập vào mặt là một cái
 *     đồ thị. Đây là trang giao diện web cho người dùng xem chứ đâu phải
 *     dashboard báo cáo dành cho admin."*
 *
 * ⚠️ **Luật rút ra từ lần bác thứ ba, áp cho mọi khu thêm về sau:** phân hoá vùng
 * nói bằng NGÔN NGỮ KHÁCH DU LỊCH — nơi chốn, ảnh, lời người đã đi, "bạn có mấy
 * ngày" — không bằng ngôn ngữ phân tích dữ liệu. Thấy mình đang dựng một trục,
 * một thanh tỉ lệ, hay một dải ô có mốc số thì đó là sai hướng, **kể cả khi số
 * liệu hoàn toàn thật**. Vì luật này mà `region-spectrum` đã bị xoá hẳn và dải 12
 * ô của `region-seasons` bị bỏ (nó là một đồ thị thu nhỏ, cùng họ lỗi).
 *
 * Ràng buộc user chốt cho bản này:
 *  · Giống hệt cả ba miền: **hero · lưới 6 tour card · footer** — không hơn.
 *  · Mỗi miền BẮT BUỘC có gallery riêng, khác BỐ CỤC chứ không chỉ khác số ô.
 *  · **Số khu bằng nhau: 7 mỗi miền** (hero + 5 + footer).
 *
 * Vì sao KHÔNG phân hoá bằng dữ liệu: mock ĐỐI XỨNG theo thiết kế (3 địa điểm ·
 * 6 tour · 5 riêng + 1 xuyên vùng ở cả ba vùng) và user chốt không đụng mock (nó
 * khoá `/tours`, `/about`, `/#gallery` và loạt test 16 tour · 6/6/6 · 25 lượt
 * chạm). Nên phân hoá bằng THỨ TỰ KHU và bằng SÁU khu riêng.
 *
 * Bản đồ khu — mỗi cột là một trang đọc theo thứ tự từ trên xuống:
 *
 * | # | BẮC | TRUNG | NAM |
 * | 1 | Hero | Hero | Hero |
 * | 2 | Intro `aside` | Con đường di sản | Ba thế giới |
 * | 3 | Gallery `peaks` | Intro `row` | Intro `stacked` |
 * | 4 | Lưới 6 tour | Lưới 6 tour | Lưới 6 tour |
 * | 5 | Bạn có mấy ngày? | Gallery `lanterns` | Gallery `panorama` |
 * | 6 | When to visit | Một ngày ở miền Trung | Khách nói gì |
 * | 7 | Footer | Footer | Footer |
 *
 * Mỗi khu riêng cắm vào một SỰ THẬT của vùng, không phải một khuôn đem áp cho đủ:
 *  · Bắc `days` — vùng DUY NHẤT trải 1→8 ngày (chuyến riêng: 1,2,2,3,8).
 *  · Bắc `seasons` — hai mùa đẹp rời nhau (Mar–May, Sep–Nov), thứ hai vùng kia
 *    không có: Trung một dải liền, Nam vắt qua năm.
 *  · Trung `heritage` — Huế → Hội An → Mỹ Sơn là một trục có hướng.
 *  · Trung `dayTrips` — **bốn trên năm** chuyến riêng gói trong một ngày.
 *  · Nam `worlds` — ba thế giới rời nhau (delta · thành phố · đảo), nên dẫn bằng
 *    ảnh; `emphasis` dựng ô cao hơn.
 *  · Nam `reviews` — 20 review THẬT của vùng, nhiều nhất trên một khu chưa dùng.
 *
 * ⚠️ Khu CUỐI của cả ba miền (`seasons`, `dayTrips`, `reviews`) dùng NỀN TRANG —
 * xem cảnh báo ở `SIGNATURE_BAND_BG`. Đổi thứ tự mà đưa một khu-có-băng xuống
 * cuối là làm dải sáng 128px trên footer hiện lại, và Vitest không bắt được.
 *
 * ⚠️ Hai khu đặc trưng KHÔNG dính nhau: khu riêng thứ nhất đứng quanh Intro, khu
 * riêng thứ hai đứng SAU Tours. Hai khu đặc trưng liền nhau thì phần giữa trang
 * thành một cục, và Tours mới là khu người ta tới trang này để tìm.
 */
const THEMES: Record<MockRegionKey, RegionTheme> = {
  north: {
    sections: ['intro', 'gallery', 'tours', 'days', 'seasons'],
    galleryVariant: 'peaks',
    introVariant: 'aside',
  },
  central: {
    sections: ['heritage', 'intro', 'tours', 'gallery', 'dayTrips'],
    galleryVariant: 'lanterns',
    introVariant: 'row',
  },
  south: {
    sections: ['worlds', 'intro', 'tours', 'gallery', 'reviews'],
    galleryVariant: 'panorama',
    introVariant: 'stacked',
  },
};

export function regionTheme(key: MockRegionKey): RegionTheme {
  return THEMES[key];
}
