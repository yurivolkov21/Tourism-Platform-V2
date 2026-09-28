import type { MediaItem } from '@tourism/contract';
import { orderTourPhotos, toAdminTourPhoto } from './tour-photos.js';

const TOUR = '7a1b2c3d-0000-4000-8000-000000000001';

const item = (over: Partial<MediaItem>): MediaItem => ({
  publicId: 'tourism/catalog/destination/hoi-an/1',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
  type: 'IMAGE',
  role: 'gallery',
  posterUrl: null,
  width: 2400,
  height: 1600,
  alt: 'Lanterns',
  sortOrder: 1,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
  ...over,
});

describe('orderTourPhotos', () => {
  it('ảnh bìa đứng đầu bất kể sortOrder; gallery theo sortOrder tăng dần', () => {
    const hero = item({ publicId: 'h', role: 'hero', sortOrder: 9 });
    const second = item({ publicId: 'g2', sortOrder: 2 });
    const first = item({ publicId: 'g1', sortOrder: 1 });
    expect(orderTourPhotos([second, hero, first]).map((p) => p.publicId)).toEqual([
      'h',
      'g1',
      'g2',
    ]);
  });
});

describe('toAdminTourPhoto', () => {
  it('ảnh trong thư mục tải lên của tour là UPLOAD; còn lại là LIBRARY, giữ ghi công', () => {
    const upload = toAdminTourPhoto(
      item({ publicId: `tourism/tours/${TOUR}/abc`, author: null }),
      'tourism',
      TOUR,
    );
    const library = toAdminTourPhoto(
      item({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' }),
      'tourism',
      TOUR,
    );
    expect(upload.source).toBe('UPLOAD');
    expect(library).toEqual({
      publicId: 'tourism/catalog/destination/hoi-an/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
      alt: 'Lanterns',
      width: 2400,
      height: 1600,
      source: 'LIBRARY',
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
  });
});
