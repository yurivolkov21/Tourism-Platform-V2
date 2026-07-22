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
    background: c('oklch(0.977 0.003 174.5)', 'oklch(0.25 0.015 181.5)'),
    foreground: c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    card: c('oklch(0.996 0.002 174)', 'oklch(0.309 0.022 177.6)'),
    'card-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    popover: c('oklch(0.996 0.002 174)', 'oklch(0.309 0.022 177.6)'),
    'popover-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    primary: c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
    'primary-foreground': c('oklch(0.974 0.007 174.4)', 'oklch(0.974 0.007 174.4)'),
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
    border: c('oklch(0.781 0.015 180.6)', 'oklch(0.402 0.026 173.6)'),
    input: c('oklch(0.781 0.015 180.6)', 'oklch(0.402 0.026 173.6)'),
    ring: c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
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
    // Tourism-specific semantic colors — rating = vàng hổ phách Wuling (chỉ dùng cho ★).
    rating: c('oklch(0.731 0.13 73.3)', 'oklch(0.78 0.13 75)'),
    'rating-muted': c('oklch(0.865 0.015 175.7)', 'oklch(1 0 0 / 0.2)'),
    price: c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    'price-compare': c('oklch(0.473 0.022 179.5)', 'oklch(0.748 0.026 174.5)'),
    // Data-viz ramp: 5 hue của brand + vùng (ngọc · thép · hổ phách · sơn mài · phù sa).
    'chart-1': c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
    'chart-2': c('oklch(0.535 0.057 239.5)', 'oklch(0.645 0.056 238.3)'),
    'chart-3': c('oklch(0.731 0.13 73.3)', 'oklch(0.78 0.13 75)'),
    'chart-4': c('oklch(0.516 0.136 27.3)', 'oklch(0.579 0.148 26.7)'),
    'chart-5': c('oklch(0.555 0.053 48.4)', 'oklch(0.661 0.052 51.2)'),
    sidebar: c('oklch(0.966 0.006 170.4)', 'oklch(0.29 0.02 178)'),
    'sidebar-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    'sidebar-primary': c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
    'sidebar-primary-foreground': c('oklch(0.974 0.007 174.4)', 'oklch(0.974 0.007 174.4)'),
    'sidebar-accent': c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'sidebar-accent-foreground': c('oklch(0.411 0.053 184.5)', 'oklch(0.822 0.041 180.6)'),
    'sidebar-border': c('oklch(0.865 0.015 175.7)', 'oklch(0.402 0.026 173.6)'),
    'sidebar-ring': c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
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

// Lớp region Bắc/Trung/Nam (ADR-0013 #3) — 5 slot/vùng, chỉ page-level app dùng
// (component KHÔNG tham chiếu --region-*). Nguồn phân tích: docs/conventions/color-system.md §4.
export const regionDefaults = {
  primary: 'oklch(0.494 0.067 184.3)',
  deep: 'oklch(0.411 0.053 184.5)',
  surface: 'oklch(0.914 0.01 174.3)',
  spark: 'oklch(0.731 0.13 73.3)',
  'on-surface': 'oklch(0.411 0.053 184.5)',
};

export const regions = {
  // Bắc — thép sương núi + tím (codename Arcane)
  north: {
    primary: 'oklch(0.535 0.057 239.5)',
    deep: 'oklch(0.423 0.056 245.8)',
    surface: 'oklch(0.855 0.007 277.1)',
    spark: 'oklch(0.56 0.151 285.4)',
    'on-surface': 'oklch(0.423 0.056 245.8)',
  },
  // Trung — đỏ rượu hoàng thành + vàng hoàng gia (codename Tangtang)
  central: {
    primary: 'oklch(0.415 0.161 27.2)',
    deep: 'oklch(0.351 0.131 25.9)',
    surface: 'oklch(0.89 0.028 20.4)',
    spark: 'oklch(0.799 0.163 99.1)',
    'on-surface': 'oklch(0.31 0.006 214.4)',
  },
  // Nam — nâu phù sa + đỏ gạch nung (codename Gilberta)
  south: {
    primary: 'oklch(0.555 0.053 48.4)',
    deep: 'oklch(0.394 0.091 28.3)',
    surface: 'oklch(0.661 0.052 51.2)',
    spark: 'oklch(0.485 0.183 29.7)',
    'on-surface': 'oklch(0.303 0.037 35.2)',
  },
};
