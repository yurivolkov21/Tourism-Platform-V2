/**
 * Danh mục khe ảnh "thương hiệu" của web (ADR-0059 §1) — nguồn DUY NHẤT cho ba bên:
 * web (`siteMediaImage` nhận `SiteSlotKey`, gõ sai khoá là lỗi typecheck), API (thứ tự và
 * kiểu khe của `admin.appearance.list`, chặn khe video ở schema) và admin (nhóm, khung xem
 * trước). Chữ hiển thị (nhãn khe, câu chú thích) ở `@tourism/i18n`, không ở đây.
 *
 * Module chỉ có dữ liệu, không zod: schema của khoá sống ở `schemas/admin-appearance.ts`.
 *
 * Khung là `offsetWidth × offsetHeight` của khung bọc ảnh, px CSS, đo 15/10 bằng Chromium ở
 * khung nhìn 1440×900 và 390×844 (spec §3.2). Đổi bố cục web làm khung lệch thì phải sửa số
 * ở đây — không test nào bắt được (Giới hạn #1 của ADR).
 */

/** `[rộng, cao]` của khung bọc ảnh, px CSS. */
export type SiteSlotFrame = readonly [width: number, height: number];

/** Tám trang web chứa khe, theo thứ tự trang admin bày. */
export const SITE_SLOT_GROUPS = [
  { key: 'home', path: '/' },
  { key: 'about', path: '/about' },
  { key: 'contact', path: '/contact' },
  { key: 'destinations', path: '/destinations' },
  { key: 'north', path: '/destinations/northern-vietnam' },
  { key: 'central', path: '/destinations/central-vietnam' },
  { key: 'south', path: '/destinations/southern-vietnam' },
  // Sáu trang đăng nhập dùng chung một khe; mở trang Sign in là đủ thấy.
  { key: 'auth', path: '/login' },
] as const;

export type SiteSlotGroupKey = (typeof SITE_SLOT_GROUPS)[number]['key'];
export type SiteSlotGroup = (typeof SITE_SLOT_GROUPS)[number];

export interface SiteSlotDefinition {
  key: string;
  group: SiteSlotGroupKey;
  /** URL trang web chứa khe — chính là `path` của nhóm. */
  path: string;
  kind: 'image' | 'video';
  /** `null` là khổ đó không hiện khe. */
  frames: { desktop: SiteSlotFrame | null; phone: SiteSlotFrame | null };
  /** Ảnh gốc của khe cũng được app mobile ghim trong code (`auth-media.ts`), không đọc API. */
  inMobileApp: boolean;
}

const PATH = Object.fromEntries(SITE_SLOT_GROUPS.map((group) => [group.key, group.path])) as {
  [K in SiteSlotGroupKey]: Extract<SiteSlotGroup, { key: K }>['path'];
};

// Khung dùng lại cho nhiều khe — tên theo chỗ trên trang, không theo tỉ lệ.
const HERO = { desktop: [1436, 900], phone: [390, 844] } as const;
const WHY = { desktop: [486, 411], phone: [358, 411] } as const;
const TIMELINE = { desktop: [512, 208], phone: [358, 176] } as const;
const BENTO_SMALL = { desktop: [302, 260], phone: [358, 260] } as const;
const TEAM = { desktop: [411, 320], phone: [358, 320] } as const;
const MOMENT_SMALL = { desktop: [289, 217], phone: [175, 131] } as const;
const NORTH_PHONE = [358, 176] as const;
const CENTRAL = { desktop: [380, 475], phone: [280, 350] } as const;
const SOUTH_SIGNATURE = { desktop: [377, 503], phone: [358, 477] } as const;

