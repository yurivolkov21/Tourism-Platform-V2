import { describe, expect, it } from 'vitest';
import { VOUCHER_PAGE_GUTTER, VOUCHER_PAGE_GUTTER_PX, VOUCHER_PHOTO_SIZES } from './voucher-layout';

/** Đọc `px-N` theo mốc ra px một bên (thang Tailwind: 1 đơn vị = 4px). */
function gutterPx(classes: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const token of classes.split(/\s+/)) {
    const match = /^(?:(md|lg|xl):)?px-(\d+)$/.exec(token);
    if (!match) throw new Error(`Lớp lề không đọc được: ${token}`);
    out[match[1] ?? 'base'] = Number(match[2]) * 4;
  }
  return out;
}

describe('voucher-layout — lề trang và `sizes` ảnh bìa đi cùng nhau (G35)', () => {
  it('bảng số khớp đúng chuỗi lớp Tailwind của lề trang', () => {
    // Đổi lớp mà quên bảng số (hay ngược lại) thì `sizes` lệch bề rộng ô ảnh thật.
    expect(gutterPx(VOUCHER_PAGE_GUTTER)).toEqual(VOUCHER_PAGE_GUTTER_PX);
  });

  it('`sizes` giữ đúng các con số đã đo ở review P7C#12', () => {
    expect(VOUCHER_PHOTO_SIZES).toBe(
      '(min-width: 1536px) 758px, (min-width: 1280px) calc(100vw - 778px), (min-width: 1024px) calc(100vw - 274px), (min-width: 768px) calc(100vw - 210px), calc(100vw - 82px)',
    );
  });
});
