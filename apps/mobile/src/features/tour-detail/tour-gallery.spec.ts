import type { MediaItem } from '@tourism/contract';
import { tourGallery } from './tour-gallery';

function media(overrides: Partial<MediaItem>): MediaItem {
  return {
    publicId: 'p',
    url: 'https://example.com/a.jpg',
    type: 'IMAGE',
    role: 'gallery',
    posterUrl: null,
    width: null,
    height: null,
    alt: null,
    sortOrder: 0,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
    ...overrides,
  };
}

describe('tourGallery', () => {
  it('ảnh hero lên đầu BẤT KỂ sortOrder', () => {
    const result = tourGallery([
      media({ publicId: 'gallery-1', role: 'gallery', sortOrder: 0 }),
      media({ publicId: 'hero', role: 'hero', sortOrder: 5 }),
    ]);
    expect(result.map((m) => m.publicId)).toEqual(['hero', 'gallery-1']);
  });

  it('phần còn lại sắp theo sortOrder', () => {
    const result = tourGallery([
      media({ publicId: 'b', role: 'gallery', sortOrder: 2 }),
      media({ publicId: 'a', role: 'gallery', sortOrder: 1 }),
    ]);
    expect(result.map((m) => m.publicId)).toEqual(['a', 'b']);
  });

  it('bỏ type VIDEO và role avatar/body', () => {
    const result = tourGallery([
      media({ publicId: 'video', type: 'VIDEO', role: 'gallery' }),
      media({ publicId: 'avatar', role: 'avatar' }),
      media({ publicId: 'body', role: 'body' }),
      media({ publicId: 'keep', role: 'gallery' }),
    ]);
    expect(result.map((m) => m.publicId)).toEqual(['keep']);
  });

  it('không có hero: ảnh gallery đầu tiên (theo sortOrder) lên đầu', () => {
    const result = tourGallery([
      media({ publicId: 'b', role: 'gallery', sortOrder: 2 }),
      media({ publicId: 'a', role: 'gallery', sortOrder: 1 }),
    ]);
    expect(result[0]?.publicId).toBe('a');
  });
});