/** 47 khe theo thứ tự trang admin bày: theo nhóm, trong nhóm theo thứ tự trên trang web. */
export const SITE_SLOTS = [
  // ── Home ──
  {
    key: 'home-hero',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: HERO,
    inMobileApp: false,
  },
  {
    key: 'home-why-choose',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: WHY,
    inMobileApp: false,
  },
  {
    key: 'why-guide',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: WHY,
    inMobileApp: false,
  },
  {
    key: 'why-food',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: WHY,
    inMobileApp: false,
  },
  {
    key: 'why-river',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: WHY,
    inMobileApp: false,
  },
  {
    key: 'why-evening',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: WHY,
    inMobileApp: false,
  },
  {
    key: 'why-heritage',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: WHY,
    inMobileApp: false,
  },
  {
    key: 'cta-band',
    group: 'home',
    path: PATH.home,
    kind: 'image',
    frames: { desktop: [1436, 636], phone: [390, 636] },
    inMobileApp: true,
  },
  // ── About ──
  {
    key: 'about-hero',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: HERO,
    inMobileApp: false,
  },
  {
    key: 'about-story',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: { desktop: [454, 700], phone: [358, 600] },
    inMobileApp: false,
  },
  {
    key: 'about-timeline-2014',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: TIMELINE,
    inMobileApp: false,
  },
  {
    key: 'about-timeline-2017',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: TIMELINE,
    inMobileApp: false,
  },
  {
    key: 'about-timeline-2021',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: TIMELINE,
    inMobileApp: false,
  },
  {
    key: 'about-timeline-2026',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: TIMELINE,
    inMobileApp: false,
  },
  {
    key: 'about-gallery-north',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: { desktop: [628, 544], phone: [358, 420] },
    inMobileApp: false,
  },
  {
    key: 'about-gallery-central',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: { desktop: [628, 260], phone: [358, 260] },
    inMobileApp: false,
  },
  {
    key: 'about-gallery-south',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: BENTO_SMALL,
    inMobileApp: false,
  },
  {
    key: 'about-gallery-all',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: BENTO_SMALL,
    inMobileApp: false,
  },
  {
    key: 'about-team-ceo',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: TEAM,
    inMobileApp: false,
  },
  {
    key: 'about-team-routes',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: TEAM,
    inMobileApp: false,
  },
  {
    key: 'about-team-guides',
    group: 'about',
    path: PATH.about,
    kind: 'image',
    frames: TEAM,
    inMobileApp: false,
  },
  {
    key: 'about-cta-video',
    group: 'about',
    path: PATH.about,
    kind: 'video',
    frames: { desktop: [1280, 384], phone: [358, 384] },
    inMobileApp: false,
  },
  // ── Contact ──
  {
    key: 'contact-panel',
    group: 'contact',
    path: PATH.contact,
    kind: 'image',
    frames: { desktop: [589, 790], phone: [356, 619] },
    inMobileApp: false,
  },
  // ── Destinations: năm khoảnh khắc, theo thứ tự `MOMENTS` của web ──
  {
    key: 'moment-lanha-kayak',
    group: 'destinations',
    path: PATH.destinations,
    kind: 'image',
    frames: { desktop: [586, 442], phone: [358, 269] },
    inMobileApp: true,
  },
  {
    key: 'moment-hagiang-valley',
    group: 'destinations',
    path: PATH.destinations,
    kind: 'image',
    frames: MOMENT_SMALL,
    inMobileApp: true,
  },
  {
    key: 'moment-hoian-river',
    group: 'destinations',
    path: PATH.destinations,
    kind: 'image',
    frames: MOMENT_SMALL,
    inMobileApp: true,
  },
  {
    key: 'moment-myson-towers',
    group: 'destinations',
    path: PATH.destinations,
    kind: 'image',
    frames: MOMENT_SMALL,
    inMobileApp: false,
  },
  {
    key: 'moment-bentre-canal',
    group: 'destinations',
    path: PATH.destinations,
    kind: 'image',
    frames: MOMENT_SMALL,
    inMobileApp: true,
  },
  // ── Northern Vietnam: sáu ô "peaks", cao khác nhau trên desktop ──
  {
    key: 'region-gallery-north-1',
    group: 'north',
    path: PATH.north,
    kind: 'image',
    frames: { desktop: [380, 224], phone: NORTH_PHONE },
    inMobileApp: false,
  },
  {
    key: 'region-gallery-north-2',
    group: 'north',
    path: PATH.north,
    kind: 'image',
    frames: { desktop: [380, 288], phone: NORTH_PHONE },
    inMobileApp: false,
  },
  {
    key: 'region-gallery-north-3',
    group: 'north',
    path: PATH.north,
    kind: 'image',
    frames: { desktop: [380, 384], phone: NORTH_PHONE },
    inMobileApp: false,
  },
  {
    key: 'region-gallery-north-4',
    group: 'north',
    path: PATH.north,
    kind: 'image',
    frames: { desktop: [380, 160], phone: NORTH_PHONE },
    inMobileApp: false,
  },
  {
    key: 'region-gallery-north-5',
    group: 'north',
    path: PATH.north,
    kind: 'image',
    frames: { desktop: [380, 256], phone: NORTH_PHONE },
    inMobileApp: false,
  },
  {
    key: 'region-gallery-north-6',
    group: 'north',
    path: PATH.north,
    kind: 'image',
    frames: { desktop: [380, 240], phone: NORTH_PHONE },
    inMobileApp: false,
  },
  // ── Central Vietnam: sáu ô "lanterns" cùng khung ──
  {
    key: 'region-gallery-central-1',
    group: 'central',
    path: PATH.central,
    kind: 'image',
    frames: CENTRAL,
    inMobileApp: false,
  },
  {
    key: 'region-gallery-central-2',
    group: 'central',
    path: PATH.central,
    kind: 'image',
    frames: CENTRAL,
    inMobileApp: false,
  },
  {
    key: 'region-gallery-central-3',
    group: 'central',
    path: PATH.central,
    kind: 'image',
    frames: CENTRAL,
    inMobileApp: false,
  },
  {
    key: 'region-gallery-central-4',
    group: 'central',
    path: PATH.central,
    kind: 'image',
    frames: CENTRAL,
    inMobileApp: false,
  },
  {
    key: 'region-gallery-central-5',
    group: 'central',
    path: PATH.central,
    kind: 'image',
    frames: CENTRAL,
    inMobileApp: false,
  },
  {
    key: 'region-gallery-central-6',
    group: 'central',
    path: PATH.central,
    kind: 'image',
    frames: CENTRAL,
    inMobileApp: false,
  },
  // ── Southern Vietnam: ba ô "panorama", rồi ba bưu thiếp của khối Signature ──
  {
    key: 'region-gallery-south-1',
    group: 'south',
    path: PATH.south,
    kind: 'image',
    frames: { desktop: [1024, 576], phone: [358, 201] },
    inMobileApp: false,
  },
  {
    key: 'region-gallery-south-2',
    group: 'south',
    path: PATH.south,
    kind: 'image',
    frames: { desktop: [606, 288], phone: [358, 224] },
    inMobileApp: false,
  },
  {
    key: 'region-gallery-south-3',
    group: 'south',
    path: PATH.south,
    kind: 'image',
    frames: { desktop: [398, 288], phone: [358, 224] },
    inMobileApp: false,
  },
  {
    key: 'region-signature-south-1',
    group: 'south',
    path: PATH.south,
    kind: 'image',
    frames: SOUTH_SIGNATURE,
    inMobileApp: false,
  },
  {
    key: 'region-signature-south-2',
    group: 'south',
    path: PATH.south,
    kind: 'image',
    frames: SOUTH_SIGNATURE,
    inMobileApp: false,
  },
  {
    key: 'region-signature-south-3',
    group: 'south',
    path: PATH.south,
    kind: 'image',
    frames: SOUTH_SIGNATURE,
    inMobileApp: false,
  },
  // ── Sign-in pages: panel chỉ hiện từ khổ `lg` ──
  {
    key: 'auth-panel',
    group: 'auth',
    path: PATH.auth,
    kind: 'image',
    frames: { desktop: [720, 900], phone: null },
    inMobileApp: true,
  },
] as const satisfies readonly SiteSlotDefinition[];

