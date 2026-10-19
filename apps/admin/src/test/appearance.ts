import {
  type AdminSiteSlot,
  type AdminSiteSlotImage,
  AdminSiteSlotSchema,
  SITE_SLOT_KEYS,
  type SiteSlotKey,
} from '@tourism/contract';

/**
 * Fixture `AdminSiteSlot` DÙNG CHUNG cho các spec admin của Appearance — cùng nếp
 * `post-detail.ts`: contract thêm một field là sửa đúng một chỗ. Gốc là một khe đang dùng ẢNH
 * GỐC (đúng trạng thái production hôm sinh bảng ảnh gốc); ca test đè đúng thứ nó cần, rồi parse
 * qua schema để fixture lệch hình dạng đỏ ngay ở đây.
 */
export const SLOT_VERSION = '2026-10-19T03:00:00.000Z';
const CDN = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto';

export const originalId = (key: SiteSlotKey) => `tourism/catalog/site/${key}`;

export function slotImage(
  key: SiteSlotKey,
  patch: Partial<AdminSiteSlotImage> = {},
): AdminSiteSlotImage {
  const publicId = patch.publicId ?? originalId(key);
  return {
    publicId,
    url: `${CDN}/v1786681792/${publicId}`,
    type: 'IMAGE',
    posterUrl: null,
    alt: 'A city at sunrise',
    width: 2400,
    height: 1350,
    author: 'Unsplash contributor',
    license: 'Unsplash License',
    licenseUrl: null,
    sourceUrl: null,
    source: 'ORIGINAL',
    ...patch,
  };
}

export function siteSlotFixture(
  key: SiteSlotKey,
  patch: Partial<AdminSiteSlot> = {},
): AdminSiteSlot {
  return AdminSiteSlotSchema.parse({
    key,
    version: SLOT_VERSION,
    image: slotImage(key),
    original: {
      publicId: originalId(key),
      url: `${CDN}/v1786681792/${originalId(key)}`,
      alt: 'A city at sunrise',
      width: 2400,
      height: 1350,
    },
    ...patch,
  });
}

/** Cả 47 khe như `list` trả hôm nay: mọi khe dùng ảnh gốc. */
export function allSiteSlots(): AdminSiteSlot[] {
  return SITE_SLOT_KEYS.map((key) => siteSlotFixture(key));
}
