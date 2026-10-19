import type { AdminSiteSlotImageInput } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import type { StoredPhoto } from '../catalog/tour-photos.js';
import {
  nextSlotVersion,
  planSlotImage,
  slotImageSource,
  slotVersion,
  slotVersionMatches,
} from './appearance-rules.js';
import type { SiteSlotOriginal } from './site-slot-originals.js';

const ROOT = 'tourism';
const SLOT = '0dddd001-0000-4000-8000-000000000001';
const OTHER_SLOT = '0dddd001-0000-4000-8000-000000000002';

function photo(publicId: string, extra: Partial<StoredPhoto> = {}): StoredPhoto {
  return {
    publicId,
    type: 'IMAGE',
    posterId: null,
    format: 'jpg',
    width: 2400,
    height: 1600,
    durationSec: null,
    bytes: 500_000,
    version: '1786000000',
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
    ...extra,
  };
}

const ORIGINAL: SiteSlotOriginal = {
  ...photo('tourism/catalog/site/home-hero', {
    author: 'Unsplash contributor',
    license: 'Unsplash License',
    sourceUrl: 'https://images.unsplash.com/photo-1',
  }),
  alt: 'A city at sunrise',
};
const UPLOADED = `tourism/site/${SLOT}/f1`;
const UPLOAD_META = {
  version: '1790000000',
  width: 1800,
  height: 1200,
  format: 'webp',
  bytes: 1234,
};
const LIBRARY = photo('tourism/catalog/destination/hoi-an/1', {
  author: 'Jane',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
});

function plan(
  image: AdminSiteSlotImageInput,
  current: StoredPhoto | null,
  library: StoredPhoto | null = null,
) {
  return planSlotImage({
    slotId: SLOT,
    rootFolder: ROOT,
    image,
    current,
    original: ORIGINAL,
    library,
  });
}

describe('planSlotImage — bốn nguồn của một lần lưu (ADR-0059 §2)', () => {
  it('ảnh đang dùng: giữ cột, chỉ đổi alt, không vào hàng dọn', () => {
    const current = photo(UPLOADED, { width: 900 });
    const result = plan({ publicId: UPLOADED, alt: 'New alt' }, current);
    expect(result).toEqual({ ok: true, row: { ...current, alt: 'New alt' }, requeue: [] });
  });

  it('ảnh tải lên trong thư mục của khe, có metadata: ghi công trống, ảnh tải lên cũ vào hàng dọn', () => {
    const old = `tourism/site/${SLOT}/old`;
    const result = plan({ publicId: UPLOADED, alt: null, upload: UPLOAD_META }, photo(old));
    expect(result).toEqual({
      ok: true,
      row: {
        ...photo(UPLOADED),
        format: 'webp',
        width: 1800,
        height: 1200,
        bytes: 1234,
        version: '1790000000',
        alt: null,
      },
      requeue: [old],
    });
  });

  it('ảnh gốc: chép metadata và ghi công từ bảng, alt theo form', () => {
    const current = photo(UPLOADED);
    const result = plan({ publicId: ORIGINAL.publicId, alt: 'Edited' }, current);
    const { alt: _alt, ...stored } = ORIGINAL;
    expect(result).toEqual({ ok: true, row: { ...stored, alt: 'Edited' }, requeue: [UPLOADED] });
  });

  it('ảnh gốc lấp được khe chưa có ảnh nào (DB mới dựng)', () => {
    const result = plan({ publicId: ORIGINAL.publicId, alt: ORIGINAL.alt }, null);
    expect(result.ok && result.row.publicId).toBe(ORIGINAL.publicId);
    expect(result.ok && result.requeue).toEqual([]);
  });

  it('ảnh thư viện: server chép metadata và ghi công từ dòng thư viện; ảnh gốc cũ không vào hàng dọn', () => {
    const current = photo(ORIGINAL.publicId);
    const result = plan(
      { publicId: LIBRARY.publicId, alt: 'Hội An', upload: UPLOAD_META },
      current,
      LIBRARY,
    );
    expect(result).toEqual({ ok: true, row: { ...LIBRARY, alt: 'Hội An' }, requeue: [] });
  });

  it('từ chối ảnh lạ, ảnh tải lên của khe khác, ảnh tải lên thiếu metadata', () => {
    expect(plan({ publicId: 'tourism/catalog/tour/x', alt: null }, null)).toEqual({
      ok: false,
      rejected: 'tourism/catalog/tour/x',
    });
    const foreign = `tourism/site/${OTHER_SLOT}/f1`;
    expect(plan({ publicId: foreign, alt: null, upload: UPLOAD_META }, null)).toEqual({
      ok: false,
      rejected: foreign,
    });
    expect(plan({ publicId: UPLOADED, alt: null }, null)).toEqual({
      ok: false,
      rejected: UPLOADED,
    });
  });

  it('từ chối video trong thư viện và dòng thư viện không khớp publicId gửi lên', () => {
    const video = { ...LIBRARY, type: 'VIDEO' as const };
    expect(plan({ publicId: LIBRARY.publicId, alt: null }, null, video).ok).toBe(false);
    expect(plan({ publicId: 'tourism/x/y', alt: null }, null, LIBRARY).ok).toBe(false);
  });

  it('ảnh thư viện cũ bị thay không vào hàng dọn', () => {
    const result = plan({ publicId: ORIGINAL.publicId, alt: null }, LIBRARY);
    expect(result.ok && result.requeue).toEqual([]);
  });
});

