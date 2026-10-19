import {
  type AdminSiteSlot,
  type AdminSiteSlotImage,
  isSiteImageSlotKey,
  REGIONS,
  type RegionKey,
  type SiteImageSlotKey,
  type SiteSlotFrame,
  type SiteSlotImageSource,
  type SiteSlotKey,
  siteSlot,
  siteSlotsByGroup,
} from '@tourism/contract';
import { aboutPage, homePage, messages } from '@tourism/i18n';
import { withDeliveryTransform } from './cloudinary-url';
import { sitePageUrl } from './site';

/**
 * Mapper hiển thị của `/appearance` (spec P4f Appearance §6, ADR-0059) — THUẦN, ngoài React nên
 * test được từng nhánh. Nhóm, khung và đường dẫn đọc ở danh mục `SITE_SLOTS` của contract; API
 * chỉ trả trạng thái của từng khe (ảnh đang dùng, phiên bản, ảnh gốc).
 */
const t = messages.admin.appearance;

/** Ô thẻ khe: khung desktop thu vào hộp này (px CSS) — vừa thẻ hẹp nhất của lưới ở khổ 390. */
export const CARD_PREVIEW_BOX = [256, 160] as const;
/** Hai khung xem trước trong hộp Replace. Khung điện thoại đứng nên hộp của nó hẹp mà cao. */
export const DIALOG_PREVIEW_BOX = { desktop: [288, 180], phone: [120, 180] } as const;

/**
 * Khung `[rộng, cao]` thu nhỏ vừa hộp, GIỮ tỉ lệ — khung xem trước cắt ảnh bằng `object-fit:
 * cover` căn giữa y như web, nên tỉ lệ khung là thứ duy nhất phải đúng. Không phóng to khung nhỏ
 * hơn hộp: khung 175×131 của khoảnh khắc nhỏ vẫn là 175×131.
 */
