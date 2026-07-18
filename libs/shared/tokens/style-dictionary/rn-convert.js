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