describe('slotImageSource (ADR-0059 §2)', () => {
  const args = { rootFolder: ROOT, slotId: SLOT, originalPublicId: ORIGINAL.publicId };

  it('ảnh gốc, ảnh tải lên của khe, ảnh thư viện, còn lại là OTHER', () => {
    expect(slotImageSource(ORIGINAL.publicId, { ...args, inLibrary: false })).toBe('ORIGINAL');
    expect(slotImageSource(UPLOADED, { ...args, inLibrary: false })).toBe('UPLOAD');
    expect(slotImageSource(LIBRARY.publicId, { ...args, inLibrary: true })).toBe('LIBRARY');
    expect(slotImageSource(`tourism/site/${OTHER_SLOT}/f1`, { ...args, inLibrary: false })).toBe(
      'OTHER',
    );
  });
});

describe('phiên bản của khe (ADR-0059 §3)', () => {
  const created = new Date('2026-08-12T00:00:00.000Z');
  const saved = new Date('2026-10-19T03:00:00.123Z');

  it('list trả updatedAt dạng ISO, hoặc null khi khe chưa có dòng', () => {
    expect(slotVersion({ createdAt: created, updatedAt: saved })).toBe('2026-10-19T03:00:00.123Z');
    expect(slotVersion(null)).toBeNull();
  });

  it('null khớp dòng chưa từng được lưu (updatedAt = createdAt), không khớp dòng đã lưu', () => {
    expect(slotVersionMatches(null, { createdAt: created, updatedAt: created })).toBe(true);
    expect(slotVersionMatches(null, { createdAt: created, updatedAt: saved })).toBe(false);
  });

  it('phiên bản khác phải bằng đúng updatedAt', () => {
    const row = { createdAt: created, updatedAt: saved };
    expect(slotVersionMatches('2026-10-19T03:00:00.123Z', row)).toBe(true);
    expect(slotVersionMatches('2026-10-19T03:00:00.124Z', row)).toBe(false);
    expect(
      slotVersionMatches(created.toISOString(), { createdAt: created, updatedAt: created }),
    ).toBe(true);
  });

  it('phiên bản mới luôn lớn hơn phiên bản cũ, kể cả hai lần lưu trong một mili-giây', () => {
    expect(nextSlotVersion(saved, new Date('2026-10-19T03:00:05.000Z')).toISOString()).toBe(
      '2026-10-19T03:00:05.000Z',
    );
    expect(nextSlotVersion(saved, saved).getTime()).toBe(saved.getTime() + 1);
  });
});
