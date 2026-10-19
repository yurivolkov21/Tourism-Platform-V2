import {
  type AdminMediaItem,
  AdminMediaItemSchema,
  type AdminMediaQueue,
  type AdminMediaQueueRow,
  AdminMediaQueueRowSchema,
  AdminMediaQueueSchema,
  type MediaUsage,
} from '@tourism/contract';

/**
 * Fixture DÙNG CHUNG cho các spec admin của Media library — cùng nếp `appearance.ts`: gốc là một
 * ảnh thư viện Hội An có hai tour mượn (ca phổ biến nhất ở production), ca test đè đúng thứ nó
 * cần, rồi parse qua schema để fixture lệch hình dạng đỏ ngay ở đây.
 */
export const MEDIA_VERSION = '3:2026-10-19T03:00:00.000Z';
const CDN = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto';
export const LIBRARY_ID = 'tourism/catalog/destination/hoi-an/1';

const TOUR_A = '0aaaa001-0000-4000-8000-000000000001';
const TOUR_B = '0aaaa001-0000-4000-8000-000000000002';
const DEST = '0bbbb001-0000-4000-8000-000000000001';
const POST = '0cccc001-0000-4000-8000-000000000001';
const SLOT = '0dddd001-0000-4000-8000-000000000001';

const usage = (patch: Partial<MediaUsage> & Pick<MediaUsage, 'ownerType'>): MediaUsage => ({
  ownerId: TOUR_A,
  label: null,
  slug: null,
  key: null,
  role: 'gallery',
  sortOrder: 0,
  alt: 'Lanterns over the river',
  ...patch,
});

export const USAGES = {
  library: usage({ ownerType: 'DESTINATION', ownerId: DEST, label: 'Hoi An', slug: 'hoi-an' }),
  tourA: usage({
    ownerType: 'TOUR',
    ownerId: TOUR_A,
    label: 'Hoi An by night',
    slug: 'hoi-an-by-night',
    role: 'hero',
  }),
  tourB: usage({
    ownerType: 'TOUR',
    ownerId: TOUR_B,
    label: 'Central coast',
    slug: 'central-coast',
    sortOrder: 3,
  }),
  post: usage({
    ownerType: 'POST',
    ownerId: POST,
    label: 'A night market',
    slug: 'a-night-market',
    role: 'hero',
    alt: null,
  }),
  slot: usage({ ownerType: 'SITE', ownerId: SLOT, key: 'home-hero', role: 'hero', alt: null }),
};

export function mediaItem(patch: Partial<AdminMediaItem> = {}): AdminMediaItem {
  const publicId = patch.publicId ?? LIBRARY_ID;
  return AdminMediaItemSchema.parse({
    publicId,
    url: `${CDN}/v1786000000/${publicId}`,
    width: 2400,
    height: 1600,
    bytes: 524_288,
    format: 'jpg',
    alt: 'Lanterns over the river',
    altVaries: false,
    altRequired: true,
    author: 'Jane Doe',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hoi_An.jpg',
    creditVaries: false,
    creditVariants: [],
    source: 'CATALOG',
    usages: [USAGES.library, USAGES.tourB, USAGES.tourA],
    attention: [],
    version: MEDIA_VERSION,
    ...patch,
  });
}

export function queueRow(patch: Partial<AdminMediaQueueRow> = {}): AdminMediaQueueRow {
  const publicId = patch.publicId ?? `tourism/tours/${TOUR_A}/5f0c2b1e-9d3a-4c7b-8e21-6a4f0d9b7c13`;
  return AdminMediaQueueRowSchema.parse({
    publicId,
    url: `${CDN}/${publicId}`,
    zone: 'TOUR',
    ownerLabel: 'Hoi An by night',
    ownerSlug: 'hoi-an-by-night',
    slotKey: null,
    ownerDeleted: false,
    state: 'WAITING',
    queuedAt: '2026-10-14T07:47:00.000Z',
    dueAt: '2026-10-21T07:47:00.000Z',
    attempts: 0,
    ...patch,
  });
}

export function mediaQueue(patch: Partial<AdminMediaQueue> = {}): AdminMediaQueue {
  return AdminMediaQueueSchema.parse({
    gcEnabled: true,
    graceDays: 7,
    lastSweep: {
      state: 'completed',
      startedAt: '2026-10-19T00:00:00.000Z',
      finishedAt: '2026-10-19T00:00:04.000Z',
      report: { resolved: 3, destroyed: 2, absent: 1, deferred: 2, failed: 0, refused: 1 },
    },
    rows: [queueRow()],
    ...patch,
  });
}
