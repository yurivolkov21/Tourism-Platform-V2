/**
 * Alt text cho ảnh, khoá theo `publicId` của Cloudinary.
 *
 * ── Vì sao có file này ──
 * Trước 09/09/2026 cả 517 dòng `media_assets` đều có `alt = NULL`. Web có đường
 * rơi-về (suy alt từ chủ sở hữu) nên trang không vỡ, nhưng trình đọc màn hình
 * chỉ nghe được tên tour chứ không biết trong ảnh có gì — và Google cũng vậy.
 *
 * ── Vì sao khoá theo publicId chứ không theo id dòng ──
 * Gallery của tour MƯỢN ảnh địa danh: 276 dòng tour dùng chung 137 publicId với
 * gallery địa danh. Alt mô tả NỘI DUNG ảnh, mà nội dung thì giống nhau dù treo ở
 * trang tour hay trang địa danh. Khoá theo publicId nên một dòng ở đây phủ mọi
 * dòng dùng chung ảnh đó, và không bao giờ lệch nhau.
 *
 * ── Luật viết ──
 * Mỗi câu dưới đây được viết SAU KHI NHÌN ảnh thật (tải từ Cloudinary rồi xem),
 * không suy từ tên file hay tiêu đề tour. Alt đoán mò còn hại hơn alt trống: nó
 * nói với người dùng trình đọc màn hình một điều sai mà họ không kiểm chứng được.
 * Mô tả cái NHÌN THẤY, không lặp lại tiêu đề đã nằm cạnh ảnh, không mở đầu bằng
 * "Ảnh chụp…". Tiếng Anh theo luật 7 (copy hướng người dùng).
 */
