// Shape mock TỰ DO theo nhu cầu UI (quy trình static-first) — cố tình KHÔNG ép
// theo Prisma schema: chỗ nào vượt ra ngoài schema chính là danh sách trường
// cần thêm khi chốt trang và gắn API (xem memory static-first-page-building).

export type MockRegionKey = 'north' | 'central' | 'south';

// ─────────────────────────────────────────────────────────────────────────────
// Tour — NGOẠI LỆ của luật "shape tự do" ghi ở đầu file.
//
// Gương đúng TourCardSchema/TourDetailSchema của @tourism/contract. Khác các
// mock còn lại vì tour đã có contract backend chốt và GIÀU HƠN nhu cầu UI, nên
// mock đi theo contract ngay từ đầu — lúc gắn API là swap nguồn dữ liệu, không
// phải rename khắp component.
// ─────────────────────────────────────────────────────────────────────────────

/** Một destination mà tour đi qua (bảng join M:N ở backend). `isPrimary` là
    điểm đến chính; tour đi qua nhiều nơi nên contract trả CẢ mảng. */
export interface MockDestinationLink {
  slug: string;
  name: string;
  isPrimary: boolean;
}

export type MockTourDifficulty = 'EASY' | 'MODERATE' | 'CHALLENGING';
export type MockTravellerType = 'FAMILY' | 'COUPLE' | 'FRIENDS' | 'SOLO' | 'BUSINESS';
export type MockTourBadge = 'BEST_VALUE' | 'LIMITED_OFFER' | 'EXCLUSIVE' | 'NEW' | 'POPULAR';
export type MockPolicyKind = 'CANCELLATION' | 'BOOKING' | 'GENERAL';

/** Gương TourCardSchema — item của trang listing. */
export interface MockTourCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  /** Chuỗi thập phân, KHÔNG phải number — tiền luôn là string để không mất
      chính xác khi đi qua JSON. Number() chỉ dùng ở bước định dạng cuối. */
  basePrice: string;
  compareAtPrice: string | null;
  currency: string;
  durationDays: number;
  difficulty: MockTourDifficulty | null;
  maxGroupSize: number;
  isFeatured: boolean;
  destinations: MockDestinationLink[];
  category: { slug: string; name: string };
  /** null = CHƯA AI đánh giá. Khác hẳn 0 = bị chấm 0 điểm. UI phải render hai
      trạng thái này khác nhau, đừng gộp bằng falsy check. */
  ratingAvg: number | null;
  ratingCount: number;
}

export interface MockItineraryDay {
  dayNumber: number;
  title: string;
  description: string | null;
}

export interface MockTourDeparture {
  id: string;
  /** YYYY-MM-DD — cột @db.Date serialize thành ngày lịch, KHÔNG phải datetime.
      Đừng dựng new Date() từ chuỗi này: nó bị hiểu là UTC rồi hiển thị theo
      giờ máy, lệch một ngày ở múi giờ âm. */
  startDate: string;
  endDate: string;
  seatsLeft: number;
  /** = priceOverride của đợt ?? basePrice của tour. */
  effectivePrice: string;
  compareAtPrice: string | null;
}

/** Gương TourDetailSchema = card + nội dung bán hàng + đợt khởi hành.
    Schema v2 KHÔNG có cột `description` dài — thân tour chính là các mảng
    có cấu trúc dưới đây (summary nằm ở card). */
export interface MockTourDetail extends MockTourCard {
  suitableFor: MockTravellerType[];
  badges: MockTourBadge[];
  included: string[];
  excluded: string[];
  highlights: string[];
  meetingPoint: string | null;
  itinerary: MockItineraryDay[];
  faqs: { question: string; answer: string }[];
  policies: { kind: MockPolicyKind; title: string; body: string }[];
  departures: MockTourDeparture[];
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
  /** Ngày cập nhật gần nhất — chỉ có ở bài đã sửa lại sau khi đăng */
  updated?: string;
  /** Thân bài: cùng hình dạng với LegalDoc.sections nên dùng chung được
      tocFromSections + Typeset của cụm trang pháp lý */
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
}

/** Văn phòng cho trang Contact — ứng viên schema offices */
export interface MockOffice {
  city: string;
  name: string;
  addressLines: string[];
  hours: string;
}

/** Câu hỏi pre-sales cho mini-FAQ Contact — ứng viên schema faqs */
export interface MockFaqItem {
  question: string;
  answer: string;
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
