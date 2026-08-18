/**
 * Fixture 19 destination MỚI — thay trọn bộ 16 destination cũ của
 * `fixtures/catalog.ts` (đã xoá ở cùng commit tách này), theo spec
 * 2026-07-31-tours-catalogue-api-design.md §3.
 *
 * Series UUID MỚI (Global Constraints của plan, tránh đụng series
 * `c0000001-…` cũ): `c0000002-0000-4000-8000-0000000000NN`, NN = 01 → 19
 * ĐÚNG THỨ TỰ spec §3 liệt kê theo miền (Bắc → Trung → Nam). `region` là
 * ĐÚNG MỘT trong ba chuỗi mà `regionOf()` phía web nhận diện: 'Northern
 * Vietnam' | 'Central Vietnam' | 'Southern Vietnam'. Đà Lạt xếp Nam theo nếp
 * phân 3 vùng của site (Tây Nguyên không có vùng riêng — spec §3 chốt).
 *
 * `isActive: true` cho toàn bộ 18.
 *
 * Côn Đảo bị GỠ 18/08/2026 theo quyết định biên tập của user: nơi này là đảo tù
 * chính trị thời chiến, không phù hợp để giới thiệu như điểm du lịch trong sản
 * phẩm này. Gỡ CẢ địa danh lẫn tour #30, không phải chỉ ẩn đi.
 */

export const destinations = [
  // ---- Miền Bắc (7) ----
  {
    id: 'c0000002-0000-4000-8000-000000000001',
    slug: 'hanoi',
    name: 'Hà Nội',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description:
      "Vietnam's capital for over a thousand years, where French-era boulevards give way to the motorbike-thrummed lanes of the Old Quarter and a street-food scene built around single-dish specialists.",
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000002',
    slug: 'ha-long',
    name: 'Hạ Long',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description:
      'A UNESCO seascape of nearly two thousand limestone karsts rising from the Gulf of Tonkin, threaded by junks, sea caves, and floating fishing hamlets.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000003',
    slug: 'cat-ba',
    name: 'Cát Bà',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description:
      'The largest island in the Hạ Long archipelago, its interior a national park of langurs and karst forest, its coastline the quiet gateway to Lan Hạ Bay.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000004',
    slug: 'sa-pa',
    name: 'Sa Pa',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description:
      'A former French hill station wrapped in cloud, overlooking the terraced rice valleys of the Hoàng Liên mountains and home to Hmong, Dao and Tày villages.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000005',
    slug: 'ninh-binh',
    name: 'Ninh Bình',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description:
      'Karst towers and flooded rice fields earn this delta its "Hạ Long Bay on land" nickname, best seen by bamboo boat through Tam Cốc or Tràng An.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000006',
    slug: 'ha-giang',
    name: 'Hà Giang',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description:
      "Vietnam's northernmost frontier, where a single looping road climbs through the Đồng Văn karst plateau past the Mã Pí Lèng pass and villages that see few outsiders.",
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000007',
    slug: 'mai-chau',
    name: 'Mai Châu',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description:
      'A quiet valley of stilt-house villages and irrigated rice fields four hours from Hà Nội, home to the White Thái community and an easy first taste of highland life.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  // ---- Miền Trung (5) ----
  {
    id: 'c0000002-0000-4000-8000-000000000008',
    slug: 'hue',
    name: 'Huế',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description:
      "The Nguyễn dynasty's walled imperial capital on the Perfume River, its citadel, royal tombs and pagodas carrying two centuries of court history.",
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000009',
    slug: 'hoi-an',
    name: 'Hội An',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description:
      'A UNESCO-listed trading port frozen at its 16th-century peak, its lantern-lit merchant houses, tailor shops and riverside markets barely touched by traffic.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000010',
    slug: 'da-nang',
    name: 'Đà Nẵng',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description:
      'A fast-growing coastal city between the Marble Mountains and the Hải Vân pass, with a long swimmable beach and the Golden Bridge at Bà Nà Hills above town.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000011',
    slug: 'phong-nha',
    name: 'Phong Nha',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description:
      "A UNESCO karst park hiding some of the largest cave systems on Earth, explored by river boat, jungle trek, or a rope descent into Sơn Đoòng's neighbours.",
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000012',
    slug: 'quy-nhon',
    name: 'Quy Nhơn',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description:
      'A working fishing port turned quiet beach town on the south-central coast, its Chăm towers and empty stretches of sand still ahead of the tourist trail.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  // ---- Miền Nam (7) ----
  {
    id: 'c0000002-0000-4000-8000-000000000013',
    slug: 'ho-chi-minh-city',
    name: 'TP. Hồ Chí Minh',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description:
      "The south's commercial engine, still known to most as Saigon: colonial-era landmarks, rooftop bars, and the Củ Chi tunnel network within day-trip reach.",
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000014',
    slug: 'vung-tau',
    name: 'Vũng Tàu',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description:
      'The closest beach getaway to Sài Gòn, a two-hour drive to a seafront town of Front and Back beaches, a century-old lighthouse, and gành hào seafood over the water.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000015',
    slug: 'can-tho',
    name: 'Cần Thơ',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description:
      "The Mekong Delta's largest city, its Cái Răng floating market busiest at dawn when sampans stack fruit and vegetables under a haze of engine smoke.",
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000016',
    slug: 'ben-tre',
    name: 'Bến Tre',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description:
      'A green, canal-laced delta province built on coconut groves, its villages still making candy, mats and rope by hand along the water.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000017',
    slug: 'da-lat',
    name: 'Đà Lạt',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description:
      'A cool-climate hill town of pine forest, flower farms and French villas in the Central Highlands, its lakes and waterfalls a break from the coastal heat.',
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'c0000002-0000-4000-8000-000000000018',
    slug: 'phu-quoc',
    name: 'Phú Quốc',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description:
      "Vietnam's largest island, ringed by white-sand beaches and pepper farms, with the coral reefs of the An Thới archipelago just offshore.",
    isActive: true,
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:00.000Z',
  },
];
