import { describe, expect, it } from 'vitest';
import { GC_MAX_ATTEMPTS } from './media-garbage.js';
import {
  type GarbageRow,
  parseSweepOutput,
  parseUploadZone,
  queueRowState,
  toQueueRow,
} from './media-queue-rules.js';

const ROOT = 'tourism';
const CLOUD = 'demo-cloud';
const TOUR = '0aaaa001-0000-4000-8000-000000000001';
const POST = '0cccc001-0000-4000-8000-000000000001';
const SLOT = '0dddd001-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-0000000000aa';
const FILE = '5f0c2b1e-9d3a-4c7b-8e21-6a4f0d9b7c13';

describe('parseUploadZone — vùng và chủ từ đường dẫn', () => {
  it('sáu thư mục ký upload thành sáu vùng', () => {
    expect(parseUploadZone(ROOT, `tourism/tours/${TOUR}/${FILE}`)).toEqual({
      zone: 'TOUR',
      owner: TOUR,
    });
    expect(parseUploadZone(ROOT, `tourism/posts/${POST}/${FILE}`)?.zone).toBe('POST');
    expect(parseUploadZone(ROOT, `tourism/site/${SLOT}/${FILE}`)?.zone).toBe('SITE');
    expect(parseUploadZone(ROOT, `tourism/reviews/BK-5YU9J339/${FILE}`)).toEqual({
      zone: 'REVIEW',
      owner: 'BK-5YU9J339',
    });
    expect(parseUploadZone(ROOT, `tourism/avatars/${USER}/${FILE}`)?.zone).toBe('AVATAR');
    expect(parseUploadZone(ROOT, `tourism/destinations/${TOUR}/${FILE}`)).toEqual({
      zone: 'DESTINATION',
      owner: TOUR,
    });
  });

  it('ngoài vùng tải lên thì null', () => {
    expect(parseUploadZone(ROOT, 'tourism/catalog/tour/ha-long-hero')).toBeNull();
    expect(parseUploadZone(ROOT, 'tourism/tours/hero/abc')).toBeNull();
  });
});

describe('queueRowState — cùng thứ tự sweep xét', () => {
  it('ngoài vùng trước mọi thứ, kể cả khi còn dùng', () => {
    expect(queueRowState({ inZone: false, attempts: 0, inUse: true })).toBe('REFUSED');
    expect(queueRowState({ inZone: false, attempts: GC_MAX_ATTEMPTS, inUse: false })).toBe(
      'REFUSED',
    );
  });

  it('chạm trần lượt thử thì bỏ cuộc, dù còn dùng hay không', () => {
    expect(queueRowState({ inZone: true, attempts: GC_MAX_ATTEMPTS, inUse: true })).toBe('GAVE_UP');
    expect(queueRowState({ inZone: true, attempts: GC_MAX_ATTEMPTS - 1, inUse: false })).toBe(
      'WAITING',
    );
  });

  it('còn dùng thì giữ, còn lại thì chờ', () => {
    expect(queueRowState({ inZone: true, attempts: 0, inUse: true })).toBe('IN_USE');
    expect(queueRowState({ inZone: true, attempts: 2, inUse: false })).toBe('WAITING');
  });
});

describe('toQueueRow', () => {
  const owners = new Map([
    [`TOUR:${TOUR}`, { label: 'Hoi An by night', slug: 'hoi-an-by-night', key: null }],
    [`SITE:${SLOT}`, { label: null, slug: null, key: 'home-hero' as const }],
  ]);
  const ctx = {
    cloudName: CLOUD,
    rootFolder: ROOT,
    graceDays: 7,
    inUse: new Set<string>(),
    owners,
  };
  const queued = new Date('2026-10-14T07:47:00.000Z');
  const garbage = (publicId: string, extra: Partial<GarbageRow> = {}): GarbageRow => ({
    publicId,
    resourceType: 'image',
    attempts: 0,
    createdAt: queued,
    ...extra,
  });

  it('ảnh tour đang chờ: nhãn, slug, URL, ngày tới hạn = lúc xếp cộng số ngày ân hạn', () => {
    const publicId = `tourism/tours/${TOUR}/${FILE}`;
    expect(toQueueRow(garbage(publicId), ctx)).toEqual({
      publicId,
      url: `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${publicId}`,
      zone: 'TOUR',
      ownerLabel: 'Hoi An by night',
      ownerSlug: 'hoi-an-by-night',
      slotKey: null,
      ownerDeleted: false,
      state: 'WAITING',
      queuedAt: '2026-10-14T07:47:00.000Z',
      dueAt: '2026-10-21T07:47:00.000Z',
      attempts: 0,
    });
  });

  it('còn dùng: không có ngày tới hạn', () => {
    const publicId = `tourism/tours/${TOUR}/${FILE}`;
    const row = toQueueRow(garbage(publicId), { ...ctx, inUse: new Set([publicId]) });
    expect(row).toMatchObject({ state: 'IN_USE', dueAt: null });
  });

  it('chủ uuid không còn trong DB: ghi đã xoá, không nhãn', () => {
    const gone = '0aaaa001-0000-4000-8000-0000000000ff';
    expect(toQueueRow(garbage(`tourism/tours/${gone}/${FILE}`), ctx)).toMatchObject({
      zone: 'TOUR',
      ownerLabel: null,
      ownerSlug: null,
      ownerDeleted: true,
    });
  });

  it('khe: khoá của khe; review: mã booking làm nhãn', () => {
    expect(toQueueRow(garbage(`tourism/site/${SLOT}/${FILE}`), ctx)).toMatchObject({
      zone: 'SITE',
      slotKey: 'home-hero',
      ownerDeleted: false,
    });
    expect(toQueueRow(garbage(`tourism/reviews/BK-5YU9J339/${FILE}`), ctx)).toMatchObject({
      zone: 'REVIEW',
      ownerLabel: 'BK-5YU9J339',
      ownerDeleted: false,
    });
  });

  it('avatar: không URL, không danh tính', () => {
    expect(toQueueRow(garbage(`tourism/avatars/${USER}/${FILE}`), ctx)).toMatchObject({
      zone: 'AVATAR',
      url: null,
      ownerLabel: null,
      ownerSlug: null,
      ownerDeleted: false,
    });
  });

  it('ngoài vùng: REFUSED, không vùng, không ngày tới hạn; video dựng URL video', () => {
    expect(
      toQueueRow(
        garbage('tourism/catalog/site/about-cta', { resourceType: 'video', attempts: 5 }),
        ctx,
      ),
    ).toMatchObject({
      zone: null,
      state: 'REFUSED',
      dueAt: null,
      url: expect.stringContaining('/video/upload/'),
    });
  });
});

describe('parseSweepOutput — output job media-gc', () => {
  it('đúng hình SweepReport thì nhận', () => {
    const report = { resolved: 2, destroyed: 1, absent: 1, deferred: 3, failed: 0, refused: 0 };
    expect(parseSweepOutput(report)).toEqual(report);
  });

  it('job cũ (output rỗng) hay hình lạ thì null', () => {
    expect(parseSweepOutput(null)).toBeNull();
    expect(parseSweepOutput({})).toBeNull();
    expect(parseSweepOutput({ value: 1 })).toBeNull();
    expect(parseSweepOutput('done')).toBeNull();
  });
});
