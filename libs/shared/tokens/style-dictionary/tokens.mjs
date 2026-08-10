// Design tokens — source of truth for @tourism/tokens.
// Hướng brand: "Wuling" — ngọc bích trầm trên nền sương celadon, mực tàu, accent
// sơn mài/hổ phách; heading serif (Literata) + thân sans (Archivo); radius refined.
// Phân tích & giá trị chốt: docs/conventions/color-system.md · ADR-0013.
//
// Authored in Style Dictionary token format. Each color carries light + dark values.

const c = (light, dark) => ({ value: light, darkValue: dark, type: 'color' });

export default {
  color: {
    // Hệ "Wuling" — chốt 22/07/2026, phân tích tại docs/conventions/color-system.md.
    // Quy đổi oklch từ hex chốt bằng culori (làm tròn 3 chữ số).
    // Dark L 0.25 → 0.275 (+10% — CHỐT 06/08, góp ý nhóm "nền tối quá khó
    // nhìn", user duyệt sau khi xem A/B). CHỈ nền gốc đổi; hero/card/muted
    // giữ nguyên theo chỉ đạo. Số đo sau đổi: chữ/nền 11.73 (dư AAA);
    // nút primary/nền 2.91 — RỚT NHẸ mốc 3:1 non-text, NỢ CÓ HỒ SƠ cùng họ
    // với "primary/card 2.57" bên dưới: cân lại primary dark là một quyết
    // định thiết kế riêng (xem CHANGELOG 06/08), đừng "tiện tay" chỉnh ở đây.
    // NỢ ĐÓNG 10/08 bằng giải pháp thay thế — viền `border-border` trên nút
    // primary ở dark (không đạt được đồng thời 3:1 nền + 4.5:1 chữ, xem
    // ADR-0019); đo lại nếu đổi ramp.
    background: c('oklch(0.977 0.003 174.5)', 'oklch(0.275 0.015 181.5)'),
    foreground: c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    card: c('oklch(0.996 0.002 174)', 'oklch(0.309 0.022 177.6)'),
    'card-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    popover: c('oklch(0.996 0.002 174)', 'oklch(0.309 0.022 177.6)'),
    'popover-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    // ⚠️ Dark L hạ 0.563 → 0.53 ngày 30/07 để vá một lỗi WCAG AA THẬT, đo được nhiều
    // lần suốt cụm Destinations: `primary-foreground` KHÔNG lật theo theme (cùng một
    // giá trị gần-trắng ở cả hai), mà dark `primary` lại SÁNG HƠN light — nên chữ
    // 14px trên mọi nút primary ở dark chỉ đạt **4.11:1**, dưới ngưỡng 4.5.
    //
    // Vì sao hạ L chứ không đổi `primary-foreground` thành chữ tối ở dark: đã đo,
    // phương án đó **không thể đạt**. Kể cả chữ gần-đen (L=0.16) trên dark primary
    // sáng cũng chỉ ra 4.37:1. Không có giá trị nào của foreground cứu được.
    //
    // Vì sao đúng 0.53 mà không tối hơn — đo với nền THẬT (`background` dark
    // `oklch(0.25 …)`, `card` dark `oklch(0.309 …)`):
    //   0.563 cũ → chữ 4.11 ❌ · nút/nền 3.60 · nút/card 2.95
    //   0.540    → chữ 4.53    (đệm chỉ 0.03, quá mỏng)
    //   **0.530  → chữ 4.73 ✅ · nút/nền 3.13 ✅ · nút/card 2.57**
    //   0.500    → chữ 5.38    · nút/nền 2.75 ❌ (nút tan vào nền trang)
    // Tối thêm là cứu chữ nhưng giết ranh giới nút; 0.53 là điểm tối ÍT NHẤT vượt
    // được ngưỡng cứng mà vẫn giữ nút/nền trên 3:1.
    //
    // Nợ còn lại, nói thẳng: nút primary đứng TRÊN CARD ở dark đo 2.57 và **đã là
    // 2.95 từ trước khi sửa** — dưới 3:1 của WCAG 1.4.11 ở cả hai bản. Sửa L không
    // tạo ra lỗi đó và cũng không chữa được nó; chữa thật là đổi `card` dark hoặc cho
    // nút một viền, và đó là quyết định thiết kế riêng. Ghi ở CHANGELOG 30/07.
    // NỢ ĐÓNG 10/08 bằng giải pháp thay thế — viền `border-border` trên nút
    // primary ở dark (không đạt được đồng thời 3:1 nền + 4.5:1 chữ, xem
    // ADR-0019); đo lại nếu đổi ramp.
    primary: c('oklch(0.494 0.067 184.3)', 'oklch(0.53 0.076 181.3)'),
    'primary-foreground': c('oklch(0.974 0.007 174.4)', 'oklch(0.974 0.007 174.4)'),
    // `primary` khi nó LÀ CHỮ, không phải khi nó là bề mặt (ADR-0019 mục 2).
    //
    // Vì sao phải tách hẳn một token: ở chế độ tối, `primary` bị kéo về hai
    // phía loại trừ nhau. Làm BỀ MẶT thì phải đủ tối để cõng nhãn gần-trắng
    // (`primary-foreground` 4.5:1 ép L ≤ 0.542); làm CHỮ thì phải đủ sáng để
    // đọc trên nền tối (4.5:1 trên `muted` đòi L ≥ 0.74). Hai khoảng rời hẳn
    // nhau — không giá trị nào thoả cả hai, nên mọi lần chỉnh L trước đây đều
    // chỉ là kéo co giữa hai vai.
    //
    // LIGHT giữ Y HỆT `primary` (0.494): ở chế độ sáng nó đã đạt trên mọi bề
    // mặt (nền 5.57 · card 5.88 · muted 4.62), nên tách token KHÔNG đổi một
    // pixel nào ở light. Chỉ dark mới khác.
    //
    // Đo dark ở L 0.76: nền 7.10 · card 6.30 · muted 5.01 — cặp tệ nhất
    // (`muted`) từ 2.05 lên 5.01. Chọn 0.76 chứ không phải 0.74 (4.67, sát mép)
    // để có đệm.
    //
    // Dùng ở đâu: chữ nhấn mạnh, link, icon, số lớn — tức mọi chỗ `primary`
    // đứng làm mực trên nền. KHÔNG dùng cho `bg-*`; bề mặt vẫn là `primary`.
    'primary-emphasis': c('oklch(0.494 0.067 184.3)', 'oklch(0.76 0.076 181.3)'),
    // Text/icons that sit ON dark media (image scrims via --overlay). Stays light in BOTH themes —
    // the scrim is always dark, so this must NOT flip like primary-foreground does.
    'on-media': c('oklch(0.98 0.005 180)', 'oklch(0.98 0.005 180)'),
    secondary: c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'secondary-foreground': c('oklch(0.411 0.053 184.5)', 'oklch(0.822 0.041 180.6)'),
    muted: c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'muted-foreground': c('oklch(0.473 0.022 179.5)', 'oklch(0.748 0.026 174.5)'),
    accent: c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'accent-foreground': c('oklch(0.411 0.053 184.5)', 'oklch(0.822 0.041 180.6)'),
    destructive: c('oklch(0.516 0.136 27.3)', 'oklch(0.579 0.148 26.7)'),
    // `destructive` khi nó LÀ CHỮ, không phải khi nó là bề mặt — cùng một phép
    // tách với `primary-emphasis` (ADR-0019 mục 2), vì đây là CÙNG mâu thuẫn
    // hai vai, phát hiện 11/08 khi đo lại khu account.
    //
    // Đo `destructive` ở dark (L 0.579):
    //   vai BỀ MẶT — badge giảm giá `bg-destructive` + `text-white`: 4.62 ✅
    //   vai MỰC    — `text-destructive` trên nền 3.19 ❌ · trên card 2.83 ❌
    // Nâng L để cứu vai mực thì giết vai bề mặt: L 0.70 kéo chữ trắng trên
    // badge xuống 2.85. Hai khoảng rời hẳn nhau, y như `primary`.
    //
    // LIGHT giữ Y HỆT `destructive` (0.516): vai mực ở sáng đã đạt sẵn (nền
    // 5.62 · card 5.93), nên tách token KHÔNG đổi một pixel nào ở light.
    //
    // Đo dark ở L 0.72: nền 5.58 · card 4.95. Chọn 0.72 chứ không phải 0.70
    // (4.59 trên card, sát mép) để có đệm — cùng lối chọn với `primary-emphasis`.
    //
    // Dùng ở đâu: MỌI `text-destructive`. Bề mặt đặc (badge "−20%" cõng chữ
    // trắng) vẫn là `destructive`.
    'destructive-emphasis': c('oklch(0.516 0.136 27.3)', 'oklch(0.72 0.148 26.7)'),
    // ⚠️ `border` và `input` KHÔNG cùng luật, dù giá trị từng giống hệt nhau
    // (ADR-0019 mục 5). `border` là đường phân cách và mép thẻ — TRANG TRÍ,
    // không thuộc WCAG 1.4.11, nâng nó lên 3:1 sẽ biến toàn site thành lưới kẻ
    // ô và phá ngôn ngữ hairline. `input` là ranh giới của một ĐIỀU KHIỂN nên
    // phải đạt 3:1. Gộp hai thứ này vào một phép "nâng tương phản" là sai —
    // ghi rõ ở đây để lần sau không ai vá nhầm.
    border: c('oklch(0.781 0.015 180.6)', 'oklch(0.402 0.026 173.6)'),
    // Đo trên CẢ HAI bề mặt ô nhập thật sự đứng lên — nền trang VÀ card. Ở chế
    // độ sáng, nền trang (L 0.977) mới là ca khó chứ không phải card (L 0.996):
    // card sáng hơn nên viền tối tương phản MẠNH hơn. Lấy card làm "tệ nhất" là
    // sai chiều, và đã suýt chốt nhầm ở 0.66 (card 3.06 ✅ nhưng nền 2.89 ❌).
    //   light 0.64 → nền 3.13 ✅ · card 3.30 ✅   (cũ 0.781 → 1.24 / 1.30 ❌)
    //   dark  0.58 → nền 3.49 ✅ · card 3.09 ✅   (cũ 0.402 → 1.44 / 1.28 ❌)
    // Ở dark thì ngược lại: card SÁNG hơn nền nên card là ca khó.
    input: c('oklch(0.64 0.015 180.6)', 'oklch(0.58 0.026 173.6)'),
    // ⚠️ Dark NÂNG 0.563 → 0.60, tức NGƯỢC hướng với `primary` (đang hạ dần).
    // Vòng focus cần SÁNG để nhìn thấy trên nền tối; bề mặt nút cần TỐI để cõng
    // nhãn gần-trắng. Đây chính là bằng chứng hai vai không dùng chung một giá
    // trị được (ADR-0019). Đo: /card 2.96 ❌ → 3.44 ✅ trên 22 chỗ `ring-ring`.
    //
    // `cf8f821` (30/07) hạ `primary` dark mà bỏ quên token này cùng ba token
    // soi gương khác — đó là lý do vòng focus âm thầm trượt chuẩn suốt từ đó.
    ring: c('oklch(0.494 0.067 184.3)', 'oklch(0.60 0.076 181.3)'),
    overlay: c('oklch(0 0 0 / 0.5)', 'oklch(0 0 0 / 0.6)'),
    // P5.6: uniform photo treatment — bottom scrim + full-bleed grade tint
    // (consumed by mobile-ui ScrimImage; alpha-bearing like `overlay`). Hue → họ ngọc Wuling.
    scrim: c('oklch(0.15 0.02 182 / 0.75)', 'oklch(0.13 0.02 182 / 0.8)'),
    'media-tint': c('oklch(0.35 0.05 184 / 0.1)', 'oklch(0.3 0.05 184 / 0.16)'),
    // Functional status colors (not brand "gu") — used by departure status, badges, alerts.
    success: c('oklch(0.62 0.17 145)', 'oklch(0.7 0.15 145)'),
    'success-foreground': c('oklch(0.985 0 0)', 'oklch(0.205 0 0)'),
    warning: c('oklch(0.78 0.15 80)', 'oklch(0.82 0.14 80)'),
    'warning-foreground': c('oklch(0.27 0.04 80)', 'oklch(0.2 0.03 80)'),
    info: c('oklch(0.6 0.13 240)', 'oklch(0.7 0.13 240)'),
    'info-foreground': c('oklch(0.985 0 0)', 'oklch(0.205 0 0)'),
    // Bề mặt HERO — luôn là mảng tối nhất của trang, ở CẢ hai chế độ màu.
    //
    // Trước 27/07 hero không có token riêng: nó mượn `background` bên trong một
    // scope `dark`. Ở light mode ổn (0.25 trên nền 0.977), nhưng ở dark mode
    // nền trang ĐÃ là 0.25 nên hero trùng màu tuyệt đối và biến mất — đo được
    // lab(13.19 -5.13 -0.19) cho cả hai.
    //
    // Không đảo thành hero SÁNG ở dark mode: navbar lúc chưa cuộn dùng
    // `on-media`, token cố ý không lật theo theme (xem comment ở trên), nên nền
    // sáng sẽ làm chữ navbar tàng hình — đúng lý do luật "hero luôn tối" ra đời.
    // Thay vào đó đẩy hero tối thêm một bậc, giữ thứ bậc hero → trang → card
    // giống hệt nhau ở cả hai chế độ.
    hero: c('oklch(0.25 0.015 181.5)', 'oklch(0.17 0.019 182.5)'),
    'hero-foreground': c('oklch(0.921 0.014 174.1)', 'oklch(0.921 0.014 174.1)'),
    // Tourism-specific semantic colors — rating = vàng hổ phách Wuling (chỉ dùng cho ★).
    //
    // ⚠️ Light L hạ 0.731 → 0.64 ngày 30/07. Ngôi sao là GRAPHIC nên ngưỡng là 3:1
    // (WCAG 1.4.11), và bản cũ đo **2.27:1 trên `background`** / 2.40 trên `card` —
    // trượt ở cả hai bề mặt nó thật sự đứng lên. Đo các mốc:
    //   0.731 cũ → /bg 2.27 ❌ · /card 2.40 ❌
    //   0.660    → /bg 2.98 ❌ (sát nhưng vẫn dưới) · /card 3.15 ✅
    //   **0.640  → /bg 3.22 ✅ · /card 3.40 ✅** — mốc đầu tiên đạt trên CẢ HAI
    // Chọn 0.64 vì nó là giá trị SÁNG NHẤT còn đạt: giữ được nhiều sắc hổ phách nhất
    // trong khi không còn bề mặt nào trượt.
    //
    // Dark giữ nguyên `0.78` — đo trên `background` dark đã đạt, và hổ phách sáng là
    // đúng thứ dark mode cần.
    //
    // Đây có phải vi phạm bắt buộc? Tranh luận được: ngôi sao LUÔN đi kèm con số
    // (`4.8 (5)`) nên nó không phải phần tử duy nhất mang thông tin. Nhưng 2.27 là
    // thấp thật, và user chọn vá sau khi xem số — không phải suy diễn hộ.
    rating: c('oklch(0.64 0.13 73.3)', 'oklch(0.78 0.13 75)'),
    'rating-muted': c('oklch(0.865 0.015 175.7)', 'oklch(1 0 0 / 0.2)'),
    price: c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    'price-compare': c('oklch(0.473 0.022 179.5)', 'oklch(0.748 0.026 174.5)'),
    // Data-viz ramp: 5 hue của brand + vùng (ngọc · thép · hổ phách · sơn mài · phù sa).
    // Vai ĐỒ HOẠ trên nền (WCAG 1.4.11, ngưỡng 3:1) — cần SÁNG ở dark, nên
    // dùng thang vai-chữ 0.76 thay vì soi gương `primary`. Hiện 0 consumer;
    // sửa luôn để P4 admin không kế thừa một giá trị đã biết là trượt chuẩn.
    'chart-1': c('oklch(0.494 0.067 184.3)', 'oklch(0.76 0.076 181.3)'),
    'chart-2': c('oklch(0.535 0.057 239.5)', 'oklch(0.645 0.056 238.3)'),
    'chart-3': c('oklch(0.731 0.13 73.3)', 'oklch(0.78 0.13 75)'),
    'chart-4': c('oklch(0.516 0.136 27.3)', 'oklch(0.579 0.148 26.7)'),
    'chart-5': c('oklch(0.555 0.053 48.4)', 'oklch(0.661 0.052 51.2)'),
    sidebar: c('oklch(0.966 0.006 170.4)', 'oklch(0.29 0.02 178)'),
    'sidebar-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    // Vai BỀ MẶT — cõng `sidebar-primary-foreground` gần-trắng, nên đi theo
    // `primary` (0.53) chứ không đứng ở 0.563. Trôi từ `cf8f821`.
    'sidebar-primary': c('oklch(0.494 0.067 184.3)', 'oklch(0.53 0.076 181.3)'),
    'sidebar-primary-foreground': c('oklch(0.974 0.007 174.4)', 'oklch(0.974 0.007 174.4)'),
    'sidebar-accent': c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'sidebar-accent-foreground': c('oklch(0.411 0.053 184.5)', 'oklch(0.822 0.041 180.6)'),
    'sidebar-border': c('oklch(0.865 0.015 175.7)', 'oklch(0.402 0.026 173.6)'),
    // Vai VÒNG FOCUS — đi theo `ring` (0.60), không theo `primary`.
    'sidebar-ring': c('oklch(0.494 0.067 184.3)', 'oklch(0.60 0.076 181.3)'),
  },
  radius: {
    DEFAULT: { value: '0.375rem', type: 'dimension' }, // refined — giữ nguyên đợt rebrand
  },
};

