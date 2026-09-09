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
  'tourism/catalog/destination/ha-giang/gallery-01':
    'Terraced fields curving around green hills in morning sun, a river running along the valley floor and farmhouses scattered among the paddies.',
  'tourism/catalog/destination/ha-giang/gallery-02':
    'A road switchbacking down a green mountainside, white and yellow wildflowers close in the foreground and karst ranges receding behind.',
  'tourism/catalog/destination/ha-giang/gallery-03':
    'A tin-roofed farmhouse on a spur above a valley of maize plots and a small lake, mountains stacked behind in evening light.',
  'tourism/catalog/destination/ha-long/gallery-01':
    'Rowing boats of visitors in orange life jackets gliding beneath a huge grey limestone cliff that drops straight into jade water.',
  'tourism/catalog/destination/hanoi/gallery-01':
    'Hanoi Train Street at dusk, paper lanterns strung overhead and café tables crowding right up to both sides of the track.',
  'tourism/catalog/destination/hanoi/gallery-02':
    'The gate of the Temple of Literature at the end of a shaded path, its grey tiered pavilion standing between old trees with red poinsettias beside the walk.',
  'tourism/catalog/destination/hanoi/gallery-03':
    'The Hồ Chí Minh Mausoleum under a heavy gold-lit sky, the national flag flying beside its stone colonnade and clipped hedges around the base.',
  'tourism/catalog/destination/hanoi/gallery-04':
    'The Hanoi Opera House lit up at night beneath a full moon, headlight trails streaking across the road in front of it.',
  'tourism/catalog/destination/hanoi/gallery-05':
    'The red tiered tower of Trấn Quốc Pagoda rising above trees on the lakeshore, seen across flat green water.',
  'tourism/catalog/destination/hanoi/gallery-06':
    'The red Húc Bridge on its slender pillars over Hoàn Kiếm Lake, framed by overhanging branches and doubled in the water below.',
  'tourism/catalog/destination/hanoi/gallery-07':
    'A train pushing slowly down Hanoi Train Street at night with its headlights on, crowds pressed back against the lantern-hung cafés on both sides.',
  'tourism/catalog/destination/hanoi/gallery-08':
    'A red lacquered pavilion raised on a white stone base, its round windows and carved balustrade under a tiled roof, seen from below.',
  'tourism/catalog/destination/hanoi/gallery-09':
    'The front of the Hồ Chí Minh Mausoleum with two honour guards in white standing at the doorway and rows of yellow flower wreaths along the terrace.',
  'tourism/catalog/destination/hanoi/gallery-10':
    'The Hanoi Opera House floodlit at night, its reflection and the light trails of passing traffic laid out across the wet ground in front.',
  'tourism/catalog/destination/hanoi/gallery-11':
    'The weathered stone gate of an old temple seen from below, moss along its curved roof and carved characters running down the pillar beside it.',
  'tourism/catalog/destination/hanoi/gallery-12':
    'A worker in a conical hat pouring dried yellow beans into a wide flat basket, standing among rows of big earthenware fermentation jars.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-01':
    'Riverside towers lit up under a sky full of stars, the tallest tapering to a lit crown, with a bridge under construction on the near bank.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-02':
    'A dense crowd of motorbikes filling a street at night under strings of light, riders in helmets packed shoulder to shoulder.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-03':
    'The pink church at Tân Định seen from below, its rose window, spires and lace-white trim standing against a cloudy sky.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-04':
    'A lit street-food stall at night with the cook behind the counter and plastic stools out front, a motorbike blurring past in the foreground.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-05':
    'The pale yellow façade of the Central Post Office with its white stucco scrollwork and a clock set into the great arched window.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-06':
    'The downtown skyline at dusk seen across the river, lit towers against a pink and blue sky with the promenade glowing below.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-07':
    'A street strung end to end with rows of small red flags, restaurant fronts under red banners and motorbikes parked along the kerb.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-08':
    'A café apartment block at night, every balcony in the grid holding a different lit sign and string of bulbs, people on the pavement below.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-09':
    'The pink church from below against a bright blue sky, a palm frond leaning into the frame beside its spires.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-10':
    'Skewers of pork and sweetcorn cooking over charcoal on a street grill, smoke drifting up through the racks.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-11':
    'The skyline at night from across the river, each tower picked out in a different colour of light.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-12':
    'Motorbikes riding a palm-lined boulevard past a bed of red flowers, a colonial building with green shutters along the right.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-13':
    'The Central Post Office seen from below, the flag on its roof and the clock in the arched window sharp against a clear sky.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-14':
    'The pink church from above, its spire and long tiled nave hemmed in by dense city blocks with traffic passing on the street below.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-15':
    "A bronze statue with one hand raised on a plinth in front of the People's Committee building, flowers laid at its base.",
  'tourism/catalog/destination/ho-chi-minh-city/gallery-16':
    'The skyline at blue hour across the river, seen from a rocky bank where old wooden pilings stand out of the water.',
  'tourism/catalog/destination/ho-chi-minh-city/gallery-17':
    'A café balcony of bar stools looking straight across at the pink church, monstera leaves framing one side of the view.',
  'tourism/catalog/destination/hoi-an/gallery-01':
    'Wooden boats moored along the river with big round lanterns on their prows, the yellow shophouse waterfront and its crowds behind them.',
  'tourism/catalog/destination/hoi-an/gallery-02':
    'A canopy of lit silk lanterns in every colour and shape hanging close together under leaves.',
  'tourism/catalog/destination/hoi-an/gallery-03':
    'An Old Town street with bolts of fabric hung outside the tailor shops, bougainvillea overhead and people strolling and cycling down the middle.',
  'tourism/catalog/destination/hoi-an/gallery-04':
    'A mustard-yellow shophouse with blue shutters smothered in flowering vine, red lanterns strung under the awning and a cyclist blurring past.',
  'tourism/catalog/destination/hoi-an/gallery-05':
    'A wooden footbridge over a canal at the edge of town, a painted signboard on its rail and a café under a big tree on the far bank.',
  'tourism/catalog/destination/hoi-an/gallery-06':
    'Rows of wooden boats packed along the river in low sun, their bows loaded with paper lanterns and the yellow waterfront standing behind.',
  'tourism/catalog/destination/hoi-an/gallery-07':
    'Silk lanterns of many shapes hung close together in a lit courtyard, red envelopes and ribbons dangling among them.',
  'tourism/catalog/destination/hoi-an/gallery-08':
    'Cyclos and cyclists moving down an Old Town street at dusk between shopfronts hung with glowing lanterns.',
  'tourism/catalog/destination/hoi-an/gallery-09':
    'The waterfront seen from across the river, a terrace of old tiled-roof houses with people walking the quay and boats moored below.',
  'tourism/catalog/destination/hoi-an/gallery-10':
    'A huge bougainvillea in full pink flower spilling over the front of a yellow café, people posing beneath it while motorbikes blur past.',
  'tourism/catalog/destination/hoi-an/gallery-11':
    'A pink bicycle propped against a yellow wall beside a wooden shop doorway, bamboo and a small lantern hanging above it.',
  'tourism/catalog/destination/hoi-an/gallery-12':
    'Three green cyclos parked under a spreading tree on a quiet corner of yellow houses in early light.',
  'tourism/catalog/destination/hoi-an/gallery-13':
    'A crowd filling a narrow Old Town street with a Vietnamese flag hanging from a balcony, woven palm-leaf figures in the foreground.',
  'tourism/catalog/destination/hoi-an/gallery-14':
    'A tour boat moored in front of a two-storey yellow assembly hall with a tiled roof and red banners, seen from the water.',
  'tourism/catalog/destination/hoi-an/gallery-15':
    'Round basket boats crowded into a village creek, ferrymen paddling among them and thatched stalls lining the bank.',
  'tourism/catalog/destination/hoi-an/gallery-16':
    'A plank walkway zigzagging across a marsh toward jungle and a mountain half-covered in cloud.',
  'tourism/catalog/destination/hoi-an/gallery-17':
    'A long weathered brick wall of a Chăm temple with carved pilasters and lattice windows, fallen columns lying in front of it.',
  'tourism/catalog/destination/hue/gallery-01':
    'The tiered pavilion of the Huế citadel gate riding its stone rampart, glazed roof tiles catching the light and potted chrysanthemums lining the ramps below.',
  'tourism/catalog/destination/mai-chau/gallery-01':
    'A bicycle parked at the edge of a vivid green paddy, a farmer in a conical hat working among the maize rows behind.',
  'tourism/catalog/destination/mai-chau/gallery-02':
    'Rice fields at sunset with mountains fading behind, a farmer walking the bund and part of the crop already cut.',
  'tourism/catalog/destination/mai-chau/gallery-03':
    'A wooden deck with tree-stump stools looking out across a green paddy toward a wall of forested karst peaks.',
  'tourism/catalog/destination/ninh-binh/gallery-01':
    'A brown river winding between forested karst peaks with paddy fields along both banks, seen from high above.',
  'tourism/catalog/destination/ninh-binh/gallery-02':
    'A dark tiled temple pavilion standing on stilts in a green river below a jungle cliff, a rowing boat passing in front of it.',
  'tourism/catalog/destination/ninh-binh/gallery-03':
    'The stone stairway at Mua Cave climbing a jagged peak to a small pagoda at the top, rice fields spreading to the horizon in evening light.',
  'tourism/catalog/destination/ninh-binh/gallery-04':
    'A boatman poling a bamboo raft at sunrise, karst peaks in silhouette and the sun laying a bright track across the water.',
  'tourism/catalog/destination/ninh-binh/gallery-05':
    'A rounded scrub-covered karst hill standing alone in ripe golden rice fields with a farmhouse at its foot.',
  'tourism/catalog/destination/ninh-binh/gallery-06':
    'Rowing boats setting out from under a low cave mouth, passengers in orange life jackets and daylight and reeds beyond.',
  'tourism/catalog/destination/ninh-binh/gallery-07':
    'A canal running along the foot of a limestone cliff between bright green paddies, a white path on the bund and karst peaks in the distance.',
  'tourism/catalog/destination/ninh-binh/gallery-08':
    'The bow of a boat with a small red flag heading up a river between steep jungle-covered karst.',
  'tourism/catalog/destination/ninh-binh/gallery-09':
    'Seen over the shoulder of a woman in a conical hat, a boat moving up a still river toward a tall karst peak.',
  'tourism/catalog/destination/ninh-binh/gallery-10':
    'Rowing boats crossing a lake in front of a stone temple pavilion on stilts, the view framed by overhanging leaves.',
  'tourism/catalog/destination/ninh-binh/gallery-11':
    'A river curving through a valley of paddy and karst peaks under a clear sky, seen from a hilltop.',
  'tourism/catalog/destination/ninh-binh/gallery-12':
    'The Mua Cave stairway and its peak in heavy rain haze, flooded paddies and village roofs spread out grey below.',
  'tourism/catalog/destination/ninh-binh/gallery-13':
    'A stone pagoda tower lit gold at dusk on a rocky summit, safety chains strung along the rock and dark karst behind.',
  'tourism/catalog/destination/ninh-binh/gallery-14':
    'A rowing boat carrying passengers up a green river toward a sunlit gap between jungle cliffs, leaves framing the top of the view.',
  'tourism/catalog/destination/phong-nha/gallery-01':
    'Looking out from inside a huge cave mouth toward daylight, a sandy floor and shallow pool below jungle-covered cliffs.',
  'tourism/catalog/destination/phong-nha/gallery-02':
    'A camp of small tents on a sand bank deep inside a cave, turquoise water beside them and daylight pouring in through the far entrance.',
  'tourism/catalog/destination/phong-nha/gallery-03':
    'A brown river curving past a town of tiled roofs with blue tour boats moored along the bank and karst ridges standing behind, seen from above.',
  'tourism/catalog/destination/phong-nha/gallery-04':
    'A wide green valley running between karst ridges under a big cloudy sky, seen from a forested ridge.',
  'tourism/catalog/destination/phong-nha/gallery-05':
    'A line of blue tour boats moored along a stone quay under a tree, jungle-covered karst rising across the green river.',
  'tourism/catalog/destination/phong-nha/gallery-06':
    'A blue tour boat of passengers in orange life jackets in front of a cave entrance set into a cliff face, a second boat waiting behind.',
  'tourism/catalog/destination/phong-nha/gallery-07':
    'The low arched ceiling of a river cave lit dim gold, folds of rock overhead and black water below.',
  'tourism/catalog/destination/phong-nha/gallery-08':
    'A lit cave chamber with a massive stalagmite column, rippled formations covering the walls and ceiling and a walkway running below.',
  'tourism/catalog/destination/phu-quoc/gallery-01':
    'A canal lined with pastel arcaded buildings in Venetian style, gondola-shaped boats moored along the near bank.',
  'tourism/catalog/destination/phu-quoc/gallery-02':
    'The same pastel canal seen from a bridge, colourful buildings down both banks with young trees and café umbrellas along the water.',
  'tourism/catalog/destination/phu-quoc/gallery-03':
    'Fireworks bursting over the water beside a lit clock tower, palms in silhouette along the shore below.',
  'tourism/catalog/destination/phu-quoc/gallery-04':
    'A resort quarter at sunset gathered around an orange clock tower, a curved footbridge reaching out over a calm gold sea.',
  'tourism/catalog/destination/phu-quoc/gallery-05':
    'A fishing town from the air with hundreds of blue boats packed into the harbour, a green headland and islands beyond.',
  'tourism/catalog/destination/quy-nhon/gallery-01':
    'A long crescent beach with basket boats drawn up on the sand, a mountain headland behind and wind turbines along its ridge.',
  'tourism/catalog/destination/quy-nhon/gallery-02':
    'A long low wooden pier running out to a jungle-covered hillside above clear green water.',
  'tourism/catalog/destination/quy-nhon/gallery-03':
    'Waves washing over rocks below a steep headland, a long exposure blurring the surf to white mist.',
  'tourism/catalog/destination/quy-nhon/gallery-04':
    'Sun-loungers beside a pool ringed with coconut palms and shade sails, the open sea just beyond the terrace.',
  'tourism/catalog/destination/quy-nhon/gallery-05':
    'A grey-blue evening at the beach with swimmers in the shallows, mountains along the far shore and town buildings at the end of the bay.',
  'tourism/catalog/destination/sa-pa/gallery-01':
    'Rice terraces at harvest colour curving up a hillside in strong sun, a bamboo fence running along the path in the foreground.',
  'tourism/catalog/destination/vung-tau/gallery-01':
    'A spread of dishes on banana leaves: fried soft-shell crab, a clay pot of clam soup, raw vegetables with dipping sauce and a tall glass of sugarcane juice.',
  'tourism/catalog/destination/vung-tau/gallery-02':
    'A customer using tongs to pick shellfish from trays of clams, mussels and oysters laid out on ice at a seafood counter.',
  'tourism/catalog/destination/vung-tau/gallery-03':
    'Two thin casuarina trees in silhouette against a sea lit by low sun, a rocky shore in the foreground.',
  'tourism/catalog/destination/vung-tau/gallery-04':
    'Raw tiger prawns on a grill basket on a rough wooden table, with scallops on the half shell and cooked crabs on side plates.',
  'tourism/catalog/destination/vung-tau/gallery-05':
    'Surf breaking white over black boulders below a stone sea wall, a drainage pipe set into the wall above.',
  'tourism/catalog/destination/vung-tau/gallery-06':
    'The town seen from a hillside through the red flowers of a flame tree, towers along the shore and a lagoon behind them.',

  // ── Slot brand-chrome của site (48) ───────────────────────────────────────
  // Nhiều slot dùng lại đúng tấm ảnh của gallery địa danh (upload thành asset
  // riêng nên publicId khác); alt giữ NGUYÊN câu, vì cùng ảnh thì cùng nội dung.
  'tourism/catalog/site/about-cta-video':
    'A natural rock arch high in a cliff framing a green karst valley, the camera drifting slowly toward the opening.',
  'tourism/catalog/site/about-gallery-all':
    'A turquoise bay ringed with forested karst towers, a curved beach along one side and boats moored off it, seen from a cliff path.',
  'tourism/catalog/site/about-gallery-central':
    'A long crescent bay with a palm-backed beach seen from a forested headland, sun glinting off the open sea beyond.',
  'tourism/catalog/site/about-gallery-north':
    'Ripe rice fields in front of a row of dark stilt houses, cloud pouring over the mountain rising behind them.',
  'tourism/catalog/site/about-gallery-south':
    'Round basket boats crowded along a river channel beside thatched huts, a bank of nipa palms on the far side.',
  'tourism/catalog/site/about-hero':
    'A valley of rice terraces at sunrise with mist between the ridges and a hamlet on the slope below.',
  'tourism/catalog/site/about-story':
    'A vintage blue camper van with its roof tent raised, parked alone on a headland above the sea at sunset.',
  'tourism/catalog/site/about-team-ceo':
    'A blocky pixel-art robot in green on a pale background, standing in for a portrait photograph.',
  'tourism/catalog/site/about-team-guides':
    'A blocky pixel-art robot in lilac on a pale background, standing in for a portrait photograph.',
  'tourism/catalog/site/about-team-ops':
    'A blocky pixel-art robot in mint green with a yellow heart on its chest, standing in for a portrait photograph.',
  'tourism/catalog/site/about-team-routes':
    'A blocky pixel-art robot in pink on a pale background, standing in for a portrait photograph.',
  'tourism/catalog/site/about-timeline-2014':
    'Terraced fields curving down a hillside in early sun, two figures walking a bund and mist rising off the ridge behind.',
  'tourism/catalog/site/about-timeline-2017':
    'Two filled baguettes on a board with coriander, pickled carrot and cucumber, a dish of mustard beside them and an iced green drink behind.',
  'tourism/catalog/site/about-timeline-2021':
    'A resort bay at sunset from the air, low villas following a curved beach with islands strung along the horizon.',
  'tourism/catalog/site/about-timeline-2026':
    'Visitors walking a dirt path between lotus ponds toward a karst peak, the one in front wearing a conical hat.',
  'tourism/catalog/site/auth-panel':
    'The red funicular carriage climbing the last ridge to the Fansipan summit at sunrise, a bronze Buddha and clock tower standing above a sea of cloud.',
  'tourism/catalog/site/contact-panel':
    'Travel things laid out on a map and shot from above: leather boots, two cameras, a magnifying glass, a pipe, a notebook and a cup of coffee.',
  'tourism/catalog/site/cta-band':
    'A wooden deck with tree-stump stools looking out across a green paddy toward a wall of forested karst peaks.',
  'tourism/catalog/site/home-hero':
    'A city at sunrise from the air, one tall tower standing black against the sun with the river and low haze spreading around it.',
  'tourism/catalog/site/home-why-choose':
    'A river curving between karst mountains and paddy fields, villages strung along both banks under towering cloud.',
  'tourism/catalog/site/moment-bentre-canal':
    'The bow of a wooden sampan with its coiled rope, pointing down a green channel that nipa palms close over from both sides.',
  'tourism/catalog/site/moment-hagiang-valley':
    'A road switchbacking down a green mountainside, white and yellow wildflowers close in the foreground and karst ranges receding behind.',
  'tourism/catalog/site/moment-hoian-river':
    'Wooden boats moored along the river with big round lanterns on their prows, the yellow shophouse waterfront and its crowds behind them.',
  'tourism/catalog/site/moment-lanha-kayak':
    'The orange bow of a kayak on flat emerald water in front of a limestone cliff furred with jungle.',
  'tourism/catalog/site/moment-myson-towers':
    'A long weathered brick wall of a Chăm temple with carved pilasters and lattice windows, fallen columns lying in front of it.',
  'tourism/catalog/site/region-gallery-central-1':
    'Wooden boats moored along the river with big round lanterns on their prows, the yellow shophouse waterfront and its crowds behind them.',
  'tourism/catalog/site/region-gallery-central-2':
    'Rows of wooden boats packed along the river in low sun, their bows loaded with paper lanterns and the yellow waterfront standing behind.',
  'tourism/catalog/site/region-gallery-central-3':
    'The Golden Bridge curving round the hilltop at dawn, the giant hands holding it above forested slopes with cloud lying over the plain below.',
  'tourism/catalog/site/region-gallery-central-4':
    'The white Lady Buddha statue standing above an altar crowded with bundles of incense sticks and red gladioli.',
  'tourism/catalog/site/region-gallery-central-5':
    'Basket boats and a wooden boat on the sand under a heavy storm sky, a small Vietnamese flag planted among them and a fishing fleet offshore.',
  'tourism/catalog/site/region-gallery-central-6':
    'Looking out from inside a huge cave mouth toward daylight, a sandy floor and shallow pool below jungle-covered cliffs.',
  'tourism/catalog/site/region-gallery-north-1':
    'A yellow-hulled tour boat and two smaller boats on flat water beneath a cluster of forested karst islands.',
  'tourism/catalog/site/region-gallery-north-2':
    'Rowing boats setting out from under a low cave mouth, passengers in orange life jackets and daylight and reeds beyond.',
  'tourism/catalog/site/region-gallery-north-3':
    'The stone stairway at Mua Cave climbing a jagged peak to a small pagoda at the top, rice fields spreading to the horizon in evening light.',
  'tourism/catalog/site/region-gallery-north-4':
    'Terraced fields curving around green hills in morning sun, a river running along the valley floor and farmhouses scattered among the paddies.',
  'tourism/catalog/site/region-gallery-north-5':
    'Hanoi Train Street at dusk, paper lanterns strung overhead and café tables crowding right up to both sides of the track.',
  'tourism/catalog/site/region-gallery-north-6':
    'Rice fields at sunset with mountains fading behind, a farmer walking the bund and part of the crop already cut.',
  'tourism/catalog/site/region-gallery-south-1':
    'A fishing town from the air with hundreds of blue boats packed into the harbour, a green headland and islands beyond.',
  'tourism/catalog/site/region-gallery-south-2':
    'The skyline at blue hour across the river, seen from a rocky bank where old wooden pilings stand out of the water.',
  'tourism/catalog/site/region-gallery-south-3':
    'Wooden sampans painted blue and red waiting in a muddy Mekong canal, rowers in conical hats sitting at the oars, seen from the bank above.',
  'tourism/catalog/site/region-signature-south-1':
    'Wooden rowing boats moored in a narrow channel under a shade net, two women in conical hats sitting in one of them.',
  'tourism/catalog/site/region-signature-south-2':
    'The pink church from above, its spire and long tiled nave hemmed in by dense city blocks with traffic passing on the street below.',
  'tourism/catalog/site/region-signature-south-3':
    'A resort quarter at sunset gathered around an orange clock tower, a curved footbridge reaching out over a calm gold sea.',
  'tourism/catalog/site/why-evening':
    'A canopy of lit silk lanterns in every colour and shape hanging close together under leaves.',
  'tourism/catalog/site/why-food':
    'A bowl of rice vermicelli with grilled beef, bean sprouts, fried shallots and herbs on a bamboo mat, a wooden spoon and a dish of peanuts beside it.',
  'tourism/catalog/site/why-guide':
    'Three hikers standing on a rock above a blue bay, one with an arm raised, a curved beach and moored boats below them.',
  'tourism/catalog/site/why-heritage':
    'An ornate pagoda tower with gilded dragon-tipped eaves against a dramatic cloudy sky, a pine and red lanterns below it.',
  'tourism/catalog/site/why-river':
    'Cruise boats scattered across a bay of forested karst islands under a clear blue sky, seen from a hilltop.',
};
