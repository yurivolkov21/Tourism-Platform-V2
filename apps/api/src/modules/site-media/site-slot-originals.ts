import type { SiteSlotKey } from '@tourism/contract';
import type { StoredPhoto } from '../catalog/tour-photos.js';

/**
 * Ảnh gốc của từng khe (ADR-0059 §4) — nguồn thứ ba của một lần lưu, và đích của nút
 * Restore original. Sau một lần thay ảnh, dòng `SITE` cũ bị xoá và 48 ảnh site không có dòng
 * thư viện nào, nên không có bảng này thì không còn đường nào trong admin chọn lại ảnh gốc.
 *
 * SINH MỘT LẦN ngày 19/10/2026 từ một câu SELECT chỉ đọc trên production (`site_media_slots`
 * nối `media_assets` owner `SITE`): hôm ấy cả 47 khe đang dùng đúng ảnh gốc, nên bảng là ảnh
 * chụp trạng thái đó. Ai thay ảnh gốc bằng script thì phải sinh lại bảng (Giới hạn #2 của ADR).
 *
 * `Record<SiteSlotKey, …>`: thêm hay bớt một khe ở danh mục mà quên bảng này là typecheck đỏ.
 */
export interface SiteSlotOriginal extends StoredPhoto {
  alt: string | null;
}

/** Mọi ảnh gốc nằm ở thư mục catalog — ngoài vùng tải lên, bộ dọn không bao giờ xoá. */
const catalogId = (key: SiteSlotKey) => `tourism/catalog/site/${key}`;

/** Ảnh không đòi ghi công (robot giữ chỗ, ảnh tự chọn từ kho không ghi nguồn). */
const NO_CREDIT = { author: null, license: null, licenseUrl: null, sourceUrl: null } as const;

/** Ảnh Unsplash: giấy phép không bắt ghi công, nhưng giữ nguồn như dòng gốc đang giữ. */
const unsplash = (sourceUrl: string) =>
  ({
    author: 'Unsplash contributor',
    license: 'Unsplash License',
    licenseUrl: null,
    sourceUrl,
  }) as const;

function image(
  key: SiteSlotKey,
  shape: { format: string; width: number; height: number; bytes: number; version: string },
  alt: string,
  credit: Pick<StoredPhoto, 'author' | 'license' | 'licenseUrl' | 'sourceUrl'>,
): SiteSlotOriginal {
  return {
    publicId: catalogId(key),
    type: 'IMAGE',
    posterId: null,
    durationSec: null,
    ...shape,
    alt,
    ...credit,
  };
}

