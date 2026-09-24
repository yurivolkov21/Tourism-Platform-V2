// Shape mock TỰ DO theo nhu cầu UI (quy trình static-first) — cố tình KHÔNG ép
// theo Prisma schema: chỗ nào vượt ra ngoài schema chính là danh sách trường
// cần thêm khi chốt trang và gắn API (xem memory static-first-page-building).

import type { Region, RegionKey } from '@tourism/contract';

/** Ba vùng là từ vựng của contract (ADR-0045) — tên cũ giữ lại làm bí danh để
    các component vùng khỏi phải đổi import. */
export type MockRegionKey = RegionKey;

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
// `MockTourDeparture` XOÁ 21/09 theo cùng luật đó: consumer duy nhất của nó là
// `components/tours/departure-strip.tsx`, xoá cùng lượt vì dải chip không còn
// call-site nào (trang chi tiết cố ý bỏ nó theo wireframe đã duyệt) và nó vẫn
// chọn đợt theo mỗi `seatsLeft`, tức chưa qua `isDepartureOpen` của ADR-0041.
// Hình dạng một đợt ở web nay chỉ còn `DepartureVM` (`@/lib/api/tours`).
//
// Các type dưới đây GIỮ LẠI vì vẫn còn consumer thật độc lập với hai mock đã
// xoá (component chi tiết tour, UI tour card) — không có VM tương ứng gọn hơn
// đáng để đổi:
//  · `MockDestinationLink` — `components/tours/route-ribbon.tsx`, `lib/tours.ts`
//  · `MockItineraryDay` — `components/destinations/region-day-trips.tsx`
//  · `MockMediaItem` — `lib/tours.ts` (`tourGallery`)
//
// `MockReview`/`MockTravellerType`/`MockPolicyKind` XOÁ ở đợt trùng tu Tour
// Details 13/08: consumer cuối của cả ba là các component trang tour cũ
// (`tour-reviews`, `tour-facts`, `good-to-know`) và hàm `averageRating`/
// `tourReviews`/`groupPoliciesByKind` — tất cả đã xoá cùng lượt khi trang
// chuyển sang 5 tab. Chỗ từng dùng nay đọc thẳng `TourReviewVM`/`TourDetailVM`.
// ─────────────────────────────────────────────────────────────────────────────

/** Một destination mà tour đi qua (bảng join M:N ở backend). `isPrimary` là
    điểm đến chính; tour đi qua nhiều nơi nên contract trả CẢ mảng. */
export interface MockDestinationLink {
  slug: string;
  name: string;
  isPrimary: boolean;
}

export interface MockItineraryDay {
  dayNumber: number;
  title: string;
  description: string | null;
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

/** Một vùng — hình dạng nay khai ở contract (`Region`, ADR-0045), cùng lời giải
    thích vì sao `slug` cố tình khác `key`. Hai field từng có ở đây rồi xoá, đừng
    thêm lại vào contract: `tourCount` (28/07 — viết tay và sai; số tour của một
    vùng dẫn xuất bằng `toursInRegion()`) và `tagline` (29/07 — nguồn thứ hai của
    `messages.regionPage.regions[key].tagline`, luật 7). */
export type MockRegion = Region;

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
  /** [kinh độ, vĩ độ] — thứ tự của MapLibre, KHÔNG phải [lat, lng] */
  coords: [number, number];
  /** Link Google Maps cho nút Get directions, mở tab mới */
  mapHref: string;
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
  /** Khoá khe ảnh. Đặt theo CHỨC DANH chứ không theo tên, để đổi người không
      phải đổi khe (và không phải upload lại ảnh vào khoá mới). */
  slot: string;
}

export interface MockMoment {
  /** Khoảnh khắc trải nghiệm của khách trên hành trình (slider ở Stats) */
  title: string;
  /**
   * Khoá khe site nuôi ảnh của ô này (`moment-*`, khai trong `SITE_SLOT_KEYS`
   * của seed).
   *
   * Ghi TƯỜNG MINH chứ không suy từ vị trí trong mảng — cùng lý lẽ đã áp cho
   * `tourSlug` ngay dưới: suy theo index thì sắp xếp lại `MOMENTS` là ảnh gắn
   * nhầm khoảnh khắc, và không có gì báo lỗi cả.
   */
  slot: string;
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
