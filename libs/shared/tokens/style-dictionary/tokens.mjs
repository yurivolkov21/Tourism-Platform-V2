// Design tokens — source of truth for @tourism/tokens.
// Brand direction: "Emerald Heritage" (light luxury) — deep emerald primary, warm ivory
// neutrals, brass accents; serif headings (Fraunces) + sans body (Geist); refined radius.
// See docs/06-specs/2026-06-21-p2-design-direction.md.
//
// Authored in Style Dictionary token format. Each color carries light + dark values.

const c = (light, dark) => ({ value: light, darkValue: dark, type: 'color' });

export default {
  color: {
    // "Emerald Heritage" (light luxury): deep emerald primary · warm ivory neutrals · brass accents.
    // P5.6 "Nexora Dark Heritage": dark values retuned to the Navel-translated
    // ramp — deep emerald canvas, warm cream text, BRASS dark CTA (light stays
    // emerald). Spec: docs/06-specs/2026-07-15-p56-mobile-navel-redesign-design.md
    background: c('oklch(0.985 0.006 95)', 'oklch(0.24 0.025 165)'),
    foreground: c('oklch(0.23 0.012 155)', 'oklch(0.94 0.015 90)'),
    card: c('oklch(0.995 0.004 95)', 'oklch(0.28 0.025 165)'),
    'card-foreground': c('oklch(0.23 0.012 155)', 'oklch(0.94 0.015 90)'),
    popover: c('oklch(0.995 0.004 95)', 'oklch(0.28 0.025 165)'),
    'popover-foreground': c('oklch(0.23 0.012 155)', 'oklch(0.94 0.015 90)'),
    primary: c('oklch(0.42 0.08 155)', 'oklch(0.75 0.11 80)'),
    'primary-foreground': c('oklch(0.98 0.01 95)', 'oklch(0.24 0.03 160)'),
    // Text/icons that sit ON dark media (image scrims via --overlay). Stays light in BOTH themes —
    // the scrim is always dark, so this must NOT flip like primary-foreground does.
    'on-media': c('oklch(0.98 0.01 95)', 'oklch(0.98 0.01 95)'),
    secondary: c('oklch(0.93 0.012 120)', 'oklch(0.31 0.022 165)'),
    'secondary-foreground': c('oklch(0.3 0.02 155)', 'oklch(0.94 0.015 90)'),
    muted: c('oklch(0.95 0.008 105)', 'oklch(0.31 0.022 165)'),
    'muted-foreground': c('oklch(0.5 0.015 150)', 'oklch(0.72 0.02 150)'),
    accent: c('oklch(0.93 0.014 130)', 'oklch(0.33 0.024 165)'),
    'accent-foreground': c('oklch(0.3 0.02 155)', 'oklch(0.94 0.015 90)'),
    destructive: c('oklch(0.577 0.245 27.325)', 'oklch(0.704 0.191 22.216)'),
    border: c('oklch(0.9 0.01 120)', 'oklch(1 0 0 / 12%)'),
    input: c('oklch(0.9 0.01 120)', 'oklch(1 0 0 / 16%)'),
    ring: c('oklch(0.55 0.07 155)', 'oklch(0.72 0.1 80)'),
    overlay: c('oklch(0 0 0 / 0.5)', 'oklch(0 0 0 / 0.6)'),
    // P5.6: uniform photo treatment — bottom scrim + full-bleed grade tint
    // (consumed by mobile-ui ScrimImage; alpha-bearing like `overlay`).
    scrim: c('oklch(0.15 0.03 170 / 0.75)', 'oklch(0.13 0.03 170 / 0.8)'),
    'media-tint': c('oklch(0.35 0.05 180 / 0.1)', 'oklch(0.3 0.05 180 / 0.16)'),
    // Functional status colors (not brand "gu") — used by departure status, badges, alerts.
    success: c('oklch(0.62 0.17 145)', 'oklch(0.7 0.15 145)'),
    'success-foreground': c('oklch(0.985 0 0)', 'oklch(0.205 0 0)'),
    warning: c('oklch(0.78 0.15 80)', 'oklch(0.82 0.14 80)'),
    'warning-foreground': c('oklch(0.27 0.04 80)', 'oklch(0.2 0.03 80)'),
    info: c('oklch(0.6 0.13 240)', 'oklch(0.7 0.13 240)'),
    'info-foreground': c('oklch(0.985 0 0)', 'oklch(0.205 0 0)'),
    // Tourism-specific semantic colors — rating = brass (the light-luxury accent).
    rating: c('oklch(0.74 0.11 80)', 'oklch(0.8 0.12 82)'),
    'rating-muted': c('oklch(0.9 0.01 120)', 'oklch(1 0 0 / 0.2)'),
    price: c('oklch(0.23 0.012 155)', 'oklch(0.95 0.008 95)'),
    'price-compare': c('oklch(0.5 0.015 150)', 'oklch(0.7 0.012 130)'),
    // Data-viz ramp in the emerald/brass family.
    'chart-1': c('oklch(0.42 0.08 155)', 'oklch(0.72 0.1 155)'),
    'chart-2': c('oklch(0.74 0.11 80)', 'oklch(0.8 0.12 82)'),
    'chart-3': c('oklch(0.55 0.07 190)', 'oklch(0.65 0.08 190)'),
    'chart-4': c('oklch(0.65 0.06 135)', 'oklch(0.72 0.07 135)'),
    'chart-5': c('oklch(0.35 0.05 160)', 'oklch(0.5 0.06 160)'),
    sidebar: c('oklch(0.97 0.008 110)', 'oklch(0.26 0.025 165)'),
    'sidebar-foreground': c('oklch(0.23 0.012 155)', 'oklch(0.95 0.008 95)'),
    'sidebar-primary': c('oklch(0.42 0.08 155)', 'oklch(0.72 0.1 155)'),
    'sidebar-primary-foreground': c('oklch(0.98 0.01 95)', 'oklch(0.18 0.02 155)'),
    'sidebar-accent': c('oklch(0.93 0.014 130)', 'oklch(0.3 0.018 160)'),
    'sidebar-accent-foreground': c('oklch(0.3 0.02 155)', 'oklch(0.95 0.008 95)'),
    'sidebar-border': c('oklch(0.9 0.01 120)', 'oklch(1 0 0 / 10%)'),
    'sidebar-ring': c('oklch(0.55 0.07 155)', 'oklch(0.6 0.08 155)'),
  },
  radius: {
    DEFAULT: { value: '0.375rem', type: 'dimension' }, // refined (light luxury)
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
  heading: 'var(--font-heading)', // Fraunces (serif), set per-app via next/font; falls back to sans
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
  '/* Light-luxury: headings in the serif display face (Fraunces), body stays sans. */',
  'h1, h2, h3 {',
  '  font-family: var(--font-heading, var(--font-sans));',
  '}',
];