export const altText: Record<string, string> = {
  // ── Ảnh bìa blog (9) ──────────────────────────────────────────────────────
  'tourism/catalog/post/bridges-beaches-and-bun-cha-ca/hero':
    "Đà Nẵng's Dragon Bridge breathing a jet of flame over the Hàn River at night, spectators lined along the rail and heart-shaped lamps glowing red on the bridge beyond.",
  'tourism/catalog/post/crossing-hanoi-on-foot/hero':
    'A train easing down the narrow lane of Hanoi Train Street at dusk, headlight on, while onlookers press back against café fronts hung with lanterns.',
  'tourism/catalog/post/eating-your-way-through-hoi-an/hero':
    "Hội An's Old Town at dusk, silk lanterns strung between mustard-yellow shophouses and cyclo drivers waiting at the kerb.",
  'tourism/catalog/post/floating-markets-before-sunrise/hero':
    'Cái Răng floating market at blue hour, produce boats rafted together under strings of light while a trader poles past drifting water hyacinth.',
  'tourism/catalog/post/reading-a-hue-royal-tomb/hero':
    'A stele pavilion at a Huế royal tomb catching low morning light through mist, its tiled roof and mosaic panels framing the stone tablet inside.',
  'tourism/catalog/post/the-bay-without-the-crowds/hero':
    'Lan Hạ Bay seen from a forested ridge on Cát Bà, limestone islands scattered across still water with a handful of boats between them.',
  'tourism/catalog/post/two-days-among-the-karsts/hero':
    'Sampans threading a green river between forested karst hills at Tràng An, seen from directly above.',
  'tourism/catalog/post/what-to-pack-for-the-mist-season/hero':
    'Sa Pa town half-swallowed by cloud, a hotel façade and pine tops rising out of the mist with mountains behind.',
  'tourism/catalog/post/when-to-come-and-when-not-to/hero':
    'Terraced paddies stepping down a northern valley under low cloud, ridge behind ridge fading into rain light.',

  // ── Ảnh bìa địa danh (18) ─────────────────────────────────────────────────
  'tourism/catalog/destination/ben-tre/hero':
    'Painted wooden basket boats rafted together in a narrow channel walled by dense water-coconut palms, seen from directly above.',
  'tourism/catalog/destination/can-tho/hero':
    "Cần Thơ Bridge's single tall pylon and its fan of cables rising over the deck, motorbikes crossing beneath a bank of white cloud.",
  'tourism/catalog/destination/cat-ba/hero':
    'A row of thatched bungalows on a small sandy cove wedged between forested limestone cliffs, pale green water lapping the shore.',
  'tourism/catalog/destination/da-lat/hero':
    "Đà Lạt railway station's yellow art-deco façade with three pointed gables, a clock above the entrance and Vietnamese flags out front.",
  'tourism/catalog/destination/da-nang/hero':
    "The Dragon Bridge's head lit orange against a night sky, its body arching away over the roadway while motorbikes ride the deck under a full moon.",
  'tourism/catalog/destination/ha-giang/hero':
    'The Nho Quế river running turquoise along the floor of a deep gorge, steep green limestone walls on both sides and terraced slopes in the foreground.',
  'tourism/catalog/destination/ha-long/hero':
    'Rowing boats of visitors in orange life jackets gliding beneath a huge grey limestone cliff that drops straight into jade water.',
  'tourism/catalog/destination/hanoi/hero':
    'The red wooden Húc Bridge seen across Hoàn Kiếm Lake, framed by leaning trees and doubled in the still green water.',
  'tourism/catalog/destination/ho-chi-minh-city/hero':
    "The People's Committee building's cream colonial façade and clock tower flying the Vietnamese flag, seen along the lawns of Nguyễn Huệ under piled cumulus.",
  'tourism/catalog/destination/hoi-an/hero':
    'The Japanese Covered Bridge arching over a narrow canal in Hội An, its tiled roof and carved gable beside an ochre wall where visitors stop to pose.',
  'tourism/catalog/destination/hue/hero':
    'An ornate gate of the Huế citadel with three arched doorways, its porcelain-mosaic panels and tiled roof framed by overhanging branches.',
  'tourism/catalog/destination/mai-chau/hero':
    'A lane of wooden stilt houses in a Mai Châu village, a Vietnamese flag hanging from each veranda and a forested hillside rising behind.',
  'tourism/catalog/destination/ninh-binh/hero':
    'The stone stairway at Mua Cave winding up a jagged karst peak to a small pagoda tower, green rice fields spreading to the horizon below.',
  'tourism/catalog/destination/phong-nha/hero':
    'A river curving between karst mountains and paddy fields, villages strung along both banks under towering cloud.',
  'tourism/catalog/destination/phu-quoc/hero':
    'Four coconut palms leaning far out over white sand toward a pastel sunset, a rope swing hung from one and two boats on the flat sea.',
  'tourism/catalog/destination/quy-nhon/hero':
    'Dozens of small boats moored over turquoise shallows, coral and seagrass showing dark through the clear water, seen from directly above.',
  'tourism/catalog/destination/sa-pa/hero':
    'Tiered temple roofs and a golden pagoda standing above a sea of cloud at the summit of Fansipan, a broad stone stairway climbing toward them.',
  'tourism/catalog/destination/vung-tau/hero':
    "Vũng Tàu's rooftops and palms running down to the bay, the green headland of Small Mountain curving out into the sea under a clear sky.",

  // ── Ảnh bìa tour (29) ─────────────────────────────────────────────────────
  'tourism/catalog/tour/bana-hills-golden-bridge-day/hero':
    'The Golden Bridge curving away from a forested hillside on two giant weathered stone hands, visitors walking its full length under a blue sky.',
  'tourism/catalog/tour/ben-tre-coconut-day/hero':
    'A wooden sampan poled by women in conical hats down a narrow brown canal roofed over by water-coconut fronds.',
  'tourism/catalog/tour/central-heritage-4d/hero':
    'Turquoise sea meeting a thin strip of sand and dense green forest, a coast road winding through the trees, seen from directly above.',
  'tourism/catalog/tour/central-honeymoon-5d/hero':
    'The Hội An riverfront at dawn, a row of mustard-yellow shophouses and palms mirrored in water still enough to double a violet and gold sky.',
  'tourism/catalog/tour/da-lat-highlands-3d/hero':
    'Đà Lạt at sunrise, vegetable plots in the foreground giving way to gabled villas stepping up the slope with hills fading behind.',
  'tourism/catalog/tour/ha-giang-loop-4d/hero':
    'A mountain road switchbacking down a steep green valley, a single car on one of the bends and ridges receding into haze.',
  'tourism/catalog/tour/halong-bay-overnight-cruise/hero':
    'Kayakers paddling out through the mouth of a low sea cave, the rock ceiling framing daylight and a karst wall beyond.',
  'tourism/catalog/tour/hanoi-heritage-day/hero':
    'The Hồ Chí Minh Mausoleum seen across the lawns of Ba Đình Square, the Vietnamese flag flying from a tall mast in front of it.',
  'tourism/catalog/tour/hanoi-old-quarter-food-night/hero':
    'A packed Old Quarter lane at night, diners crowded onto low plastic stools while a vendor carries a tray of food past glowing shop signs.',
  'tourism/catalog/tour/hoi-an-countryside-cooking-day/hero':
    'A guide in a conical hat spinning a brightly painted round basket boat in the water, more boats of visitors waiting among the water-coconut palms.',
  'tourism/catalog/tour/hoi-an-lantern-evening/hero':
    'A Hội An shopfront hung with lit silk lanterns at dusk, the quiet street running past it and a cyclist in the distance.',
  'tourism/catalog/tour/hue-imperial-day/hero':
    'The tiered pavilion of the Huế citadel gate riding its stone rampart, glazed roof tiles catching the light and potted chrysanthemums lining the ramps below.',
  'tourism/catalog/tour/lan-ha-kayak-cruise-3d/hero':
    'A wooden cruise junk anchored close under a wall of forested limestone cliffs in flat green water.',
  'tourism/catalog/tour/mai-chau-cycling-2d/hero':
    'A bicycle propped on a concrete lane beside young rice fields fringed with yellow wildflowers under a soft overcast sky.',
  'tourism/catalog/tour/mekong-can-tho-2d/hero':
    'A trader poling a boat piled with produce through the rafted-up boats of Cái Răng floating market in late afternoon light.',
  'tourism/catalog/tour/my-son-sunrise-halfday/hero':
    'A weathered brick Chăm tower at Mỹ Sơn standing above low ruined walls, jungle closing in and a cloud-topped mountain behind.',
  'tourism/catalog/tour/ninh-binh-trang-an-day/hero':
    'Rowing boats leaving a low water cave at Tràng An, the dark cave mouth framing karst cliffs and more boats on the green river ahead.',
  'tourism/catalog/tour/northern-highlights-5d/hero':
    'Forested karst islands enclosing a turquoise lagoon and two empty crescents of sand, seen from the air.',
  'tourism/catalog/tour/phong-nha-paradise-cave-day/hero':
    'A boat moored on jade-green water at the mouth of a river cave, bare branches in the foreground and visitors on the sand at the entrance.',
  'tourism/catalog/tour/phu-quoc-honeymoon-4d/hero':
    'A palm-lined beach at sunset from the air, loungers and umbrellas along the sand and a speedboat on water streaked pink and orange by the sky.',
  'tourism/catalog/tour/phu-quoc-island-hopping-day/hero':
    'Three kayaks drawn up on white sand between palm shadows and turquoise shallows, seen from directly above.',
  'tourism/catalog/tour/quy-nhon-coastal-3d/hero':
    'A paved path with a red railing winding down a headland of dry grass and cactus toward the rocks and sea, one walker on it.',
  'tourism/catalog/tour/red-river-craft-villages-day/hero':
    'A dim pottery workshop lined with heavy wooden shelves of unglazed bowls, plates and jars waiting to be fired.',
  'tourism/catalog/tour/saigon-after-dark-vespa/hero':
    'A Sài Gòn café apartment block lit up at night, every balcony a different neon sign, with motorbikes and crowds on the street below.',
  'tourism/catalog/tour/saigon-cu-chi-day/hero':
    'The Independence Palace behind its wide lawn, the national flag on the roof and rows of flagpoles down both sides of the drive.',
  'tourism/catalog/tour/sapa-fansipan-summit-3d/hero':
    'The red funicular carriage climbing the last ridge to the Fansipan summit at sunrise, a bronze Buddha and clock tower standing above a sea of cloud.',
  'tourism/catalog/tour/sapa-terraces-homestay-2d/hero':
    'Rice terraces at harvest colour curving up a hillside in strong sun, a bamboo fence running along the path in the foreground.',
  'tourism/catalog/tour/vietnam-grand-journey-12d/hero':
    'A road folding back on itself in tight hairpins down a misted green mountainside, two motorbikes small on the bends.',
  'tourism/catalog/tour/vung-tau-coastal-2d/hero':
    'The Vũng Tàu shoreline curving away beneath a green headland, fishing boats anchored in the shallows and treetops in the foreground.',
};
