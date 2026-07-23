import type { MockDestination } from './types.js';

// 9 địa điểm nổi bật cho gallery Home (review #14): mỗi vùng đúng 3, xếp liền
// mạch Bắc → Trung → Nam theo trục địa lý. Số biên tập cố định — DB thật sau
// này dùng cờ `featured` + thứ tự, không phải "có bao nhiêu hiện bấy nhiêu".
// Ứng viên schema khi gắn API: bảng `destinations` (name, region, featured,
// sortOrder, image, quan hệ đếm tour).
export const DESTINATIONS: MockDestination[] = [
  // ── Bắc ──
  { slug: 'sa-pa', name: 'Sa Pa', region: 'north', tourCount: 8, blurb: 'Misty rice terraces' },
  {
    slug: 'ha-long',
    name: 'Hạ Long',
    region: 'north',
    tourCount: 9,
    blurb: 'Limestone bay cruises',
  },
  {
    slug: 'ninh-binh',
    name: 'Ninh Bình',
    region: 'north',
    tourCount: 7,
    blurb: 'River caves & karst peaks',
  },
  // ── Trung ──
  {
    slug: 'hue',
    name: 'Huế',
    region: 'central',
    tourCount: 8,
    blurb: 'Imperial citadel & royal food',
  },
  {
    slug: 'da-nang',
    name: 'Đà Nẵng',
    region: 'central',
    tourCount: 9,
    blurb: 'Coast rides & Golden Bridge',
  },
  {
    slug: 'hoi-an',
    name: 'Hội An',
    region: 'central',
    tourCount: 10,
    blurb: 'Lantern-lit old town',
  },
  // ── Nam ──
  {
    slug: 'sai-gon',
    name: 'Sài Gòn',
    region: 'south',
    tourCount: 6,
    blurb: 'Street food & history',
  },
  {
    slug: 'can-tho',
    name: 'Cần Thơ',
    region: 'south',
    tourCount: 6,
    blurb: 'Floating markets at dawn',
  },
  {
    slug: 'phu-quoc',
    name: 'Phú Quốc',
    region: 'south',
    tourCount: 5,
    blurb: 'Island reefs & fish sauce',
  },
];
