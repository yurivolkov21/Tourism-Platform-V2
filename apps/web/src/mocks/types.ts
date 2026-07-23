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
  /** Nơi ở của khách (layout Estate hiển thị name + location) */
  location: string;
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
  /** Chuyên mục hiển thị trên chip card (review #33 — convert forged/Blog) */
  category: string;
  /** Tác giả — guide bản địa, khớp câu chuyện thương hiệu */
  author: string;
}

/** Thành viên sáng lập/vận hành cho trang About §5 — ứng viên schema team_members */
export interface MockTeamMember {
  name: string;
  role: string;
  /** Một câu "chữ ký" hiển thị dưới chức danh */
  line: string;
}

/** Người dùng đăng nhập giả cho navbar — nguồn thật là Better Auth (phase auth) */
export interface MockSessionUser {
  name: string;
  email: string;
}

export interface MockMoment {
  /** Khoảnh khắc trải nghiệm của khách trên hành trình (slider ở Stats) */
  title: string;
  /** "Tên khách, tên tour" */
  credit: string;
}

export interface MockDestination {
  slug: string;
  name: string;
  region: MockRegionKey;
  /** Số tour featured tại địa điểm — tổng theo vùng phải khớp MockRegion.tourCount */
  tourCount: number;
  blurb: string;
}