// Radius scale multipliers (× --radius) → Tailwind @theme radius steps.
export const radiusScale = {
  sm: 0.6,
  md: 0.8,
  lg: 1,
  xl: 1.4,
  '2xl': 1.8,
  '3xl': 2.2,
  '4xl': 2.6,
};

// Font family theme vars (passthrough to the runtime --font-sans set in each app layout).
export const fonts = {
  sans: 'var(--font-sans)',
  heading: 'var(--font-heading)', // Literata (serif), đặt per-app qua next/font; fallback về sans
};

// Mode-independent Tailwind v4 @theme tokens → generate utilities (text-*, font-*,
// tracking-*, leading-*, shadow-*, ease-*). Ordered [cssVar, value].
export const themeExtras = [
  // Type scale (size + paired line-height)
  ['--text-xs', '0.75rem'],
  ['--text-xs--line-height', 'calc(1 / 0.75)'],
  ['--text-sm', '0.875rem'],
  ['--text-sm--line-height', 'calc(1.25 / 0.875)'],
  ['--text-base', '1rem'],
  ['--text-base--line-height', 'calc(1.5 / 1)'],
  ['--text-lg', '1.125rem'],
  ['--text-lg--line-height', 'calc(1.75 / 1.125)'],
  ['--text-xl', '1.25rem'],
  ['--text-xl--line-height', 'calc(1.75 / 1.25)'],
  ['--text-2xl', '1.5rem'],
  ['--text-2xl--line-height', 'calc(2 / 1.5)'],
  ['--text-3xl', '1.875rem'],
  ['--text-3xl--line-height', 'calc(2.25 / 1.875)'],
  ['--text-4xl', '2.25rem'],
  ['--text-4xl--line-height', 'calc(2.5 / 2.25)'],
  ['--text-5xl', '3rem'],
  ['--text-5xl--line-height', '1'],
  ['--text-6xl', '3.75rem'],
  ['--text-6xl--line-height', '1'],
  ['--text-7xl', '4.5rem'],
  ['--text-7xl--line-height', '1'],
  // Font weights
  ['--font-weight-normal', '400'],
  ['--font-weight-medium', '500'],
  ['--font-weight-semibold', '600'],
  ['--font-weight-bold', '700'],
  // Letter spacing
  ['--tracking-tighter', '-0.05em'],
  ['--tracking-tight', '-0.025em'],
  ['--tracking-normal', '0em'],
  ['--tracking-wide', '0.025em'],
  // Line-height scale
  ['--leading-tight', '1.25'],
  ['--leading-snug', '1.375'],
  ['--leading-normal', '1.5'],
  ['--leading-relaxed', '1.625'],
  // Elevation by intent (light; dark-mode shadow softening handled via .dark rule later)
  ['--shadow-card', '0 1px 3px 0 oklch(0 0 0 / 0.08), 0 1px 2px -1px oklch(0 0 0 / 0.08)'],
  ['--shadow-dropdown', '0 4px 12px -2px oklch(0 0 0 / 0.12)'],
  ['--shadow-popover', '0 8px 24px -4px oklch(0 0 0 / 0.14)'],
  ['--shadow-modal', '0 24px 48px -12px oklch(0 0 0 / 0.25)'],
  // Easing
  ['--ease-out-expo', 'cubic-bezier(0.16, 1, 0.3, 1)'],
  ['--ease-in-out-smooth', 'cubic-bezier(0.45, 0, 0.55, 1)'],
  // Spacing base (Tailwind multiplies this for p-*/m-*/gap-*/size-*)
  ['--spacing', '0.25rem'],
  // Content container width → max-w-content
  ['--container-content', '80rem'],
  // Breakpoints (explicit single source; values match the standard scale → no behavior change)
  ['--breakpoint-sm', '40rem'],
  ['--breakpoint-md', '48rem'],
  ['--breakpoint-lg', '64rem'],
  ['--breakpoint-xl', '80rem'],
  ['--breakpoint-2xl', '96rem'],
];