export const SITE_SLOT_ORIGINALS = {
  // ── Home ──
  'home-hero': image(
    'home-hero',
    { format: 'jpg', width: 2400, height: 1350, bytes: 343896, version: '1786681792' },
    'A city at sunrise from the air, one tall tower standing black against the sun with the river and low haze spreading around it.',
    unsplash(
      'https://images.unsplash.com/photo-1598544919456-fcb105fa7a6f?q=80&w=1631&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'home-why-choose': image(
    'home-why-choose',
    { format: 'jpg', width: 2400, height: 1800, bytes: 1048121, version: '1786710838' },
    'A river curving between karst mountains and paddy fields, villages strung along both banks under towering cloud.',
    unsplash(
      'https://images.unsplash.com/photo-1758298135102-8d3617b32880?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG80by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'why-guide': image(
    'why-guide',
    { format: 'jpg', width: 2400, height: 1600, bytes: 1105815, version: '1786708659' },
    'Three hikers standing on a rock above a blue bay, one with an arm raised, a curved beach and moored boats below them.',
    unsplash(
      'https://images.unsplash.com/photo-1566371486490-560ded23b5e4?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'why-food': image(
    'why-food',
    { format: 'jpg', width: 2400, height: 1600, bytes: 525072, version: '1786708658' },
    'A bowl of rice vermicelli with grilled beef, bean sprouts, fried shallots and herbs on a bamboo mat, a wooden spoon and a dish of peanuts beside it.',
    unsplash(
      'https://images.unsplash.com/photo-1557985877-8f34ebcd32d0?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'why-river': image(
    'why-river',
    { format: 'jpg', width: 2400, height: 1800, bytes: 760322, version: '1786708662' },
    'Cruise boats scattered across a bay of forested karst islands under a clear blue sky, seen from a hilltop.',
    unsplash(
      'https://images.unsplash.com/photo-1675111066042-9baa4c343157?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'why-evening': image(
    'why-evening',
    { format: 'jpg', width: 2400, height: 1600, bytes: 710915, version: '1786708657' },
    'A canopy of lit silk lanterns in every colour and shape hanging close together under leaves.',
    unsplash(
      'https://images.unsplash.com/photo-1691927644490-e1a24b366a5e?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'why-heritage': image(
    'why-heritage',
    { format: 'jpg', width: 2400, height: 1600, bytes: 549791, version: '1786708661' },
    'An ornate pagoda tower with gilded dragon-tipped eaves against a dramatic cloudy sky, a pine and red lanterns below it.',
    unsplash(
      'https://images.unsplash.com/photo-1618165220283-e85246c4171c?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'cta-band': image(
    'cta-band',
    { format: 'jpg', width: 2400, height: 1600, bytes: 1220337, version: '1786710835' },
    'A wooden deck with tree-stump stools looking out across a green paddy toward a wall of forested karst peaks.',
    unsplash(
      'https://images.unsplash.com/photo-1709064155843-fe1acf2998eb?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  // ── About ──
  'about-hero': image(
    'about-hero',
    { format: 'jpg', width: 2400, height: 1499, bytes: 830342, version: '1786687838' },
    'A valley of rice terraces at sunrise with mist between the ridges and a hamlet on the slope below.',
    unsplash(
      'https://images.unsplash.com/photo-1694152363060-cc26bde73872?q=80&w=1529&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  'about-story': image(
    'about-story',
    { format: 'jpg', width: 2400, height: 4266, bytes: 795444, version: '1786951320' },
    'A vintage blue camper van with its roof tent raised, parked alone on a headland above the sea at sunset.',
    unsplash(
      'https://images.unsplash.com/photo-1652953826135-5b3f50906d85?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-timeline-2014': image(
    'about-timeline-2014',
    { format: 'jpg', width: 2400, height: 1601, bytes: 602298, version: '1786956142' },
    'Terraced fields curving down a hillside in early sun, two figures walking a bund and mist rising off the ridge behind.',
    unsplash(
      'https://images.unsplash.com/photo-1609412058473-c199497c3c5d?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-timeline-2017': image(
    'about-timeline-2017',
    { format: 'jpg', width: 2400, height: 3609, bytes: 1404153, version: '1786956144' },
    'Two filled baguettes on a board with coriander, pickled carrot and cucumber, a dish of mustard beside them and an iced green drink behind.',
    unsplash(
      'https://images.unsplash.com/photo-1715925717150-2a6d181d8846?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-timeline-2021': image(
    'about-timeline-2021',
    { format: 'jpg', width: 2400, height: 1600, bytes: 822727, version: '1786956146' },
    'A resort bay at sunset from the air, low villas following a curved beach with islands strung along the horizon.',
    unsplash(
      'https://images.unsplash.com/photo-1764660732489-6d6e5d0673e2?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-timeline-2026': image(
    'about-timeline-2026',
    { format: 'jpg', width: 2400, height: 1350, bytes: 540510, version: '1786956147' },
    'Visitors walking a dirt path between lotus ponds toward a karst peak, the one in front wearing a conical hat.',
    unsplash(
      'https://images.unsplash.com/photo-1754728199470-442fc69eda00?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-gallery-north': image(
    'about-gallery-north',
    { format: 'jpg', width: 2400, height: 1595, bytes: 583372, version: '1786953204' },
    'Ripe rice fields in front of a row of dark stilt houses, cloud pouring over the mountain rising behind them.',
    unsplash(
      'https://images.unsplash.com/photo-1746956302891-2123ed53b0f6?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-gallery-central': image(
    'about-gallery-central',
    { format: 'jpg', width: 2400, height: 1595, bytes: 800060, version: '1786953203' },
    'A long crescent bay with a palm-backed beach seen from a forested headland, sun glinting off the open sea beyond.',
    unsplash(
      'https://images.unsplash.com/photo-1461703220177-c637914a6648?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-gallery-south': image(
    'about-gallery-south',
    { format: 'jpg', width: 2400, height: 3600, bytes: 1572656, version: '1786953205' },
    'Round basket boats crowded along a river channel beside thatched huts, a bank of nipa palms on the far side.',
    unsplash(
      'https://images.unsplash.com/photo-1687343425600-180dcc6506d1?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  'about-gallery-all': image(
    'about-gallery-all',
    { format: 'jpg', width: 2400, height: 1174, bytes: 967712, version: '1786953202' },
    'A turquoise bay ringed with forested karst towers, a curved beach along one side and boats moored off it, seen from a cliff path.',
    unsplash(
      'https://images.unsplash.com/photo-1643029891412-92f9a81a8c16?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
  // Ba robot pixel giữ chỗ (ADR-0020 §7) — Appearance là đường để nhóm tải chân dung thật.
  'about-team-ceo': image(
    'about-team-ceo',
    { format: 'png', width: 800, height: 800, bytes: 11468, version: '1786958942' },
    'A blocky pixel-art robot in green on a pale background, standing in for a portrait photograph.',
    NO_CREDIT,
  ),
  'about-team-routes': image(
    'about-team-routes',
    { format: 'png', width: 800, height: 800, bytes: 11309, version: '1786958945' },
    'A blocky pixel-art robot in pink on a pale background, standing in for a portrait photograph.',
    NO_CREDIT,
  ),
  'about-team-guides': image(
    'about-team-guides',
    { format: 'png', width: 800, height: 800, bytes: 11667, version: '1786958943' },
    'A blocky pixel-art robot in lilac on a pale background, standing in for a portrait photograph.',
    NO_CREDIT,
  ),
  // Khe video chỉ xem; dòng gốc không có poster.
  'about-cta-video': {
    publicId: catalogId('about-cta-video'),
    type: 'VIDEO',
    posterId: null,
    durationSec: null,
    format: 'mp4',
    width: 3840,
    height: 2160,
    bytes: 95152554,
    version: '1786961435',
    alt: 'A natural rock arch high in a cliff framing a green karst valley, the camera drifting slowly toward the opening.',
    ...NO_CREDIT,
  },
  // ── Contact ──
  'contact-panel': image(
    'contact-panel',
    { format: 'jpg', width: 2400, height: 1600, bytes: 858235, version: '1786932233' },
    'Travel things laid out on a map and shot from above: leather boots, two cameras, a magnifying glass, a pipe, a notebook and a cup of coffee.',
    unsplash(
      'https://images.unsplash.com/photo-1496950866446-3253e1470e8e?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ),
  ),
  // ── Destinations ──
  'moment-lanha-kayak': image(
    'moment-lanha-kayak',
    { format: 'jpg', width: 2400, height: 3200, bytes: 2653107, version: '1787055544' },
    'The orange bow of a kayak on flat emerald water in front of a limestone cliff furred with jungle.',
    NO_CREDIT,
  ),
  'moment-hagiang-valley': image(
    'moment-hagiang-valley',
    { format: 'jpg', width: 2400, height: 1600, bytes: 1056565, version: '1787055535' },
    'A road switchbacking down a green mountainside, white and yellow wildflowers close in the foreground and karst ranges receding behind.',
    NO_CREDIT,
  ),
  'moment-hoian-river': image(
    'moment-hoian-river',
    { format: 'jpg', width: 2400, height: 3000, bytes: 1279578, version: '1787055538' },
    'Wooden boats moored along the river with big round lanterns on their prows, the yellow shophouse waterfront and its crowds behind them.',
    NO_CREDIT,
  ),
  'moment-myson-towers': image(
    'moment-myson-towers',
    { format: 'jpg', width: 2400, height: 1600, bytes: 1088286, version: '1787055546' },
    'A long weathered brick wall of a Chăm temple with carved pilasters and lattice windows, fallen columns lying in front of it.',
    NO_CREDIT,
  ),
  'moment-bentre-canal': image(
    'moment-bentre-canal',
    { format: 'jpg', width: 2400, height: 3600, bytes: 2395438, version: '1787055534' },
    'The bow of a wooden sampan with its coiled rope, pointing down a green channel that nipa palms close over from both sides.',
    NO_CREDIT,
  ),
  // ── Northern Vietnam ──
  'region-gallery-north-1': image(
    'region-gallery-north-1',
    { format: 'jpg', width: 2400, height: 1600, bytes: 594678, version: '1787125539' },
    'A yellow-hulled tour boat and two smaller boats on flat water beneath a cluster of forested karst islands.',
    NO_CREDIT,
  ),
  'region-gallery-north-2': image(
    'region-gallery-north-2',
    { format: 'jpg', width: 2400, height: 1600, bytes: 778981, version: '1787125540' },
    'Rowing boats setting out from under a low cave mouth, passengers in orange life jackets and daylight and reeds beyond.',
    NO_CREDIT,
  ),
  'region-gallery-north-3': image(
    'region-gallery-north-3',
    { format: 'jpg', width: 2400, height: 3208, bytes: 1461394, version: '1787125541' },
    'The stone stairway at Mua Cave climbing a jagged peak to a small pagoda at the top, rice fields spreading to the horizon in evening light.',
    NO_CREDIT,
  ),
  'region-gallery-north-4': image(
    'region-gallery-north-4',
    { format: 'jpg', width: 2400, height: 1279, bytes: 611291, version: '1787125542' },
    'Terraced fields curving around green hills in morning sun, a river running along the valley floor and farmhouses scattered among the paddies.',
    NO_CREDIT,
  ),
  'region-gallery-north-5': image(
    'region-gallery-north-5',
    { format: 'jpg', width: 2400, height: 1600, bytes: 877593, version: '1787125543' },
    'Hanoi Train Street at dusk, paper lanterns strung overhead and café tables crowding right up to both sides of the track.',
    NO_CREDIT,
  ),
  'region-gallery-north-6': image(
    'region-gallery-north-6',
    { format: 'jpg', width: 2400, height: 1800, bytes: 809277, version: '1787125544' },
    'Rice fields at sunset with mountains fading behind, a farmer walking the bund and part of the crop already cut.',
    NO_CREDIT,
  ),
  // ── Central Vietnam ──
  'region-gallery-central-1': image(
    'region-gallery-central-1',
    { format: 'jpg', width: 2400, height: 3000, bytes: 1279578, version: '1787125533' },
    'Wooden boats moored along the river with big round lanterns on their prows, the yellow shophouse waterfront and its crowds behind them.',
    NO_CREDIT,
  ),
  'region-gallery-central-2': image(
    'region-gallery-central-2',
    { format: 'jpg', width: 2400, height: 3598, bytes: 1653244, version: '1787125534' },
    'Rows of wooden boats packed along the river in low sun, their bows loaded with paper lanterns and the yellow waterfront standing behind.',
    NO_CREDIT,
  ),
  'region-gallery-central-3': image(
    'region-gallery-central-3',
    { format: 'jpg', width: 1920, height: 2818, bytes: 1522608, version: '1787125535' },
    'The Golden Bridge curving round the hilltop at dawn, the giant hands holding it above forested slopes with cloud lying over the plain below.',
    NO_CREDIT,
  ),
  'region-gallery-central-4': image(
    'region-gallery-central-4',
    { format: 'jpg', width: 2400, height: 3600, bytes: 888760, version: '1787125536' },
    'The white Lady Buddha statue standing above an altar crowded with bundles of incense sticks and red gladioli.',
    NO_CREDIT,
  ),
  'region-gallery-central-5': image(
    'region-gallery-central-5',
    { format: 'jpg', width: 2400, height: 3605, bytes: 1284220, version: '1787125537' },
    'Basket boats and a wooden boat on the sand under a heavy storm sky, a small Vietnamese flag planted among them and a fishing fleet offshore.',
    NO_CREDIT,
  ),
  'region-gallery-central-6': image(
    'region-gallery-central-6',
    { format: 'jpg', width: 2400, height: 1600, bytes: 1031079, version: '1787125538' },
    'Looking out from inside a huge cave mouth toward daylight, a sandy floor and shallow pool below jungle-covered cliffs.',
    NO_CREDIT,
  ),
  // ── Southern Vietnam ──
  'region-gallery-south-1': image(
    'region-gallery-south-1',
    { format: 'jpg', width: 2400, height: 1292, bytes: 827168, version: '1787125545' },
    'A fishing town from the air with hundreds of blue boats packed into the harbour, a green headland and islands beyond.',
    NO_CREDIT,
  ),
  'region-gallery-south-2': image(
    'region-gallery-south-2',
    { format: 'jpg', width: 2400, height: 1602, bytes: 638991, version: '1787125546' },
    'The skyline at blue hour across the river, seen from a rocky bank where old wooden pilings stand out of the water.',
    NO_CREDIT,
  ),
  'region-gallery-south-3': image(
    'region-gallery-south-3',
    { format: 'jpg', width: 2400, height: 1800, bytes: 846340, version: '1787125547' },
    'Wooden sampans painted blue and red waiting in a muddy Mekong canal, rowers in conical hats sitting at the oars, seen from the bank above.',
    NO_CREDIT,
  ),
  'region-signature-south-1': image(
    'region-signature-south-1',
    { format: 'jpg', width: 2400, height: 3600, bytes: 1837226, version: '1787137780' },
    'Wooden rowing boats moored in a narrow channel under a shade net, two women in conical hats sitting in one of them.',
    NO_CREDIT,
  ),
  'region-signature-south-2': image(
    'region-signature-south-2',
    { format: 'jpg', width: 2400, height: 3000, bytes: 1636590, version: '1787137783' },
    'The pink church from above, its spire and long tiled nave hemmed in by dense city blocks with traffic passing on the street below.',
    NO_CREDIT,
  ),
  'region-signature-south-3': image(
    'region-signature-south-3',
    { format: 'jpg', width: 2400, height: 1348, bytes: 576651, version: '1787137785' },
    'A resort quarter at sunset gathered around an orange clock tower, a curved footbridge reaching out over a calm gold sea.',
    NO_CREDIT,
  ),
  // ── Sign-in pages ──
  'auth-panel': image(
    'auth-panel',
    { format: 'jpg', width: 2400, height: 1600, bytes: 807296, version: '1786976718' },
    'The red funicular carriage climbing the last ridge to the Fansipan summit at sunrise, a bronze Buddha and clock tower standing above a sea of cloud.',
    unsplash(
      'https://images.unsplash.com/photo-1732099083114-4fb49a280eec?q=85&w=2400&auto=format&fit=crop',
    ),
  ),
} satisfies Record<SiteSlotKey, SiteSlotOriginal>;

/** Ảnh gốc của một khe. */
export function siteSlotOriginal(key: SiteSlotKey): SiteSlotOriginal {
  return SITE_SLOT_ORIGINALS[key];
}
