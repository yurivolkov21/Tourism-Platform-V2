import { isSiteSlotKey, REGIONS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { regionTheme, TILE_COUNT } from '@/lib/region-theme';
import { MOMENTS } from '@/mocks/moments';
import { TEAM } from '@/mocks/team';
import { regionSlotKey, siteMediaImages } from './site-media';

// Mock client oRPC — chỉ trả payload khe; không gọi API thật.
const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('./client', () => ({ api: { siteMedia: { list } } }));

beforeEach(() => {
  list.mockReset();
});

describe('khoá khe mà web ghép chuỗi đều có trong danh mục (ADR-0059 §1)', () => {
  it('mọi ô ảnh của ba trang vùng', () => {
    for (const region of REGIONS) {
      const count = TILE_COUNT[regionTheme(region.key).galleryVariant];
      for (let n = 1; n <= count; n += 1) {
        expect(regionSlotKey('gallery', region.key, n), `${region.key} ô ${n}`).not.toBeNull();
      }
      expect(regionSlotKey('gallery', region.key, count + 1)).toBeNull();
    }
  });

  it('mọi bưu thiếp của khối Signature, và chỉ chúng', () => {
    for (const region of REGIONS) {
      const copy = messages.regionPage.regions[region.key];
      const signature = 'signature' in copy ? copy.signature : null;
      const postcards = signature && 'postcards' in signature ? signature.postcards.length : 0;
      for (let n = 1; n <= postcards; n += 1) {
        expect(
          regionSlotKey('signature', region.key, n),
          `${region.key} thiếp ${n}`,
        ).not.toBeNull();
      }
      expect(regionSlotKey('signature', region.key, postcards + 1)).toBeNull();
    }
  });

  it('khoá trong mock khoảnh khắc và mock Team', () => {
    for (const { slot } of [...MOMENTS, ...TEAM]) expect(isSiteSlotKey(slot), slot).toBe(true);
  });
});

describe('siteMediaImages', () => {
  it('trả ảnh đầu của khe có ảnh, null cho khe vắng', async () => {
    const photo = { publicId: 'tourism/catalog/site/why-food', url: 'https://img.test/a.jpg' };
    list.mockResolvedValue([{ key: 'why-food', media: [photo, { publicId: 'x' }] }]);

    await expect(siteMediaImages(['why-food', 'why-river'])).resolves.toEqual({
      'why-food': photo,
      'why-river': null,
    });
  });
});