// Mode-independent :root custom props consumed via var() (no Tailwind utility namespace):
// motion durations, z-index layering, a11y, and content measure. Ordered [cssVar, value].
export const rootExtras = [
  ['--duration-fast', '150ms'],
  ['--duration-normal', '250ms'],
  ['--duration-slow', '400ms'],
  ['--z-base', '0'],
  ['--z-dropdown', '1000'],
  ['--z-sticky', '1100'],
  ['--z-overlay', '1300'],
  ['--z-modal', '1400'],
  ['--z-popover', '1500'],
  ['--z-toast', '1700'],
  ['--focus-ring-width', '2px'],
  ['--focus-ring-offset', '2px'],
  ['--touch-target-min', '44px'],
  ['--prose-measure', '65ch'],
  ['--section-space', 'clamp(4rem, 3rem + 5vw, 8rem)'],
  // Sizing — control heights (comfortable density) + iconography. Components adopt via var().
  ['--control-h-sm', '1.75rem'],
  ['--control-h-md', '2rem'],
  ['--control-h-lg', '2.25rem'],
  ['--icon-size', '1rem'],
  ['--icon-stroke', '2'],
  // Media aspect ratios (tourism) — use via aspect-[var(--aspect-card)] or component CSS.
  ['--aspect-card', '4 / 3'],
  ['--aspect-hero', '16 / 9'],
  ['--aspect-thumb', '1 / 1'],
  // Băng ảnh full-bleed cắt ngang trang (trang chi tiết tour, spec §6.2). Dẹt
  // hơn `--aspect-hero` một bậc vì nó KHÔNG phải hero: ở 1440px thì 16/9 cao
  // 810px, chiếm trọn một màn hình và đẩy nội dung bán hàng xuống dưới nếp gấp.
  // 21/9 cho 617px — vẫn là một dải ảnh có mặt, nhưng đọc như đường phân cách
  // giữa hai khu vực chứ không phải một trang riêng.
  ['--aspect-band', '21 / 9'],
];

