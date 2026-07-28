import type { MockMediaItem } from './types.js';

/**
 * Ảnh của tour, khoá theo slug.
 *
 * VÌ SAO TÁCH KHỎI `tours.ts` thay vì nhét `media` vào từng object tour: trong API
 * thật media KHÔNG nằm cùng bảng với tour. Nó ở `MediaAsset` (`ownerType: TOUR`) và
 * được `MediaService.resolveForOwners()` lấy theo lô rồi mới merge vào detail —
 * đúng như `posts.service.ts` đang làm cho `PostDetailSchema.media`. Mock tách ra
 * thì phản chiếu chính luồng đó, nên lúc gắn API là bỏ file này đi chứ không phải
 * gỡ field ra khỏi 16 object.
 *
 * URL là dạng Cloudinary do API dựng (ADR-0005). Cụm tĩnh KHÔNG fetch chúng — mọi
 * ảnh vẫn là `ImagePlaceholder`; URL chỉ để hình dạng mock đúng contract.
 *
 * `alt` được SOẠN, không sinh máy: nó là nội dung, và là thứ duy nhất người dùng
 * trình đọc màn hình nhận được từ một tấm ảnh. Một item cố tình để `alt: null` để
 * ép nhánh đường lùi.
 */

const CDN = 'https://res.cloudinary.com/tourism-demo/image/upload/tours';

/** Dựng một item cho gọn — mọi field vẫn hiện diện, chỉ bớt lặp. */
function img(
  slug: string,
  n: number,
  role: MockMediaItem['role'],
  alt: string | null,
  size: [number, number] | null = [1600, 1067],
): MockMediaItem {
  return {
    publicId: `tours/${slug}/${n}`,
    url: `${CDN}/${slug}/${n}.jpg`,
    type: 'IMAGE',
    role,
    posterUrl: null,
    width: size?.[0] ?? null,
    height: size?.[1] ?? null,
    alt,
    sortOrder: n,
  };
}

