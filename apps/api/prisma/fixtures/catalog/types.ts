/**
 * Kiểu chung cho fixture catalog — tách riêng để 3 file miền
 * (`tours-north.ts`/`tours-central.ts`/`tours-south.ts`) và `reviews.ts` dùng
 * LẠI cùng shape, không lặp interface. Lý do bắt buộc phải CÓ kiểu tường minh
 * (không chỉ JSDoc): mảng rỗng `[]` không có annotation bị TypeScript suy ra
 * `never[]`, vỡ mọi chỗ đọc field qua các file `*.int.spec.ts` (đã đo — xem
 * báo cáo Task 1). Enum union đối chiếu ĐÚNG `schema.prisma` tại thời điểm
 * viết (`TourDifficulty`/`TravellerType`/`TourBadge`/`PolicyKind`/
 * `DepartureStatus`) — seed.ts vẫn giữ `as unknown as Prisma.…CreateManyInput[]`
 * ở biên insert (nếp cũ, không đổi).
 */

/** Một tour trong catalogue — categoryId trỏ `b0000001-…` (categories.ts). */
export interface TourFixture {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categoryId: string;
  durationDays: number;
  maxGroupSize: number;
  basePrice: string;
  compareAtPrice: string | null;
  currency: 'USD';
  difficulty: 'EASY' | 'MODERATE' | 'CHALLENGING';
  isPublished: boolean;
  isFeatured: boolean;
  suitableFor: Array<'FAMILY' | 'COUPLE' | 'FRIENDS' | 'SOLO' | 'BUSINESS'>;
  badges: Array<'BEST_VALUE' | 'LIMITED_OFFER' | 'EXCLUSIVE' | 'NEW' | 'POPULAR'>;
  included: string[];
  excluded: string[];
  highlights: string[];
  meetingPoint: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** M:N tour ↔ destination — destinationId trỏ `c0000002-…` (destinations.ts). */
export interface TourDestinationFixture {
  tourId: string;
  destinationId: string;
  isPrimary: boolean;
}

/**
 * Một ngày itinerary — `description` là TEXT THUẦN, mỗi dòng `HH:MM — …` nối
 * bằng `\n` (spec §4 — KHÔNG BAO GIỜ parse ngược thành dữ liệu, xem §1 spec).
 */
export interface TourItineraryDayFixture {
  id: string;
  tourId: string;
  dayNumber: number;
  title: string;
  description: string;
}

export interface TourFaqFixture {
  id: string;
  tourId: string;
  question: string;
  answer: string;
  order: number;
}

/** `kind` đủ 3 giá trị enum `PolicyKind`, mỗi tour cần đủ cả 3 (spec §4). */
export interface TourPolicyFixture {
  id: string;
  tourId: string;
  kind: 'CANCELLATION' | 'BOOKING' | 'GENERAL';
  title: string;
  body: string;
  order: number;
}

/**
 * `startDate`/`endDate` là chuỗi NGÀY TĨNH `'YYYY-MM-DD'` (seed.ts tự ép sang
 * `Date` qua `toDate()` vì cột Postgres là `@db.Date`) — KHÔNG dùng ISO
 * datetime ở hai field này.
 */
export interface TourDepartureFixture {
  id: string;
  tourId: string;
  startDate: string;
  endDate: string;
  priceOverride: string | null;
  compareAtPrice: string | null;
  seatsTotal: number;
  seatsBooked: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Review CURATED — `source`/`isApproved` seed.ts TỰ GẮN (KHÔNG khai ở
 * fixture), không có `userId`/`bookingId` (xem `reviews.ts`).
 */
export interface TourReviewFixture {
  id: string;
  tourId: string;
  rating: number;
  title?: string;
  body: string;
  authorName: string;
  authorLocation?: string;
  createdAt: string; // ISO
}
