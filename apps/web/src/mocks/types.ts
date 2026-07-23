// Shape mock TỰ DO theo nhu cầu UI (quy trình static-first) — cố tình KHÔNG ép
// theo Prisma schema: chỗ nào vượt ra ngoài schema chính là danh sách trường
// cần thêm khi chốt trang và gắn API (xem memory static-first-page-building).

export type MockRegionKey = 'north' | 'central' | 'south';

export interface MockTour {
  slug: string;
  title: string;
  region: MockRegionKey;
  /** Dòng meta ngắn: "Quang Ninh · junk boat · kayaking" */
  place: string;
  days: number;
  priceUsd: number;
  /** Giá gạch (khuyến mãi) — hiển thị line-through */
  compareUsd?: number;
  rating: number;
  reviews: number;
  tags: string[];
  /** Đường dẫn ảnh trong public, vd "/mock/halong.jpg" */
  image: string;
  /** Cờ khẩn (đỏ sơn mài) — tối đa 1 tour dùng, vd "−20% TODAY" */
  flag?: string;
  summary: string;
}

export interface MockRegion {
  key: MockRegionKey;
  name: string;
  tagline: string;
  tourCount: number;
}

export interface MockTestimonial {
  name: string;
  tour: string;
  quote: string;
  rating: number;
}

export interface MockJournalPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date hiển thị dạng "Oct 2026" */
  date: string;
  readMinutes: number;
  image: string;
}