export const TOUR_MEDIA: Record<string, MockMediaItem[]> = {
  // Nhiều ảnh — nhánh gallery đầy đủ.
  'ha-long-bay-cruise': [
    img('ha-long-bay-cruise', 0, 'hero', 'A wooden junk anchored between karsts at first light'),
    img('ha-long-bay-cruise', 1, 'gallery', 'Kayaks lined up on the swim deck'),
    img('ha-long-bay-cruise', 2, 'gallery', 'The low entrance to Luon cave at half tide'),
    img('ha-long-bay-cruise', 3, 'gallery', 'Dinner laid out on the sun deck under lanterns'),
    // width/height null: DB cho phép, và bố cục không được phụ thuộc chúng.
    img('ha-long-bay-cruise', 4, 'gallery', 'A cabin window filled with limestone', null),
    img('ha-long-bay-cruise', 5, 'gallery', 'Tai chi on the top deck before breakfast'),
  ],

  // Ít ảnh — gallery vẫn phải đứng vững với 3 tấm.
  'phu-quoc-reef-days': [
    img('phu-quoc-reef-days', 0, 'hero', 'Shallow reef water off the An Thới islands'),
    img('phu-quoc-reef-days', 1, 'gallery', 'Snorkel gear drying on a boat rail'),
    // alt null: ép nhánh đường lùi khi biên tập chưa soạn nhãn.
    img('phu-quoc-reef-days', 2, 'gallery', null),
  ],

  'northern-highlands-loop': [
    img('northern-highlands-loop', 0, 'hero', 'The Mã Pí Lèng pass cut into the cliff face'),
    img('northern-highlands-loop', 1, 'gallery', 'Motorbikes parked at a roadside noodle stall'),
    img('northern-highlands-loop', 2, 'gallery', 'Sunday market at Đồng Văn before the crowds'),
    img('northern-highlands-loop', 3, 'gallery', 'A stilt house above the Nho Quế river'),
    img('northern-highlands-loop', 4, 'gallery', 'Terraces stepping down into cloud'),
    img('northern-highlands-loop', 5, 'gallery', 'Repairing a chain by the support vehicle'),
    img('northern-highlands-loop', 6, 'gallery', 'Rain gear hung up in a homestay doorway'),
  ],

  'sa-pa-terraces-trek': [
    img('sa-pa-terraces-trek', 0, 'hero', 'Rice terraces above Tả Van in late light'),
    img('sa-pa-terraces-trek', 1, 'gallery', 'A footpath between flooded paddies'),
    img('sa-pa-terraces-trek', 2, 'gallery', 'Indigo cloth drying outside a homestay'),
    img('sa-pa-terraces-trek', 3, 'gallery', 'Buffalo crossing the trail'),
  ],

  'hoi-an-lantern-evening': [
    img('hoi-an-lantern-evening', 0, 'hero', 'Silk lanterns over the Thu Bồn river at dusk'),
    img('hoi-an-lantern-evening', 1, 'gallery', 'A lantern maker splitting bamboo ribs'),
    img('hoi-an-lantern-evening', 2, 'gallery', 'Paper boats with candles on the water'),
    img('hoi-an-lantern-evening', 3, 'gallery', 'The Japanese covered bridge lit from below'),
    img('hoi-an-lantern-evening', 4, 'gallery', 'Bicycles against a mustard-yellow wall'),
  ],

  'hue-imperial-day': [
    img('hue-imperial-day', 0, 'hero', 'The Meridian Gate seen across the citadel moat'),
    img('hue-imperial-day', 1, 'gallery', 'A tiled dragon on a tomb roofline'),
    img('hue-imperial-day', 2, 'gallery', 'Rowing boats moored on the Perfume river'),
    img('hue-imperial-day', 3, 'gallery', 'Court music instruments laid out before a performance'),
  ],

  'mekong-delta-boats': [
    img('mekong-delta-boats', 0, 'hero', 'Sampans crowded together at the Cái Răng market'),
    img('mekong-delta-boats', 1, 'gallery', 'A vendor weighing pineapples from her boat'),
    img('mekong-delta-boats', 2, 'gallery', 'A narrow coconut canal closing overhead'),
    img('mekong-delta-boats', 3, 'gallery', 'Coffee poured through a cloth filter on deck'),
    img('mekong-delta-boats', 4, 'gallery', 'A farming family kitchen at dusk'),
  ],

  'da-nang-coast-ride': [
    img('da-nang-coast-ride', 0, 'hero', 'The coast road curving around Hải Vân'),
    img('da-nang-coast-ride', 1, 'gallery', 'Fishing coracles pulled up on the sand'),
    img('da-nang-coast-ride', 2, 'gallery', 'The Marble Mountains from the roadside'),
  ],

  'ninh-binh-river-caves': [
    img('ninh-binh-river-caves', 0, 'hero', 'A rowboat entering a low river cave at Tam Cốc'),
    img('ninh-binh-river-caves', 1, 'gallery', 'A rower using her feet on the oars'),
    img('ninh-binh-river-caves', 2, 'gallery', 'Limestone towers reflected in still water'),
    img('ninh-binh-river-caves', 3, 'gallery', 'Steps up to the Hang Múa viewpoint'),
  ],

  'saigon-street-food-night': [
    img('saigon-street-food-night', 0, 'hero', 'A grill cart throwing smoke onto a night street'),
    img('saigon-street-food-night', 1, 'gallery', 'Bánh xèo folding in a wide pan'),
    img('saigon-street-food-night', 2, 'gallery', 'Plastic stools filling a District 4 alley'),
    img('saigon-street-food-night', 3, 'gallery', 'Herbs piled on a shared table'),
    img('saigon-street-food-night', 4, 'gallery', 'Iced coffee poured over condensed milk'),
  ],

  'hoi-an-cooking-market': [
    img('hoi-an-cooking-market', 0, 'hero', 'Baskets of herbs at the Hội An morning market'),
    img('hoi-an-cooking-market', 1, 'gallery', 'A cook shaping rice paper over steam'),
    img('hoi-an-cooking-market', 2, 'gallery', 'The finished table of dishes'),
  ],

  'can-tho-floating-dawn': [
    img('can-tho-floating-dawn', 0, 'hero', 'First light over the floating market'),
    img('can-tho-floating-dawn', 1, 'gallery', 'A noodle boat pulling alongside'),
    img('can-tho-floating-dawn', 2, 'gallery', 'Crates of rambutan changing hands'),
    img('can-tho-floating-dawn', 3, 'gallery', 'A rice-noodle workshop behind the wharf'),
  ],

  'north-to-south-classic': [
    img('north-to-south-classic', 0, 'hero', 'A night train window somewhere past Đồng Hới'),
    img('north-to-south-classic', 1, 'gallery', 'Karsts from the deck of a Hạ Long junk'),
    img('north-to-south-classic', 2, 'gallery', 'The citadel wall in Huế after rain'),
    img('north-to-south-classic', 3, 'gallery', 'Lanterns in the Hội An old town'),
    img('north-to-south-classic', 4, 'gallery', 'Rooftops of District 1 at dusk'),
    img('north-to-south-classic', 5, 'gallery', 'A delta canal on the last morning'),
  ],

  // ĐÚNG MỘT ảnh — nhánh "không đủ để xếp khảm", gallery phải tự lùi về một tấm.
  'sa-pa-homestay-weekend': [
    img('sa-pa-homestay-weekend', 0, 'hero', 'A Hmong family kitchen above Tả Van'),
  ],

  'phu-quoc-sunset-sail': [
    img('phu-quoc-sunset-sail', 0, 'hero', 'A wooden sailing boat leaving the harbour'),
    img('phu-quoc-sunset-sail', 1, 'gallery', 'Fish farms passing on the port side'),
    img('phu-quoc-sunset-sail', 2, 'gallery', 'The sail against a low sun'),
    img('phu-quoc-sunset-sail', 3, 'gallery', 'Returning after dark with deck lights on'),
  ],

  // KHÔNG có ảnh nào — nhánh thật khi gắn API: tour vừa tạo, biên tập chưa upload.
  // Gallery phải biến mất sạch, KHÔNG để lại khung rỗng hay nút "xem ảnh".
  'central-heritage-week': [],
};
