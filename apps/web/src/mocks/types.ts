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
//
// `MockTourCard`/`MockTourDetail` (item listing + chi tiết đầy đủ) và
// `MockDestination` đã XOÁ ở Task 7 (cụm destinations-api) — hết consumer thật
// khi `mocks/tours.ts`/`mocks/destinations.ts` khai tử; nơi từng dùng giờ đọc
// `TourCardVM`/`TourDetailVM`/`DestinationVM` thẳng từ `@/lib/api/tours` (type
// contract THẲNG, không map field — cùng lý do ghi ở đầu file đó).
// `MockTourDifficulty`/`MockTourBadge` cũng xoá theo: hai type chỉ có một
// consumer DUY NHẤT là chính `MockTourCard` vừa xoá, không nơi nào khác import
// riêng chúng.
//
// Các type dưới đây GIỮ LẠI vì vẫn còn consumer thật độc lập với hai mock đã
// xoá (component chi tiết tour, UI tour card) — không có VM tương ứng gọn hơn
// đáng để đổi:
//  · `MockDestinationLink` — `components/tours/route-ribbon.tsx`, `lib/tours.ts`
//  · `MockTourDeparture` — `components/tours/departure-strip.tsx`,
//    `components/tours/departures-table.tsx`
//  · `MockItineraryDay` — `components/destinations/region-day-trips.tsx`
//  · `MockMediaItem` — `components/tours/tour-gallery.tsx`, `lib/tours.ts`
//    (contract CHƯA có field `media`, xem `TourGallery` ở `tours/[slug]/page.tsx`)
//  · `MockReview` — `lib/tours.spec.ts` (fixture cục bộ)
//  · `MockTravellerType` — `components/tours/tour-facts.tsx`
//  · `MockPolicyKind` — `lib/tours.ts`, `components/tours/good-to-know.tsx`
// ─────────────────────────────────────────────────────────────────────────────

/** Một destination mà tour đi qua (bảng join M:N ở backend). `isPrimary` là
    điểm đến chính; tour đi qua nhiều nơi nên contract trả CẢ mảng. */
export interface MockDestinationLink {
  slug: string;
  name: string;
  isPrimary: boolean;
}

export type MockTravellerType = 'FAMILY' | 'COUPLE' | 'FRIENDS' | 'SOLO' | 'BUSINESS';
export type MockPolicyKind = 'CANCELLATION' | 'BOOKING' | 'GENERAL';

/**
 * Gương `PublicReviewSchema` của `@tourism/contract` — **đúng 7 field, không hơn**.
 *
 * Những thứ CỐ TÌNH không có ở đây, vì bản công khai của contract không có, và mỗi
 * cái đều là một UI thường thấy mà ta không được dựng:
 *  • `source: VERIFIED | CURATED` chỉ tồn tại ở `AdminReviewSchema` → **không có
 *    badge "Verified traveller"**. Khối i18n port từ Nexora từng có đúng key đó;
 *    nó sẽ hiện một huy hiệu mà dữ liệu công khai không thể xác nhận.
 *  • Không có số đếm theo từng mức sao → **không có histogram phân bố**. Tính từ
 *    trang đang tải là nói dối: nó phản ánh 5 review vừa lấy, không phải toàn bộ.
 *  • Không có avatar, không có vote hữu ích, không có trả lời của nhà vận hành.
 *
 * `ReviewsByTourQuerySchema` cũng chỉ có `page`/`pageSize`/`tourSlug` → **không
 * sort, không lọc theo sao**. Thứ tự do server quyết: `authorDeleted asc →
 * createdAt desc → id desc`.
 */
