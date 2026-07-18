# @tourism/tokens

Single source of truth for design tokens. Authored in `style-dictionary/tokens.mjs`, built with
**Style Dictionary** (`style-dictionary/build.mjs`) into `generated/tokens.css` (Tailwind v4 `@theme`

+ `:root`/`.dark`). Apps import `@tourism/tokens/tokens.css`.

## Commands

+ `nx run @tourism/tokens:tokens` — regenerate `generated/tokens.css` (run after editing `tokens.mjs`).
+ `nx test @tourism/tokens` / `nx typecheck @tourism/tokens` / `nx lint @tourism/tokens`.

> `generated/` is a build artifact — **do not edit by hand**.

## Consuming tokens

+ Colors / radius / typography / shadow → use the generated **Tailwind utilities** (`bg-primary`,
  `text-3xl`, `shadow-card`, `rounded-lg`, `text-success`…). `@theme inline` means these are inlined
  into utilities, **not** emitted as runtime `var(--text-3xl)`.
+ `var()`-only tokens (in `:root`): `--z-*`, `--duration-*`, `--focus-ring-*`, `--touch-target-min`,
  `--prose-measure`, `--section-space`, `--control-h-*`, `--icon-*`, `--aspect-*`.
+ Compact density: set `data-density="compact"` on a container to shrink `--control-h-*` / `--section-space`.

## Domain mapping (tourism)

Components apply these intent tokens for domain values (keeps colors centralized):

| Domain value | Token / utility |
| --- | --- |
| `TourBadge.BEST_VALUE` | `success` (`bg-success text-success-foreground`) |
| `TourBadge.LIMITED_OFFER` | `warning` |
| `TourBadge.EXCLUSIVE` | `primary` |
| `TourBadge.NEW` | `info` |
| `TourBadge.POPULAR` | `warning` |
| `DepartureStatus.OPEN` | `success` |
| `DepartureStatus.CLOSED` | `muted` (`bg-muted text-muted-foreground`) |
| `DepartureStatus.CANCELLED` | `destructive` |
| Price | `text-price` + `font-semibold` |
| Compare-at price | `text-price-compare` + `line-through` |
| Rating star (filled / empty) | `text-rating` / `text-rating-muted` |
| Card / hero / thumb media | `aspect-[var(--aspect-card)]` / `--aspect-hero` / `--aspect-thumb` |

Brand "gu" (real palette, heading font, primary color) is **deferred** to a design-direction step;
current values are neutral defaults, swappable in `tokens.mjs`.