export function fitFrame(
  frame: SiteSlotFrame,
  box: readonly [number, number],
): [width: number, height: number] {
  const [width, height] = frame;
  const scale = Math.min(1, box[0] / width, box[1] / height);
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

/**
 * Bề rộng khung lớn nhất của khe khi ảnh HẸP hơn nó — ảnh ấy bị kéo giãn trên màn lớn (spec §6.2,
 * cảnh báo không chặn). `null` khi ảnh đủ rộng, hoặc không biết cỡ ảnh (dòng cũ thiếu số đo).
 */
export function narrowFrameWidth(
  imageWidth: number | null,
  frames: { desktop: SiteSlotFrame | null; phone: SiteSlotFrame | null },
): number | null {
  if (imageWidth === null) return null;
  const widest = Math.max(frames.desktop?.[0] ?? 0, frames.phone?.[0] ?? 0);
  return imageWidth < widest ? widest : null;
}

const WHY = {
  'why-guide': homePage.whyChooseUs.items.guide.title,
  'why-food': homePage.whyChooseUs.items.food.title,
  'why-river': homePage.whyChooseUs.items.river.title,
  'why-evening': homePage.whyChooseUs.items.evening.title,
  'why-heritage': homePage.whyChooseUs.items.heritage.title,
} as const;

const TIMELINE = {
  'about-timeline-2014': aboutPage.timeline.milestones.founding.title,
  'about-timeline-2017': aboutPage.timeline.milestones.centre.title,
  'about-timeline-2021': aboutPage.timeline.milestones.delta.title,
  'about-timeline-2026': aboutPage.timeline.milestones.today.title,
} as const;

const regionName = (key: RegionKey) => REGIONS.find((region) => region.key === key)?.name ?? null;

/** Bốn ô bento của About in tên vùng (`about-gallery.tsx`), ô thứ tư in `allTitle`. */
const BENTO = {
  'about-gallery-north': regionName('north'),
  'about-gallery-central': regionName('central'),
  'about-gallery-south': regionName('south'),
  'about-gallery-all': aboutPage.gallery.allTitle,
} as const;

const REGION_TILE = /^region-gallery-(north|central|south)-(\d)$/;
const POSTCARD = /^region-signature-south-(\d)$/;

/**
 * Câu chữ web đặt cạnh ảnh của khe (spec §6.1) — 39 khe có, tám khe còn lại (hero, khối mở đầu,
 * panel) không. Câu nằm ở i18n của web thì đọc thẳng chỗ ấy (sửa ở web là admin đổi theo); câu
 * nằm trong mock của web thì đọc bản chép `copiedCaptions` (spec phía web canh hai bản khớp).
 */
export function slotCaption(key: SiteSlotKey): string | null {
  if (key in WHY) return WHY[key as keyof typeof WHY];
  if (key in TIMELINE) return TIMELINE[key as keyof typeof TIMELINE];
  if (key in BENTO) return BENTO[key as keyof typeof BENTO];
  if (key in t.copiedCaptions) return t.copiedCaptions[key as keyof typeof t.copiedCaptions];
  const tile = REGION_TILE.exec(key);
  if (tile) {
    const region = tile[1] as RegionKey;
    return messages.regionPage.regions[region].galleryTiles[Number(tile[2]) - 1] ?? null;
  }
  const postcard = POSTCARD.exec(key);
  if (postcard) {
    const card = messages.regionPage.regions.south.signature.postcards[Number(postcard[1]) - 1];
    return card ? `${card.title} · ${card.caption}` : null;
  }
  return null;
}

/** Chip nguồn: ảnh gốc viền (trạng thái mặc định), ảnh đã thay nền phụ — nhìn lướt thấy khe nào đã đổi. */
export const SLOT_SOURCE_VARIANT = {
  ORIGINAL: 'outline',
  UPLOAD: 'secondary',
  LIBRARY: 'secondary',
  OTHER: 'outline',
} as const satisfies Record<SiteSlotImageSource, 'outline' | 'secondary'>;

/** "Jane Doe · CC BY-SA 4.0", hoặc `null` khi không có dòng ghi công nào. */
export function creditLine(author: string | null, license: string | null): string | null {
  const parts = [author, license].filter((part): part is string => part !== null && part !== '');
  return parts.length === 0 ? null : parts.join(' · ');
}

export interface SlotImageVM {
  publicId: string;
  /** Ảnh để vẽ ô xem trước — khe video vẽ ảnh poster. `null` khi không có ảnh nào vẽ được. */
  previewUrl: string | null;
  alt: string;
  source: SiteSlotImageSource;
  sourceLabel: string;
  width: number | null;
  /** "2400 × 1350 px", hoặc `null` khi dòng thiếu số đo. */
  sizeLabel: string | null;
  credit: string | null;
}

export interface SlotOriginalVM {
  publicId: string;
  thumbUrl: string;
  alt: string;
  width: number | null;
}

export interface SlotVM {
  key: SiteSlotKey;
  /** Khoá NHẬN ảnh; `null` với khe video — không có nút nào. */
  imageKey: SiteImageSlotKey | null;
  label: string;
  /** Tên đầy đủ ngoài thẻ: "Home · Hero". */
  name: string;
  groupLabel: string;
  pageHref: string;
  caption: string | null;
  inMobileApp: boolean;
  frames: { desktop: SiteSlotFrame | null; phone: SiteSlotFrame | null };
  /** Khung desktop (hoặc khung điện thoại khi desktop không hiện khe) thu vào ô thẻ. */
  cardFrame: [width: number, height: number];
  version: string | null;
  image: SlotImageVM | null;
  original: SlotOriginalVM;
  /** Restore original có nghĩa: khe ảnh mà đang không dùng ảnh gốc (kể cả khe trống). */
  canRestore: boolean;
}

export interface SlotGroupVM {
  key: string;
  label: string;
  pageHref: string;
  countLabel: string;
  slots: SlotVM[];
}

function imageVM(image: AdminSiteSlotImage): SlotImageVM {
  const drawable = image.type === 'VIDEO' ? image.posterUrl : image.url;
  return {
    publicId: image.publicId,
    previewUrl: drawable === null ? null : withDeliveryTransform(drawable, 'w_640'),
    alt: image.alt ?? '',
    source: image.source,
    sourceLabel: t.source[image.source],
    width: image.width,
    sizeLabel:
      image.width !== null && image.height !== null ? t.size(image.width, image.height) : null,
    credit: creditLine(image.author, image.license),
  };
}

/** Một khe của `list` → thẻ. Nhóm, nhãn và khung đọc ở danh mục. */
export function toSlotVM(slot: AdminSiteSlot): SlotVM {
  const def = siteSlot(slot.key);
  const groupLabel = t.groups[def.group];
  const label = t.slots[slot.key];
  const isVideo = def.kind === 'video';
  // Khe nào cũng hiện ở ít nhất một khổ (spec của danh mục canh).
  const cardSource = def.frames.desktop ?? def.frames.phone ?? ([1, 1] as const);
  return {
    key: slot.key,
    imageKey: isSiteImageSlotKey(slot.key) ? slot.key : null,
    label,
    name: t.slotName(groupLabel, label),
    groupLabel,
    pageHref: sitePageUrl(def.path),
    caption: slotCaption(slot.key),
    inMobileApp: def.inMobileApp,
    frames: def.frames,
    cardFrame: fitFrame(cardSource, CARD_PREVIEW_BOX),
    version: slot.version,
    image: slot.image === null ? null : imageVM(slot.image),
    original: {
      publicId: slot.original.publicId,
      thumbUrl: withDeliveryTransform(slot.original.url, 'w_160'),
      alt: slot.original.alt ?? '',
      width: slot.original.width,
    },
    canRestore: !isVideo && slot.image?.source !== 'ORIGINAL',
  };
}

/** Cả trang: tám nhóm theo thứ tự danh mục, khe trong nhóm theo thứ tự trên trang web. */
export function toAppearanceBoard(slots: readonly AdminSiteSlot[]): SlotGroupVM[] {
  const byKey = new Map(slots.map((slot) => [slot.key, slot]));
  return siteSlotsByGroup().map(({ group, slots: defs }) => {
    const rows = defs.flatMap((def) => {
      const slot = byKey.get(def.key);
      return slot === undefined ? [] : [toSlotVM(slot)];
    });
    return {
      key: group.key,
      label: t.groups[group.key],
      pageHref: sitePageUrl(group.path),
      countLabel: t.slotCount(rows.length),
      slots: rows,
    };
  });
}