export interface MockReview {
  id: string;
  /** Số nguyên 1–5 (`RatingSchema`). */
  rating: number;
  title: string | null;
  body: string;
  /** null khi tác giả đã xoá tài khoản — schema ghi rõ FE render "Deleted account". */
  authorName: string | null;
  authorDeleted: boolean;
  /** ISO **datetime** (có giờ + Z), KHÁC `MockTourDeparture.startDate` là date-only.
      Bẫy "đừng dựng new Date()" chỉ áp cho date-only; với datetime có Z thì
      `new Date()` là đúng. Xem `formatReviewDate` trong lib/tours.ts. */
  createdAt: string;
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

/**
 * Gương `MediaItemSchema` của `@tourism/contract` (ADR-0005) — **nguyên vẹn từng
 * field**, kể cả những field cụm tĩnh chưa dùng.
 *
 * Vì sao gương đủ: schema này KHÔNG phải do ta nghĩ ra cho gallery. Nó đã tồn tại
 * và đang chạy — `posts.service.ts` gọi `MediaService.resolveForOwners()` để cấp
 * `PostDetailSchema.media: MediaItem[]`. Nó cũng đã có sẵn `role: 'hero' |
 * 'gallery'` và `sortOrder`, tức hình dạng dữ liệu của một gallery đã được chốt ở
 * tầng contract. Ta chỉ đang chờ tour được nối vào cùng đường dây đó.
 */
export interface MockMediaItem {
  /** Giữ để admin (P4) re-submit item không đổi. */
  publicId: string;
  /** URL Cloudinary do API dựng. Cụm tĩnh KHÔNG fetch nó — mọi ảnh vẫn là
      `ImagePlaceholder` theo chính sách hiện hành; URL có ở đây chỉ để hình dạng
      mock đúng contract. */
  url: string;
  /** VIDEO là nhánh contract cho phép nhưng UI CHƯA xử lý. Mock hiện toàn IMAGE,
      và `mocks.spec.ts` canh điều đó — thêm VIDEO vào mock là test đỏ, để nhắc
      rằng phải dựng UI video trước chứ không phải để chặn dữ liệu. */
  type: 'IMAGE' | 'VIDEO';
  role: 'hero' | 'gallery' | 'avatar' | 'body';
  posterUrl: string | null;
  /** Nullable ở DB → bố cục KHÔNG được phụ thuộc tỉ lệ nội tại của ảnh. Đây là lý
      do gallery dùng ô có aspect cố định thay vì masonry theo chiều ảnh. */
  width: number | null;
  height: number | null;
  /** Nullable → phải có đường lùi khi soạn nhãn cho trình đọc màn hình. */
  alt: string | null;
  sortOrder: number;
}

export interface MockRegion {
  key: MockRegionKey;
  /** Từ vựng URL của `/destinations/[region]`. Cố tình KHÁC `key`: `key` là khoá
      nội bộ (đổ ra `data-region`), còn slug là chuyện SEO — trộn lại mới là nợ. */
  slug: string;
  name: string;
  // `tourCount` ĐÃ XOÁ (28/07): viết tay và sai (khai 24/27/17, thật 6/6/6). Số
  // tour của một vùng dẫn xuất bằng `toursInRegion()` ở lib/regions.ts.
  // `tagline` ĐÃ XOÁ (29/07): có HAI nguồn cho cùng một câu — field này và
  // `messages.regionPage.regions[key].tagline`. Hero đọc i18n (luật 7: copy
  // user-facing tập trung ở `@tourism/i18n`), nên field mock là nguồn chết.
}

export interface MockTestimonial {
  name: string;
  /** Nơi ở của khách (layout Estate hiển thị name + location) */
  location: string;
  quote: string;
  rating: number;
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

export interface MockMoment {
  /** Khoảnh khắc trải nghiệm của khách trên hành trình (slider ở Stats) */
  title: string;
  /** "Tên khách, tên tour" */
  credit: string;
  /**
   * Slug của tour trong `credit` — thêm 28/07 để ô khoảnh khắc ở
   * `/destinations` thành LINK thật sang trang tour.
   *
   * Ghi tường minh chứ KHÔNG bóc tên tour ra khỏi chuỗi `credit`: parse chuỗi
   * tự do là đoán, và đoán sai thì link dẫn sang tour khác. Đây đúng cái bẫy
   * đã khiến ta không port `tour-detail-derive.ts` của Nexora (regex-parse
   * meals/transport từ text không có gì bảo đảm định dạng).
   *
   * Bất biến: phải khớp một `TOURS[].slug` có thật — có test canh.
   */
  tourSlug: string;
}
