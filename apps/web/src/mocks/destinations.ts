// Value import BỎ đuôi `.js` — Turbopack không map `.js`→`.ts` (bẫy đã ghi ở đầu
// tours.ts và trong lib/toc.ts).
import { TOURS } from './tours';
import type { MockDestination } from './types.js';

// 9 địa điểm, mỗi vùng 3, xếp liền mạch Bắc → Trung → Nam theo trục địa lý.
//
// `region` mang TÊN HIỂN THỊ ('Northern Vietnam') chứ không mang khoá ('north'):
// contract khai region là chuỗi tự do, nên mock phải chứa thứ trông giống dữ liệu
// thật. Nếu để đúng khoá thì `regionOf()` thành hàm đồng nhất và không bao giờ
// được kiểm bằng input thật.
const DESTINATIONS_SOURCE: Omit<MockDestination, 'tourCount'>[] = [
  // ── Bắc ──
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000001',
    slug: 'sa-pa',
    name: 'Sa Pa',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'Misty rice terraces',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000002',
    slug: 'ha-long',
    name: 'Hạ Long',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'Limestone bay cruises',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000003',
    slug: 'ninh-binh',
    name: 'Ninh Bình',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'River caves & karst peaks',
  },
  // ── Trung ──
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000004',
    slug: 'hue',
    name: 'Huế',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: 'Imperial citadel & royal food',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000005',
    slug: 'da-nang',
    name: 'Đà Nẵng',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: 'Coast rides & Golden Bridge',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000006',
    slug: 'hoi-an',
    name: 'Hội An',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: 'Lantern-lit old town',
  },
  // ── Nam ──
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000007',
    slug: 'sai-gon',
    name: 'Sài Gòn',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description: 'Street food & history',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000008',
    slug: 'can-tho',
    name: 'Cần Thơ',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description: 'Floating markets at dawn',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000009',
    slug: 'phu-quoc',
    name: 'Phú Quốc',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description: 'Island reefs & fish sauce',
  },
];

/**
 * `tourCount` DẪN XUẤT, không viết tay — cùng lý lẽ với `ratingAvg`/`ratingCount`
 * của tour: con số in trên thẻ phải là con số của chính danh sách người đọc bấm vào
 * xem được. Bản viết tay trước đây phồng 2–5× (Hạ Long khai 9, thật 2). Ở API thật
 * đây là COUNT trên bảng join, nên dẫn xuất phản chiếu đúng quan hệ đó.
 */
export const DESTINATIONS: MockDestination[] = DESTINATIONS_SOURCE.map((dest) => ({
  ...dest,
  tourCount: TOURS.filter((tour) => tour.destinations.some((d) => d.slug === dest.slug)).length,
}));
