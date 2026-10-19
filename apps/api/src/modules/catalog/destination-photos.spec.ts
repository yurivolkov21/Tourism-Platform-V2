import type { MediaItem } from '@tourism/contract';
import { planDestinationPhotos, toAdminDestinationPhoto } from './destination-photos.js';
import type { StoredPhoto } from './tour-photos.js';

const DEST = '0bbbb001-0000-4000-8000-000000000001';
const OTHER_DEST = '0bbbb001-0000-4000-8000-000000000002';
const TOUR = '7a1b2c3d-0000-4000-8000-000000000001';

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
const mine = (name: string) => `tourism/destinations/${DEST}/${name}`;
const CATALOG = 'tourism/catalog/destination/hoi-an/1';

const item = (over: Partial<MediaItem>): MediaItem => ({
  publicId: CATALOG,
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

describe('toAdminDestinationPhoto', () => {
  it('ảnh trong thư mục tải lên của chính điểm đến là UPLOAD, còn lại là CATALOG', () => {
    const used = new Map([[CATALOG, 3]]);
    expect(
      toAdminDestinationPhoto(item({ publicId: mine('a') }), 'tourism', DEST, used),
    ).toMatchObject({ source: 'UPLOAD', usedByTours: 0 });
    // Thư mục tải lên của điểm đến KHÁC không phải ảnh tải lên của điểm đến này.
    expect(
      toAdminDestinationPhoto(
        item({ publicId: `tourism/destinations/${OTHER_DEST}/a` }),
        'tourism',
        DEST,
        used,
      ).source,
    ).toBe('CATALOG');
  });

  it('chở ghi công và số tour đang mượn ảnh; bỏ những cột trang không cần', () => {
    const used = new Map([[CATALOG, 3]]);
    expect(
      toAdminDestinationPhoto(
        item({ author: 'J. Nguyen', license: 'CC BY-SA 4.0', licenseUrl: 'https://x.test/l' }),
        'tourism',
        DEST,
        used,
      ),
    ).toEqual({
      publicId: CATALOG,
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
      alt: 'Lanterns',
      width: 2400,
      height: 1600,
      source: 'CATALOG',
      usedByTours: 3,
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
  });
});

describe('planDestinationPhotos (ADR-0060 §8)', () => {
  const plan = (
    photos: { publicId: string; alt: string; upload?: typeof UPLOAD }[],
    current: StoredPhoto[] = [],
  ) =>
    planDestinationPhotos({
      destinationId: DEST,
      rootFolder: 'tourism',
      photos,
      current: new Map(current.map((row) => [row.publicId, row])),
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

  it('giữ dòng cũ nguyên metadata và ghi công, kể cả khi form gửi kèm `upload`', () => {
    const old = stored(CATALOG, { version: '111', author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
    const result = plan([{ publicId: CATALOG, alt: 'A', upload: UPLOAD }], [old]);
    expect(result.ok && result.rows[0]).toMatchObject({
      version: '111',
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
    // Ảnh tải lên ĐÃ lưu gửi lại kèm `upload`: vẫn là dòng cũ — dòng đang có xét trước.
    const saved = stored(mine('old'), { version: '222', width: 1800, author: 'Admin fixed' });
    const again = plan([{ publicId: mine('old'), alt: 'B', upload: UPLOAD }], [saved]);
    expect(again.ok && again.rows[0]).toMatchObject({
      version: '222',
      width: 1800,
      author: 'Admin fixed',
    });
  });

  it('ảnh tải lên MỚI: metadata từ upload, ghi công trống — điền sau ở /media', () => {
    const result = plan([{ publicId: mine('a'), alt: 'Mine', upload: UPLOAD }]);
    expect(result.ok && result.rows[0]).toMatchObject({
      publicId: mine('a'),
      type: 'IMAGE',
      version: '1759000000',
      width: 2000,
      height: 1333,
      bytes: 523000,
      format: 'jpg',
      author: null,
      license: null,
      licenseUrl: null,
      sourceUrl: null,
      role: 'hero',
    });
  });

  it('từ chối: ảnh catalog không còn dòng, điểm đến khác, thư mục tour, ảnh thiếu metadata', () => {
    for (const photo of [
      { publicId: CATALOG, alt: 'x' },
      { publicId: `tourism/destinations/${OTHER_DEST}/a`, alt: 'x', upload: UPLOAD },
      { publicId: `tourism/tours/${TOUR}/a`, alt: 'x', upload: UPLOAD },
      { publicId: 'tourism/destinations/hero/a', alt: 'x', upload: UPLOAD },
      { publicId: mine('no-meta'), alt: 'x' },
    ]) {
      expect(plan([photo])).toEqual({ ok: false, rejected: photo.publicId });
    }
  });

  it('một ảnh lạ là từ chối cả lệnh, kể cả khi các ảnh khác hợp lệ', () => {
    expect(
      plan(
        [
          { publicId: CATALOG, alt: 'Kept' },
          { publicId: 'somewhere/else', alt: 'x' },
        ],
        [stored(CATALOG)],
      ),
    ).toEqual({ ok: false, rejected: 'somewhere/else' });
  });

  it('requeue CHỈ ảnh tải lên của điểm đến bị gỡ — ảnh catalog gỡ ra không vào hàng dọn', () => {
    const result = plan(
      [{ publicId: mine('kept'), alt: 'Kept' }],
      [stored(mine('kept')), stored(mine('gone')), stored(CATALOG)],
    );
    expect(result.ok && result.requeue).toEqual([mine('gone')]);
  });

  it('danh sách rỗng: không dòng nào, mọi ảnh tải lên vào lại hàng dọn', () => {
    const result = plan([], [stored(mine('a')), stored(CATALOG)]);
    expect(result).toEqual({ ok: true, rows: [], requeue: [mine('a')] });
  });
});