export type SiteSlot = (typeof SITE_SLOTS)[number];
export type SiteSlotKey = SiteSlot['key'];
/** Khe nhận ảnh — mọi khe trừ khe video (chỉ xem, spec §1). */
export type SiteImageSlotKey = Extract<SiteSlot, { kind: 'image' }>['key'];

export const SITE_SLOT_KEYS: readonly SiteSlotKey[] = SITE_SLOTS.map((slot) => slot.key);
export const SITE_IMAGE_SLOT_KEYS: readonly SiteImageSlotKey[] = SITE_SLOTS.flatMap((slot) =>
  slot.kind === 'image' ? [slot.key] : [],
);

const BY_KEY: ReadonlyMap<string, SiteSlot> = new Map(SITE_SLOTS.map((slot) => [slot.key, slot]));

export function isSiteSlotKey(key: string): key is SiteSlotKey {
  return BY_KEY.has(key);
}

export function isSiteImageSlotKey(key: string): key is SiteImageSlotKey {
  return BY_KEY.get(key)?.kind === 'image';
}

/** Khe theo khoá. Khoá đã là `SiteSlotKey` nên không có ca "không thấy". */
export function siteSlot<K extends SiteSlotKey>(key: K): Extract<SiteSlot, { key: K }> {
  return BY_KEY.get(key) as Extract<SiteSlot, { key: K }>;
}

/** Khe gom theo nhóm, giữ thứ tự của cả hai — trang admin vẽ đúng thứ tự này. */
export function siteSlotsByGroup(): { group: SiteSlotGroup; slots: SiteSlot[] }[] {
  return SITE_SLOT_GROUPS.map((group) => ({
    group,
    slots: SITE_SLOTS.filter((slot) => slot.group === group.key),
  }));
}
