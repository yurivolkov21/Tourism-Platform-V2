/**
 * Toạ độ 19 địa danh — dùng để tìm ảnh Wikimedia Commons bằng `list=geosearch`.
 *
 * Vì sao toạ độ nằm ở ĐÂY chứ không phải trong `Destination`: đây là metadata
 * phục vụ việc TÌM NGUỒN ẢNH, không phải dữ liệu sản phẩm. Site không có bản đồ
 * địa danh, không có tính năng nào đọc toạ độ này. Nhét vào schema là thêm cột
 * chết. Nếu sau này có bản đồ địa danh thì lúc đó mới migrate lên.
 *
 * `radiusKm` chỉnh theo tầm vóc từng nơi: thành phố lấy hẹp để không kéo ảnh
 * ngoại thành; vịnh/vườn quốc gia lấy rộng vì cảnh trải dài. Đây là số đã đo
 * bằng tay — nới rộng thì lẫn ảnh nơi khác, thu hẹp thì không đủ ảnh.
 *
 * `terms` là từ khoá dự phòng cho Pixabay khi Commons không đủ 10 ảnh đạt.
 */
export interface DestinationSource {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  terms: string[];
}

export const destinationSources: DestinationSource[] = [
  // ---- Miền Bắc ----
  {
    slug: 'hanoi',
    name: 'Hà Nội',
    lat: 21.0333,
    lon: 105.85,
    radiusKm: 6,
    terms: ['hanoi old quarter', 'hanoi vietnam'],
  },
  {
    slug: 'ha-long',
    name: 'Hạ Long',
    lat: 20.9101,
    lon: 107.1839,
    radiusKm: 20,
    terms: ['ha long bay', 'halong bay vietnam'],
  },
  {
    slug: 'cat-ba',
    name: 'Cát Bà',
    lat: 20.7278,
    lon: 107.0489,
    radiusKm: 12,
    terms: ['cat ba island', 'cat ba vietnam'],
  },
  {
    slug: 'sa-pa',
    name: 'Sa Pa',
    lat: 22.3364,
    lon: 103.8438,
    radiusKm: 12,
    terms: ['sapa rice terraces', 'sapa vietnam'],
  },
  {
    slug: 'ninh-binh',
    name: 'Ninh Bình',
    lat: 20.2506,
    lon: 105.9744,
    radiusKm: 15,
    terms: ['trang an ninh binh', 'tam coc vietnam'],
  },
  {
    slug: 'ha-giang',
    name: 'Hà Giang',
    lat: 23.0,
    lon: 105.0,
    radiusKm: 25,
    terms: ['ha giang loop', 'dong van karst'],
  },
  {
    slug: 'mai-chau',
    name: 'Mai Châu',
    lat: 20.6606,
    lon: 105.0847,
    radiusKm: 10,
    terms: ['mai chau valley', 'mai chau vietnam'],
  },
  // ---- Miền Trung ----
  {
    slug: 'hue',
    name: 'Huế',
    lat: 16.4637,
    lon: 107.5909,
    radiusKm: 10,
    terms: ['hue imperial city', 'hue citadel'],
  },
  {
    slug: 'hoi-an',
    name: 'Hội An',
    lat: 15.8801,
    lon: 108.338,
    radiusKm: 8,
    terms: ['hoi an ancient town', 'hoi an lanterns'],
  },
  {
    slug: 'da-nang',
    name: 'Đà Nẵng',
    lat: 16.0544,
    lon: 108.2022,
    radiusKm: 15,
    terms: ['da nang vietnam', 'golden bridge ba na'],
  },
  {
    slug: 'phong-nha',
    name: 'Phong Nha',
    lat: 17.5333,
    lon: 106.2833,
    radiusKm: 20,
    terms: ['phong nha cave', 'phong nha ke bang'],
  },
  {
    slug: 'quy-nhon',
    name: 'Quy Nhơn',
    lat: 13.7829,
    lon: 109.2196,
    radiusKm: 15,
    terms: ['quy nhon beach', 'quy nhon vietnam'],
  },
  // ---- Miền Nam ----
  {
    slug: 'ho-chi-minh-city',
    name: 'TP. Hồ Chí Minh',
    lat: 10.7769,
    lon: 106.7009,
    radiusKm: 8,
    terms: ['ho chi minh city', 'saigon vietnam'],
  },
  {
    slug: 'vung-tau',
    name: 'Vũng Tàu',
    lat: 10.346,
    lon: 107.0843,
    radiusKm: 10,
    terms: ['vung tau beach', 'vung tau vietnam'],
  },
  {
    slug: 'can-tho',
    name: 'Cần Thơ',
    lat: 10.0452,
    lon: 105.7469,
    radiusKm: 15,
    terms: ['cai rang floating market', 'mekong delta'],
  },
  {
    slug: 'ben-tre',
    name: 'Bến Tre',
    lat: 10.2415,
    lon: 106.3759,
    radiusKm: 15,
    terms: ['ben tre coconut', 'mekong delta canal'],
  },
  {
    slug: 'da-lat',
    name: 'Đà Lạt',
    lat: 11.9404,
    lon: 108.4583,
    radiusKm: 12,
    terms: ['da lat vietnam', 'dalat highlands'],
  },
  {
    slug: 'phu-quoc',
    name: 'Phú Quốc',
    lat: 10.2899,
    lon: 103.984,
    radiusKm: 25,
    terms: ['phu quoc island', 'phu quoc beach'],
  },
  {
    slug: 'con-dao',
    name: 'Côn Đảo',
    lat: 8.6833,
    lon: 106.6,
    radiusKm: 20,
    terms: ['con dao island', 'con dao vietnam'],
  },
];
