import type { MediaItem } from '@tourism/contract';
import {
  orderTourPhotos,
  planTourPhotos,
  type StoredPhoto,
  toAdminTourPhoto,
  toLibraryPhoto,
} from './tour-photos.js';

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

describe('toLibraryPhoto', () => {
  it('chở ảnh cùng ghi công; bỏ những cột thư viện không cần', () => {
    expect(toLibraryPhoto(item({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' }))).toEqual({
      publicId: 'tourism/catalog/destination/hoi-an/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
      alt: 'Lanterns',
      width: 2400,
      height: 1600,
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
  });
});

const stored = (publicId: string, over: Partial<StoredPhoto> = {}): StoredPhoto => ({
  publicId,
  type: 'IMAGE',
  posterId: null,
  format: 'jpg',
  width: 2400,
  height: 1600,
  durationSec: null,
  bytes: 400000,
  version: '1600000000',
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
  ...over,
});
const UPLOAD = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
const mine = (name: string) => `tourism/tours/${TOUR}/${name}`;
const OTHER_TOUR = '7a1b2c3d-0000-4000-8000-000000000002';

describe('planTourPhotos (ADR-0048 §3, §6)', () => {
  const plan = (
    photos: { publicId: string; alt: string; upload?: typeof UPLOAD }[],
    current: StoredPhoto[] = [],
    library: StoredPhoto[] = [],
  ) =>
    planTourPhotos({
      tourId: TOUR,
      rootFolder: 'tourism',
      photos,
      current: new Map(current.map((row) => [row.publicId, row])),
      library: new Map(library.map((row) => [row.publicId, row])),
    });

  it('vị trí 0 là hero, còn lại gallery; sortOrder = vị trí; alt theo form', () => {
    const result = plan(
      [
        { publicId: 'lib/2', alt: 'Second' },
        { publicId: 'lib/1', alt: 'First' },
      ],
      [stored('lib/1'), stored('lib/2')],
    );
    expect(result.ok && result.rows.map((r) => [r.publicId, r.role, r.sortOrder, r.alt])).toEqual([
      ['lib/2', 'hero', 0, 'Second'],
      ['lib/1', 'gallery', 1, 'First'],
    ]);
  });

  it('giữ dòng cũ nguyên metadata và ghi công; `upload` gửi kèm dòng cũ bị bỏ qua', () => {
    const old = stored('lib/1', { version: '111', author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
    const result = plan([{ publicId: 'lib/1', alt: 'A', upload: UPLOAD }], [old]);
    expect(result.ok && result.rows[0]).toMatchObject({
      version: '111',
      width: 2400,
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
    // Ảnh tải lên ĐÃ lưu, nằm đúng thư mục của tour, gửi lại kèm `upload`: vẫn là
    // dòng cũ. Chỉ ca này phân biệt được thứ tự nguồn — `lib/1` ở trên nằm ngoài
    // thư mục tải lên nên đường "tải lên mới" vốn không nhận nó.
    const oldUpload = stored(mine('old'), { version: '222', width: 1800 });
    const again = plan([{ publicId: mine('old'), alt: 'B', upload: UPLOAD }], [oldUpload]);
    expect(again.ok && again.rows[0]).toMatchObject({ version: '222', width: 1800 });
  });

  it('ảnh tải lên MỚI: metadata từ upload, ghi công null', () => {
    const result = plan([{ publicId: mine('a'), alt: 'Mine', upload: UPLOAD }]);
    expect(result.ok && result.rows[0]).toMatchObject({
      publicId: mine('a'),
      version: '1759000000',
      width: 2000,
      height: 1333,
      bytes: 523000,
      format: 'jpg',
      author: null,
      license: null,
    });
  });

  it('ảnh thư viện: chép metadata và ghi công từ dòng địa danh', () => {
    const lib = stored('lib/9', {
      version: '999',
      author: 'A. B.',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    });
    const result = plan([{ publicId: 'lib/9', alt: 'Borrowed' }], [], [lib]);
    expect(result.ok && result.rows[0]).toMatchObject({
      version: '999',
      author: 'A. B.',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      alt: 'Borrowed',
    });
  });

  it('từ chối: thư mục tour khác, avatar, chuỗi bịa, ảnh tải lên thiếu metadata', () => {
    for (const photo of [
      { publicId: `tourism/tours/${OTHER_TOUR}/a`, alt: 'x', upload: UPLOAD },
      { publicId: 'tourism/avatars/u-1/a', alt: 'x', upload: UPLOAD },
      { publicId: 'somewhere/else', alt: 'x' },
      { publicId: mine('no-meta'), alt: 'x' },
    ]) {
      expect(plan([photo])).toEqual({ ok: false, rejected: photo.publicId });
    }
  });

  it('requeue CHỈ ảnh tải lên bị gỡ — ảnh thư viện gỡ ra không vào hàng dọn', () => {
    const result = plan(
      [{ publicId: mine('kept'), alt: 'Kept' }],
      [stored(mine('kept')), stored(mine('gone')), stored('lib/1')],
    );
    expect(result.ok && result.requeue).toEqual([mine('gone')]);
  });
});