// Compact density overrides — emitted under [data-density='compact'] for dense admin tables.
export const densityCompact = [
  ['--control-h-sm', '1.5rem'],
  ['--control-h-md', '1.75rem'],
  ['--control-h-lg', '2rem'],
  ['--section-space', 'clamp(2.5rem, 2rem + 3vw, 5rem)'],
];

// Plain base-layer rules derived from tokens (not custom-property declarations).
export const baseRules = [
  '::selection {',
  '  background-color: var(--accent);',
  '  color: var(--accent-foreground);',
  '}',
  '/* Wuling: heading dùng serif (Literata), thân giữ sans (Archivo). */',
  'h1, h2, h3 {',
  '  font-family: var(--font-heading, var(--font-sans));',
  '}',
];

// Lớp region Bắc/Trung/Nam (ADR-0013 #3) — 6 slot/vùng, chỉ page-level app dùng
// (component KHÔNG tham chiếu --region-*). Nguồn phân tích: docs/conventions/color-system.md §4.
export const regionDefaults = {
  primary: 'oklch(0.494 0.067 184.3)',
  deep: 'oklch(0.411 0.053 184.5)',
  surface: 'oklch(0.914 0.01 174.3)',
  spark: 'oklch(0.731 0.13 73.3)',
  'on-surface': 'oklch(0.411 0.053 184.5)',
  // Nền hero của trang vùng. Bằng `--hero` bản light để vùng không rõ vẫn ra
  // hero chuẩn của site, không ra một màu lạ.
  hero: 'oklch(0.25 0.015 181.5)',
};

// ADR-0015: `regions` (ba khối override theo Bắc/Trung/Nam, mỗi vùng một sắc
// riêng) đã XOÁ khỏi đây. Trước Task 5i nó từng nằm ở dòng 233–265 — không còn
// consumer nào đọc `--region-*` mà có tổ tiên `[data-region]` (Task 5h chuyển
// hết sang token brand), nên ba khối override đã trơ, xoá không đổi pixel nào.
// `regionDefaults` ở trên GIỮ NGUYÊN: 4 file nhóm hai (auth ×2, home/contact,
// contact-cta) vẫn đọc giá trị `:root` làm bảng màu phụ, không dùng tint.
