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

  // ── Gallery địa danh (137) ────────────────────────────────────────────────
  // Gallery tour mượn lại đúng những publicId này, nên mỗi dòng ở đây phủ thêm
  // khoảng hai dòng tour nữa.
  'tourism/catalog/destination/ben-tre/gallery-01':
    'Wooden sampans painted blue and red waiting in a muddy Mekong canal, rowers in conical hats sitting at the oars, seen from the bank above.',
  'tourism/catalog/destination/ben-tre/gallery-02':
    'A pale river winding between dense mats of water-coconut palm, a line of round basket boats moored along one bank, seen from the air.',
  'tourism/catalog/destination/ben-tre/gallery-03':
    'The bow of a wooden sampan with its coiled rope, pointing down a green channel that nipa palms close over from both sides.',
  'tourism/catalog/destination/ben-tre/gallery-04':
    'A still dark creek walled in by tangled jungle, one coconut frond catching the sun above the water.',
  'tourism/catalog/destination/ben-tre/gallery-05':
    'A thick stand of coconut palms behind a wide grey sandbank with a shallow stream cutting across it.',
  'tourism/catalog/destination/ben-tre/gallery-06':
    'Wooden rowing boats moored in a narrow channel under a shade net, two women in conical hats sitting in one of them.',
  'tourism/catalog/destination/ben-tre/gallery-07':
    'A green waterway roofed on both sides by tall nipa palms leaning right over the surface.',
  'tourism/catalog/destination/ben-tre/gallery-08':
    'Nipa palms mirrored in a glassy creek, a single boat barely visible in the shade at the far end.',
  'tourism/catalog/destination/ben-tre/gallery-09':
    'Coconut palms leaning over a flooded field, banana leaves and rough grass in the foreground under a white sky.',
  'tourism/catalog/destination/can-tho/gallery-01':
    'A trader poling a boat piled with produce through the rafted-up boats of Cái Răng floating market in late afternoon light.',
  'tourism/catalog/destination/cat-ba/gallery-01':
    'The orange bow of a kayak on flat emerald water in front of a limestone cliff furred with jungle.',
  'tourism/catalog/destination/cat-ba/gallery-02':
    'Sunset over the harbour, a long pier and moored fishing boats in silhouette with islands strung across the horizon.',
  'tourism/catalog/destination/cat-ba/gallery-03':
    'Rank after rank of forested karst peaks fading into blue haze, seen over the leaves of a hilltop.',
  'tourism/catalog/destination/cat-ba/gallery-04':
    'Floating fish farms scattered across a bay at dusk with their lights coming on, karst islands dark against an orange sky.',
  'tourism/catalog/destination/cat-ba/gallery-05':
    'A macaque and its young sitting together on a sandy beach, a limestone islet rising out of the water behind them.',
  'tourism/catalog/destination/cat-ba/gallery-06':
    'A macaque perched on jagged weathered limestone high above a bay, forested hills behind.',
  'tourism/catalog/destination/cat-ba/gallery-07':
    'The sun low and hazy over the harbour, boats scattered across the water and one crossing its reflection.',
  'tourism/catalog/destination/cat-ba/gallery-08':
    'A yellow-hulled tour boat and two smaller boats on flat water beneath a cluster of forested karst islands.',
  'tourism/catalog/destination/da-lat/gallery-01':
    'Tall pines on a slope with a stone path running down through them, a bench and a signpost beside it and hazy hills beyond.',
  'tourism/catalog/destination/da-lat/gallery-02':
    'Pines on a red-earth bank above a still lake, low sun raking across the trunks and lighting the needle-strewn ground.',
  'tourism/catalog/destination/da-lat/gallery-03':
    'A pine-covered spur reaching out into a wide lake, forested hills standing behind it in flat morning light.',
  'tourism/catalog/destination/da-lat/gallery-04':
    'Friends around a table on a hillside terrace at night, lamps strung above them and the lights of the town spread out in the valley below.',
  'tourism/catalog/destination/da-lat/gallery-05':
    "Đà Lạt's cathedral at the end of an empty street, its tall spire and clock tower rising above pines on both kerbs.",
  'tourism/catalog/destination/da-lat/gallery-06':
    'Scattered pines on a grassy ridge at dawn, mist lying along the valley below and a serrated mountain on the horizon.',
  'tourism/catalog/destination/da-lat/gallery-07':
    'A sea of mist filling the valleys at sunrise, one conical hill standing clear above it and greenhouses catching the light.',
  'tourism/catalog/destination/da-lat/gallery-08':
    'A brick path through a flower garden lined with ornate lamp posts, sun flaring behind one of them and beds of lavender and roses on both sides.',
  'tourism/catalog/destination/da-lat/gallery-09':
    'Swan pedal boats moored in a row along a jetty, a wide lake and a rounded forested hill beyond them.',
  'tourism/catalog/destination/da-nang/gallery-01':
    'The Dragon Bridge stretched across the Hàn River in early light, its yellow steel body arching over flat water with palms along the promenade.',
  'tourism/catalog/destination/da-nang/gallery-02':
    'The Golden Bridge from below, its deck packed with visitors and held up by two giant weathered stone hands, fir tops in the foreground.',
  'tourism/catalog/destination/da-nang/gallery-03':
    "Round basket boats drawn up on a beach with a fleet of fishing boats anchored offshore and the city's towers along the far end of the bay.",
  'tourism/catalog/destination/da-nang/gallery-04':
    'The white Lady Buddha statue standing above an altar crowded with bundles of incense sticks and red gladioli.',
  'tourism/catalog/destination/da-nang/gallery-05':
    'A dark carved-wood shrine standing inside a cave, its tiled roof and lit doorways glowing against the rock walls.',
  'tourism/catalog/destination/da-nang/gallery-06':
    'A line of round basket boats on wet sand at the edge of breaking surf, seen from directly above.',
  'tourism/catalog/destination/da-nang/gallery-07':
    'The Golden Bridge curving round the hilltop at dawn, the giant hands holding it above forested slopes with cloud lying over the plain below.',
  'tourism/catalog/destination/da-nang/gallery-08':
    'A vendor handing over a paper tray of grilled snacks at a night market stall, skewers laid out on the grill in front.',
  'tourism/catalog/destination/da-nang/gallery-09':
    'The Hàn River at dusk with the Dragon Bridge in the foreground and a cable-stayed bridge beyond, the city skyline along both banks.',
  'tourism/catalog/destination/da-nang/gallery-10':
    'A pagoda with a green tiled roof and sweeping eaves lit at dusk, bonsai and a limestone rockery filling the courtyard in front.',
  'tourism/catalog/destination/da-nang/gallery-11':
    'Surf running up a pale beach beside a fringe of coconut palms and a single white parasol, seen from directly above.',
  'tourism/catalog/destination/da-nang/gallery-12':
    'A seven-tiered stone pagoda with a carved dharma wheel on each level, shrubs and potted chrysanthemums around its base.',
  'tourism/catalog/destination/da-nang/gallery-13':
    'A road threading through a deep green mountain valley under heavy cloud, steep ridges closing in on both sides.',
  'tourism/catalog/destination/da-nang/gallery-14':
    'A stone laughing Buddha seated in front of a temple with an orange tiled roof and painted murals along its walls.',
  'tourism/catalog/destination/da-nang/gallery-15':
    'Basket boats and a wooden boat on the sand under a heavy storm sky, a small Vietnamese flag planted among them and a fishing fleet offshore.',
  'tourism/catalog/destination/da-nang/gallery-16':
    'A gilded shrine deep inside a cave, lit warm against wet mossy rock that rises out of the frame.',
  'tourism/catalog/destination/da-nang/gallery-17':
    'A wide empty beach between a dense line of coconut palms and turquoise surf, seen from directly above.',
};
