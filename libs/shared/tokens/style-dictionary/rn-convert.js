// oklch token strings → RN-consumable values. The ONLY place raw color math lives.
import { formatHex, formatHex8, parse } from 'culori';

/** 'oklch(0.42 0.08 155)' → '#rrggbb'; with alpha → '#rrggbbaa'. */
export function toRnColor(oklchString) {
  const color = parse(oklchString);
  if (!color) {
    throw new Error(`@tourism/tokens rn-theme: unparseable color "${oklchString}"`);
  }
  return color.alpha !== undefined && color.alpha < 1 ? formatHex8(color) : formatHex(color);
}

/** '0.375rem' → 6 (dp at the 16px web root). */
export function remToDp(remString) {
  const match = /^(-?\d*\.?\d+)rem$/.exec(remString.trim());
  if (!match) {
    throw new Error(`@tourism/tokens rn-theme: expected rem value, got "${remString}"`);
  }
  return Math.round(parseFloat(match[1]) * 16);
}

/**
 * Line-height của Tailwind → dp. Hai dạng trong `themeExtras`:
 *   'calc(1.25 / 0.875)'  tử số CHÍNH LÀ line-height theo rem → 1.25rem = 20dp
 *   '1'                   bội số trần (5xl trở lên) → nhân với fontSize
 */
export function lineHeightToDp(value, fontSizeDp) {
  const calc = /^calc\(\s*(-?\d*\.?\d+)\s*\/\s*-?\d*\.?\d+\s*\)$/.exec(value.trim());
  if (calc) {
    return Math.round(parseFloat(calc[1]) * 16);
  }
  const multiplier = /^(-?\d*\.?\d+)$/.exec(value.trim());
  if (multiplier) {
    return Math.round(parseFloat(multiplier[1]) * fontSizeDp);
  }
  throw new Error(`@tourism/tokens rn-theme: line-height không đọc được "${value}"`);
}

/** '44px' → 44. */
function pxToDp(pxString) {
  const match = /^(-?\d*\.?\d+)px$/.exec(pxString.trim());
  if (!match) {
    throw new Error(`@tourism/tokens rn-theme: expected px value, got "${pxString}"`);
  }
  return Math.round(parseFloat(match[1]));
}

/**
 * `themeExtras` + `rootExtras` (dạng [cssVar, value][]) → phần phi-màu của RN
 * theme: type scale, font weight, spacing base, touch target tối thiểu.
 *
 * Vì sao cần: `@tourism/mobile-ui` không có Tailwind để đọc `--text-*`, mà
 * CLAUDE.md #6 (tokens-only) áp cho mobile y nguyên như web — nên mọi con số
 * chữ/khoảng cách phải đi qua cầu này thay vì viết tay trong component.
 */
export function toRnScale(themeExtras, rootExtras) {
  const vars = new Map(themeExtras);
  const roots = new Map(rootExtras);

  const type = {};
  for (const [name, value] of vars) {
    // Bỏ qua chính các khoá line-height — chúng được đọc kèm theo bậc của nó.
    if (!name.startsWith('--text-') || name.endsWith('--line-height')) continue;
    const step = name.slice('--text-'.length);
    const lineHeightVar = vars.get(`${name}--line-height`);
    if (lineHeightVar === undefined) {
      throw new Error(`@tourism/tokens rn-theme: bậc ${name} thiếu line-height ghép đôi`);
    }
    const fontSize = remToDp(value);
    type[step] = { fontSize, lineHeight: lineHeightToDp(lineHeightVar, fontSize) };
  }

  const weight = {};
  for (const [name, value] of vars) {
    if (!name.startsWith('--font-weight-')) continue;
    weight[name.slice('--font-weight-'.length)] = value;
  }

  const spacingVar = vars.get('--spacing');
  const touchVar = roots.get('--touch-target-min');
  if (spacingVar === undefined || touchVar === undefined) {
    throw new Error('@tourism/tokens rn-theme: thiếu --spacing hoặc --touch-target-min');
  }

  return { type, weight, spacing: remToDp(spacingVar), touchTargetMin: pxToDp(touchVar) };
}
