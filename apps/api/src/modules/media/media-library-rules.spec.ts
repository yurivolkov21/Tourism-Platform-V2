import { describe, expect, it } from 'vitest';
import {
  groupByPublicId,
  type MediaLibraryRow,
  mediaUpdateTags,
  mediaVersion,
  type OwnerInfo,
  ownerRef,
  ownersInLockOrder,
  rowsToWrite,
  toMediaItem,
} from './media-library-rules.js';

const ROOT = 'tourism';
const CLOUD = 'demo-cloud';
const TOUR_A = '0aaaa001-0000-4000-8000-000000000001';
const TOUR_B = '0aaaa001-0000-4000-8000-000000000002';
const DEST = '0bbbb001-0000-4000-8000-000000000001';
const POST = '0cccc001-0000-4000-8000-000000000001';
const SLOT = '0dddd001-0000-4000-8000-000000000001';
const LIB_ID = 'tourism/catalog/destination/hoi-an/1';

let seq = 0;
function row(extra: Partial<MediaLibraryRow> = {}): MediaLibraryRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    publicId: LIB_ID,
    ownerType: 'TOUR',
    ownerId: TOUR_A,
    role: 'gallery',
    sortOrder: 0,
    alt: 'Lanterns over the river',
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
    width: null,
    height: null,
    bytes: null,
    format: null,
    version: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...extra,
  };
}

const owners = new Map<string, OwnerInfo>([
  [ownerRef('TOUR', TOUR_A), { label: 'Hoi An by night', slug: 'hoi-an-by-night', key: null }],
  [ownerRef('TOUR', TOUR_B), { label: 'Central coast', slug: 'central-coast', key: null }],
  [ownerRef('DESTINATION', DEST), { label: 'Hoi An', slug: 'hoi-an', key: null }],
  [ownerRef('POST', POST), { label: 'A night market', slug: 'a-night-market', key: null }],
  [ownerRef('SITE', SLOT), { label: null, slug: null, key: 'home-hero' }],
]);
const ctx = { cloudName: CLOUD, rootFolder: ROOT, owners };

describe('mediaVersion — số dòng và updatedAt lớn nhất', () => {
  it('đổi khi một dòng được sửa hay khi thêm dòng', () => {
    const a = row({ updatedAt: new Date('2026-10-02T00:00:00.000Z') });
    const b = row({ updatedAt: new Date('2026-10-05T03:00:00.123Z') });
    expect(mediaVersion([a, b])).toBe('2:2026-10-05T03:00:00.123Z');
    expect(mediaVersion([a])).toBe('1:2026-10-02T00:00:00.000Z');
  });
});

describe('groupByPublicId — mỗi ảnh một nhóm, ảnh có dòng mới nhất lên trước', () => {
  it('nhóm theo publicId, sắp nhóm theo createdAt lớn nhất, trong nhóm theo createdAt', () => {
    const old = row({ publicId: 'tourism/catalog/tour/a', createdAt: new Date('2026-09-01') });
    const lib = row({ ownerType: 'DESTINATION', ownerId: DEST, createdAt: new Date('2026-09-02') });
    const borrow = row({ createdAt: new Date('2026-10-10') });
    const groups = groupByPublicId([old, borrow, lib]);
    expect(groups.map((group) => group.map((r) => r.id))).toEqual([[lib.id, borrow.id], [old.id]]);
  });
});

