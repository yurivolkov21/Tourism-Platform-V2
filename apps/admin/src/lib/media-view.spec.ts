import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { LIBRARY_ID, MEDIA_VERSION, mediaItem, mediaQueue, queueRow, USAGES } from '@/test/media';
import {
  filterMedia,
  formatBytes,
  mediaStats,
  queueSummary,
  toMediaItemVM,
  toMediaStatCards,
  toQueueRowVM,
} from './media-view';

const t = messages.admin.media;

describe('toMediaItemVM — ô ảnh và ngăn chi tiết', () => {
  it('thu nhỏ rộng 320, tóm tắt chỗ dùng, tên file, số đo', () => {
    const vm = toMediaItemVM(mediaItem());
    expect(vm).toMatchObject({
      publicId: LIBRARY_ID,
      fileName: '1',
      thumbUrl: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v1786000000/${LIBRARY_ID}`,
      name: 'Lanterns over the river',
      summary: 'Library · 2 tours',
      uploaded: false,
      sourceLabel: 'Catalogue',
      sizeLabel: '2400 × 1600 px',
      bytesLabel: '512 KB',
      formatLabel: 'JPG',
      needsAttention: false,
      noCredit: false,
      version: MEDIA_VERSION,
    });
  });

  it('mỗi chỗ dùng một dòng có link tới trình sửa; khe lấy nhãn của Appearance', () => {
    const vm = toMediaItemVM(
      mediaItem({ usages: [USAGES.library, USAGES.tourA, USAGES.post, USAGES.slot] }),
    );
    expect(vm.usages.map((usage) => [usage.kind, usage.name, usage.href, usage.note])).toEqual([
      ['Library', 'Hoi An', '/destinations/hoi-an/photos', null],
      ['Tour', 'Hoi An by night', '/tours/hoi-an-by-night/photos', 'Cover'],
      ['Post', 'A night market', '/posts/a-night-market', 'Cover'],
      ['Site', 'Home · Hero', '/appearance#home-hero', null],
    ]);
    expect(vm.summary).toBe('Library · 1 tour · 1 post · 1 site slot');
  });

  it('chủ đã xoá: tên "Deleted tour", không link', () => {
    const gone = { ...USAGES.tourB, label: null, slug: null };
    const vm = toMediaItemVM(mediaItem({ usages: [USAGES.library, gone] }));
    expect(vm.usages[1]).toMatchObject({ name: t.deletedOwner.TOUR, href: null, deleted: true });
  });

  it('alt trống: tên thay thế; ảnh tải lên mang nhãn Uploaded; thiếu số đo thì nói rõ', () => {
    const vm = toMediaItemVM(
      mediaItem({
        alt: null,
        altRequired: false,
        source: 'UPLOAD',
        width: null,
        height: null,
        bytes: null,
        format: null,
        usages: [USAGES.post],
      }),
    );
    expect(vm).toMatchObject({
      name: t.untitled,
      uploaded: true,
      sourceLabel: 'Uploaded',
      sizeLabel: t.drawer.sizeUnknown,
      bytesLabel: null,
      formatLabel: null,
    });
  });

  it('không tác giả, giấy phép, link nào là "No credit info"', () => {
    const vm = toMediaItemVM(
      mediaItem({ author: null, license: null, licenseUrl: null, sourceUrl: null }),
    );
    expect(vm.noCredit).toBe(true);
  });
});

describe('formatBytes', () => {
  it('B, KB tròn, MB một chữ số lẻ', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(524_288)).toBe('512 KB');
    expect(formatBytes(3_355_443)).toBe('3.2 MB');
  });
});

describe('filterMedia — Used in, Show, ô tìm', () => {
  const library = toMediaItemVM(mediaItem());
  const post = toMediaItemVM(
    mediaItem({
      publicId: 'tourism/posts/0cccc001-0000-4000-8000-000000000001/cover-file',
      alt: 'Stalls at dusk',
      altRequired: false,
      author: null,
      license: null,
      licenseUrl: null,
      sourceUrl: null,
      usages: [USAGES.post],
    }),
  );
  const flagged = toMediaItemVM(
    mediaItem({
      publicId: 'tourism/catalog/site/home-hero',
      alt: 'Ha Long at sunrise',
      altRequired: false,
      licenseUrl: null,
      attention: ['CREDIT_INCOMPLETE'],
      usages: [USAGES.slot],
    }),
  );
  const all = [library, post, flagged];
  const ids = (items: typeof all) => items.map((item) => item.publicId);

  it('không lọc gì: giữ nguyên thứ tự', () => {
    expect(ids(filterMedia(all, { tab: 'inUse' }))).toEqual(ids(all));
  });

  it('Used in theo loại chủ', () => {
    expect(ids(filterMedia(all, { tab: 'inUse', used: 'tours' }))).toEqual([library.publicId]);
    expect(ids(filterMedia(all, { tab: 'inUse', used: 'library' }))).toEqual([library.publicId]);
    expect(ids(filterMedia(all, { tab: 'inUse', used: 'posts' }))).toEqual([post.publicId]);
    expect(ids(filterMedia(all, { tab: 'inUse', used: 'site' }))).toEqual([flagged.publicId]);
  });

  it('Show: cần chú ý, không thông tin nguồn', () => {
    expect(ids(filterMedia(all, { tab: 'inUse', show: 'attention' }))).toEqual([flagged.publicId]);
    expect(ids(filterMedia(all, { tab: 'inUse', show: 'nocredit' }))).toEqual([post.publicId]);
  });

  it('ô tìm: alt, tác giả, tên file, tên chỗ dùng; không phân biệt hoa thường và dấu', () => {
    const search = (term: string) => ids(filterMedia(all, { tab: 'inUse', search: term }));
    expect(search('STALLS')).toEqual([post.publicId]);
    expect(search('jane')).toEqual([library.publicId, flagged.publicId]);
    expect(search('cover-file')).toEqual([post.publicId]);
    expect(search('central coast')).toEqual([library.publicId]);
    expect(search('Home · Hero')).toEqual([flagged.publicId]);
    expect(search('Hội An')).toEqual([library.publicId]);
  });
});

describe('mediaStats — ba số đầu trang', () => {
  it('số ảnh, số cần chú ý, số đang chờ xoá', () => {
    const items = [
      toMediaItemVM(mediaItem()),
      toMediaItemVM(mediaItem({ publicId: 'a/b', attention: ['MISSING_ALT'], alt: null })),
    ];
    const queue = mediaQueue({
      rows: [queueRow(), queueRow({ state: 'IN_USE', dueAt: null }), queueRow()],
    });
    expect(mediaStats(items, queue)).toEqual({ photos: 2, attention: 1, waiting: 2 });
  });
});

describe('toMediaStatCards', () => {
  it('ba thẻ ảnh chụp, không thẻ nào có pill; chú thích đổi theo số', () => {
    const cards = toMediaStatCards({ photos: 241, attention: 3, waiting: 0 }, 7);
    expect(cards.map((card) => [card.key, card.value, card.caption])).toEqual([
      ['photos', '241', t.stats.photosCaption],
      ['attention', '3', t.stats.attentionSome],
      ['waiting', '0', t.stats.waitingNone],
    ]);
    expect(cards.every((card) => card.callout === undefined && card.delta === undefined)).toBe(
      true,
    );
    expect(toMediaStatCards({ photos: 1, attention: 0, waiting: 2 }, 7)[1]?.caption).toBe(
      t.stats.attentionNone,
    );
    expect(toMediaStatCards({ photos: 1, attention: 0, waiting: 2 }, 7)[2]?.caption).toBe(
      t.stats.waitingSome(7),
    );
  });
});

describe('toQueueRowVM — chủ, trạng thái, ngày', () => {
  it('ảnh tour đang chờ: link tab Photos, ngày tới hạn', () => {
    expect(toQueueRowVM(queueRow())).toMatchObject({
      kind: 'Tour',
      owner: 'Hoi An by night',
      ownerHref: '/tours/hoi-an-by-night/photos',
      stateLabel: 'Deleted after 21 Oct 2026, 07:47 UTC',
      queuedLabel: '14 Oct 2026, 07:47 UTC',
      thumbUrl: expect.stringContaining('/f_auto,q_auto,w_160/'),
      avatar: false,
    });
  });

  it('bốn trạng thái mang đúng nhãn', () => {
    expect(toQueueRowVM(queueRow({ state: 'IN_USE', dueAt: null })).stateLabel).toBe(
      t.queue.state.IN_USE,
    );
    expect(toQueueRowVM(queueRow({ state: 'GAVE_UP', dueAt: null, attempts: 5 })).stateLabel).toBe(
      t.queue.state.GAVE_UP,
    );
    expect(
      toQueueRowVM(queueRow({ state: 'REFUSED', zone: null, dueAt: null, ownerLabel: null })),
    ).toMatchObject({
      stateLabel: t.queue.state.REFUSED,
      kind: t.queue.outsideZone,
      owner: t.queue.noOwner,
      ownerHref: null,
    });
  });

  it('chủ đã xoá; khe theo nhãn Appearance; review theo mã booking; avatar giấu hết', () => {
    expect(
      toQueueRowVM(queueRow({ ownerDeleted: true, ownerLabel: null, ownerSlug: null })),
    ).toMatchObject({ owner: t.deletedOwner.TOUR, ownerHref: null });
    expect(
      toQueueRowVM(
        queueRow({ zone: 'SITE', ownerLabel: null, ownerSlug: null, slotKey: 'cta-band' }),
      ),
    ).toMatchObject({ owner: 'Home · Closing banner', ownerHref: '/appearance#cta-band' });
    // Ảnh tải lên của điểm đến (Media B): link tới trang Photos của nó.
    expect(
      toQueueRowVM(queueRow({ zone: 'DESTINATION', ownerLabel: 'Hoi An', ownerSlug: 'hoi-an' })),
    ).toMatchObject({ owner: 'Hoi An', ownerHref: '/destinations/hoi-an/photos' });
    expect(
      toQueueRowVM(queueRow({ zone: 'REVIEW', ownerLabel: 'BK-5YU9J339', ownerSlug: null })),
    ).toMatchObject({ owner: 'Booking BK-5YU9J339', ownerHref: '/bookings/BK-5YU9J339' });
    expect(
      toQueueRowVM(queueRow({ zone: 'AVATAR', url: null, ownerLabel: null, ownerSlug: null })),
    ).toMatchObject({ kind: 'Customer avatar', owner: 'Customer', thumbUrl: null, avatar: true });
  });
});

describe('queueSummary — dọn bật hay tắt, lượt dọn gần nhất', () => {
  it('đang bật: số ngày ân hạn và báo cáo lượt cuối', () => {
    expect(queueSummary(mediaQueue())).toEqual({
      status: t.queue.on(7),
      last: 'Last cleanup 19 Oct 2026, 00:00 UTC: 3 deleted, 3 kept, 0 failed.',
    });
  });

  it('môi trường tắt GC nói thẳng không xoá gì', () => {
    expect(queueSummary(mediaQueue({ gcEnabled: false, lastSweep: null }))).toEqual({
      status: t.queue.off,
      last: t.queue.lastNone,
    });
  });

  it('job chạy trước bản này (không báo cáo), hỏng, đang chạy', () => {
    const sweep = {
      state: 'completed' as const,
      startedAt: '2026-10-18T00:00:00.000Z',
      finishedAt: '2026-10-18T00:00:02.000Z',
      report: null,
    };
    expect(queueSummary(mediaQueue({ lastSweep: sweep })).last).toBe(
      t.queue.lastDoneNoReport('18 Oct 2026, 00:00 UTC'),
    );
    expect(queueSummary(mediaQueue({ lastSweep: { ...sweep, state: 'failed' } })).last).toBe(
      t.queue.lastFailed('18 Oct 2026, 00:00 UTC'),
    );
    expect(
      queueSummary(mediaQueue({ lastSweep: { ...sweep, state: 'active', finishedAt: null } })).last,
    ).toBe(t.queue.lastRunning('18 Oct 2026, 00:00 UTC'));
    expect(
      queueSummary(
        mediaQueue({
          lastSweep: { ...sweep, state: 'created', startedAt: null, finishedAt: null },
        }),
      ).last,
    ).toBe(t.queue.lastQueued);
  });
});