describe('toMediaItem', () => {
  const lib = row({
    ownerType: 'DESTINATION',
    ownerId: DEST,
    role: 'hero',
    width: 2400,
    height: 1600,
    bytes: 512_000,
    format: 'jpg',
    version: '1786000000',
    author: 'Jane Doe',
    license: 'CC BY-SA 4.0',
    createdAt: new Date('2026-09-01'),
  });
  const borrowA = row({ ownerId: TOUR_A, author: 'Jane Doe', license: 'CC BY-SA 4.0' });
  const borrowB = row({ ownerId: TOUR_B, author: 'Jane Doe', license: 'CC BY-SA 4.0' });

  it('số đo và version Cloudinary lấy từ dòng thư viện, chỗ dùng theo thứ tự hiển thị', () => {
    const item = toMediaItem([borrowA, lib, borrowB], ctx);
    expect(item).toMatchObject({
      publicId: LIB_ID,
      url: `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/v1786000000/${LIB_ID}`,
      width: 2400,
      height: 1600,
      bytes: 512_000,
      format: 'jpg',
      alt: 'Lanterns over the river',
      altVaries: false,
      altRequired: true,
      creditVaries: false,
      creditVariants: [],
      source: 'CATALOG',
    });
    expect(item.usages.map((usage) => [usage.ownerType, usage.label])).toEqual([
      ['DESTINATION', 'Hoi An'],
      ['TOUR', 'Central coast'],
      ['TOUR', 'Hoi An by night'],
    ]);
    expect(item.version).toBe(mediaVersion([borrowA, lib, borrowB]));
    // CC BY-SA thiếu link giấy phép.
    expect(item.attention).toEqual(['CREDIT_INCOMPLETE']);
  });

  it('dòng lệch: giá trị của dòng thư viện, cờ lệch và mọi bản ghi công', () => {
    const odd = { ...borrowA, alt: 'Another alt', author: 'J. Doe' };
    const item = toMediaItem([odd, lib, borrowB], ctx);
    expect(item.alt).toBe('Lanterns over the river');
    expect(item.altVaries).toBe(true);
    expect(item.author).toBe('Jane Doe');
    expect(item.creditVaries).toBe(true);
    expect(item.creditVariants.map((credit) => credit.author)).toEqual(['Jane Doe', 'J. Doe']);
  });

  it('không có dòng thư viện: lấy dòng cũ nhất; khe trả khoá, không nhãn', () => {
    const slot = row({
      ownerType: 'SITE',
      ownerId: SLOT,
      role: 'hero',
      alt: null,
      publicId: 'tourism/catalog/site/home-hero',
      createdAt: new Date('2026-09-01'),
    });
    const post = row({
      ownerType: 'POST',
      ownerId: POST,
      alt: 'Stalls at dusk',
      publicId: 'tourism/catalog/site/home-hero',
      createdAt: new Date('2026-09-05'),
    });
    const item = toMediaItem([post, slot], ctx);
    expect(item.alt).toBeNull();
    expect(item.altVaries).toBe(true);
    // Chỉ bài viết và khe: alt trống là ảnh trang trí.
    expect(item.altRequired).toBe(false);
    expect(item.attention).toEqual([]);
    expect(item.usages).toEqual([
      expect.objectContaining({
        ownerType: 'POST',
        label: 'A night market',
        slug: 'a-night-market',
      }),
      expect.objectContaining({ ownerType: 'SITE', label: null, slug: null, key: 'home-hero' }),
    ]);
  });

  it('alt bắt buộc mà một dòng tour trống: MISSING_ALT', () => {
    const item = toMediaItem([lib, { ...borrowA, alt: null }], ctx);
    expect(item.attention).toContain('MISSING_ALT');
  });

  it('ảnh trong vùng tải lên là UPLOAD; chủ đã xoá thì nhãn và slug null', () => {
    const publicId = `tourism/tours/${TOUR_A}/5f0c2b1e-9d3a-4c7b-8e21-6a4f0d9b7c13`;
    const gone = '0aaaa001-0000-4000-8000-0000000000ff';
    const item = toMediaItem([row({ publicId }), row({ publicId, ownerId: gone })], ctx);
    expect(item.source).toBe('UPLOAD');
    expect(item.usages.find((usage) => usage.ownerId === gone)).toMatchObject({
      label: null,
      slug: null,
    });
  });
});

describe('ownersInLockOrder — tour, điểm đến, bài viết, khe; trong mỗi loại theo id', () => {
  it('gộp trùng và sắp cố định bất kể thứ tự dòng', () => {
    const rows = [
      row({ ownerType: 'SITE', ownerId: SLOT }),
      row({ ownerType: 'TOUR', ownerId: TOUR_B }),
      row({ ownerType: 'POST', ownerId: POST }),
      row({ ownerType: 'DESTINATION', ownerId: DEST }),
      row({ ownerType: 'TOUR', ownerId: TOUR_A }),
      row({ ownerType: 'TOUR', ownerId: TOUR_B }),
    ];
    expect(ownersInLockOrder(rows)).toEqual([
      { ownerType: 'TOUR', ids: [TOUR_A, TOUR_B] },
      { ownerType: 'DESTINATION', ids: [DEST] },
      { ownerType: 'POST', ids: [POST] },
      { ownerType: 'SITE', ids: [SLOT] },
    ]);
  });

  it('loại không có dòng thì không có mặt', () => {
    expect(ownersInLockOrder([row({ ownerType: 'POST', ownerId: POST })])).toEqual([
      { ownerType: 'POST', ids: [POST] },
    ]);
  });
});

describe('rowsToWrite — chỉ dòng đang khác giá trị mới', () => {
  const values = {
    alt: 'Lanterns over the river',
    author: 'Jane Doe',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: null,
  };

  it('dòng đã đúng cả năm ô thì bỏ qua', () => {
    const same = row({ ...values });
    const differs = row({ ...values, licenseUrl: null });
    expect(rowsToWrite([same, differs], values)).toEqual([differs]);
    expect(rowsToWrite([same], values)).toEqual([]);
  });
});

describe('mediaUpdateTags — tag bust theo chủ đã đổi, gộp trùng', () => {
  it('tour, điểm đến (tours và trang tour gắn nó), bài viết, khe', () => {
    expect(
      mediaUpdateTags({
        tourSlugs: ['hoi-an-by-night'],
        destinationTourSlugs: [['hoi-an-by-night', 'central-coast']],
        postSlugs: ['a-night-market'],
        site: true,
      }),
    ).toEqual([
      'tours',
      'tour:hoi-an-by-night',
      'tour:central-coast',
      'posts',
      'post:a-night-market',
      'site-media',
    ]);
  });

  it('không chủ nào đổi thì không tag nào', () => {
    expect(
      mediaUpdateTags({ tourSlugs: [], destinationTourSlugs: [], postSlugs: [], site: false }),
    ).toEqual([]);
  });

  it('điểm đến không tour nào gắn vẫn bust tours (trang danh sách điểm đến)', () => {
    expect(
      mediaUpdateTags({ tourSlugs: [], destinationTourSlugs: [[]], postSlugs: [], site: false }),
    ).toEqual(['tours']);
  });
});
