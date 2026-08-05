import type { Booking, WishlistItem } from '@tourism/contract';
import type { SessionUser } from '../lib/api/session';
import type { CancellationView } from '../lib/booking-vm';

/**
 * Mock nội bộ cụm A account — CHỈ sống ở pha A1 (tĩnh), khai tử ngay khi
 * pha A2 wire API thật (plan Task 6 — grep `mocks/account` phải về 0 hit
 * sau đó). Kiểu khai bằng annotation TỪ `@tourism/contract`
 * (`Booking`/`WishlistItem`) — KHÔNG tự chế shape (spec §9: lệch shape là
 * A2 phải đập visual đã chốt pha A1). Lưu ý width-subtyping: annotation
 * biến (không `satisfies` trên literal rời) buộc TypeScript soi ĐỦ field
 * bắt buộc của `Booking`, thiếu field nào là lỗi biên dịch ngay — literal
 * thừa field vẫn lọt qua nếu không có annotation này.
 */

const CONTACT_NAME = 'Alex Nguyen';
const CONTACT_EMAIL = 'alex.nguyen@example.com';
const CURRENCY = 'USD';

/**
 * 7 booking phủ đủ máy trạng thái cần cho A1 (plan Task 2 §Interfaces):
 * PENDING · PAID×3 biến thể cancellation (chưa-có/REQUESTED/DENIED) ·
 * CANCELLED · REFUNDED · PARTIALLY_REFUNDED. Ngày departure trộn tương
 * lai/quá khứ quanh "hôm nay" (mốc dev 2026-08-04) để dashboard có cả
 * upcoming và completed > 0 (2 booking PAID tương lai, 1 booking PAID quá
 * khứ — xem `account-stats.ts` quyết định chỉ đếm PAID).
 */
export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'a01aa738-5522-4341-85a6-4c7d214f52a2',
    code: 'BK-PEND0001',
    status: 'PENDING',
    tourTitle: 'Hà Giang Loop by Easyrider 4D3N',
    departureStartDate: '2026-09-05',
    departureEndDate: '2026-09-08',
    unitPrice: '189.00',
    totalAmount: '378.00',
    currency: CURRENCY,
    numAdults: 2,
    numChildren: 0,
    contactName: CONTACT_NAME,
    contactEmail: CONTACT_EMAIL,
    contactPhone: '+84901234567',
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: '2026-08-01T03:12:00.000Z',
    // Task 6a (A2, user duyệt 06/08): field mới trên BookingSchema — PENDING
    // không thể mang cancellation request (chỉ PAID mới xin hủy được).
    cancellationStatus: null,
  },
  {
    id: '54596eba-ef88-4ec0-952b-5ea335a3cf21',
    code: 'BK-PAIDOK01',
    status: 'PAID',
    tourTitle: 'Vietnam Grand Journey: North to South 12D11N',
    departureStartDate: '2026-09-20',
    departureEndDate: '2026-10-01',
    unitPrice: '1450.00',
    totalAmount: '2900.00',
    currency: CURRENCY,
    numAdults: 2,
    numChildren: 0,
    contactName: CONTACT_NAME,
    contactEmail: CONTACT_EMAIL,
    contactPhone: '+84901234567',
    specialRequests: 'Vegetarian meals for both travellers.',
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-07-02T08:40:00.000Z',
    cancelledAt: null,
    createdAt: '2026-07-02T08:31:00.000Z',
    // Task 6a: chưa từng xin hủy — khớp việc BK-PAIDOK01 không có key trong
    // MOCK_CANCELLATIONS phía dưới.
    cancellationStatus: null,
  },
  {
    id: '6cb2be43-346b-42a2-a2f3-361e1dabc0b5',
    code: 'BK-PAIDREQ1',
    status: 'PAID',
    tourTitle: 'Sa Pa Villages & Fansipan Summit 3D2N',
    departureStartDate: '2026-08-25',
    departureEndDate: '2026-08-27',
    unitPrice: '245.00',
    totalAmount: '245.00',
    currency: CURRENCY,
    numAdults: 1,
    numChildren: 0,
    contactName: CONTACT_NAME,
    contactEmail: CONTACT_EMAIL,
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'PAYPAL',
    checkoutUrl: null,
    paidAt: '2026-07-15T11:05:00.000Z',
    cancelledAt: null,
    createdAt: '2026-07-15T10:58:00.000Z',
    // Task 6a: khớp MOCK_CANCELLATIONS['BK-PAIDREQ1'] phía dưới (request đang mở).
    cancellationStatus: 'REQUESTED',
  },
  {
    id: 'f15e4be1-6245-40fa-a961-07788d161f50',
    code: 'BK-PAIDDEN1',
    status: 'PAID',
    tourTitle: 'Huế Imperial City & Royal Tombs',
    departureStartDate: '2026-06-15',
    departureEndDate: '2026-06-15',
    unitPrice: '95.00',
    totalAmount: '190.00',
    currency: CURRENCY,
    numAdults: 2,
    numChildren: 0,
    contactName: CONTACT_NAME,
    contactEmail: CONTACT_EMAIL,
    contactPhone: '+84901234567',
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-05-20T09:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-05-20T08:50:00.000Z',
    // Task 6a: khớp MOCK_CANCELLATIONS['BK-PAIDDEN1'] phía dưới (admin đã từ chối).
    cancellationStatus: 'DENIED',
  },
  {
    id: 'e068c8bf-ac84-402a-a5cd-d82b6e40e5ed',
    code: 'BK-CANCEL01',
    status: 'CANCELLED',
    tourTitle: 'Hội An Old Town & Lantern Evening',
    departureStartDate: '2026-07-10',
    departureEndDate: '2026-07-10',
    unitPrice: '65.00',
    totalAmount: '65.00',
    currency: CURRENCY,
    numAdults: 1,
    numChildren: 0,
    contactName: CONTACT_NAME,
    contactEmail: CONTACT_EMAIL,
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: null,
    cancelledAt: '2026-07-05T06:00:00.000Z',
    createdAt: '2026-07-01T04:20:00.000Z',
    // Task 6a: tự-hủy PENDING (cancelPending, BK-2) — KHÔNG đi qua đường
    // cancellation-request PAID, nên field này vẫn null.
    cancellationStatus: null,
  },
  {
    id: '5d6ac513-e929-4d36-ac27-16d9ebb432f6',
    code: 'BK-REFUND01',
    status: 'REFUNDED',
    tourTitle: 'Hạ Long Bay Overnight Cruise 2D1N',
    departureStartDate: '2026-05-01',
    departureEndDate: '2026-05-02',
    unitPrice: '175.00',
    totalAmount: '350.00',
    currency: CURRENCY,
    numAdults: 2,
    numChildren: 0,
    contactName: CONTACT_NAME,
    contactEmail: CONTACT_EMAIL,
    contactPhone: '+84901234567',
    specialRequests: null,
    paymentProvider: 'PAYPAL',
    checkoutUrl: null,
    paidAt: '2026-04-10T07:00:00.000Z',
    cancelledAt: '2026-04-20T05:30:00.000Z',
    createdAt: '2026-04-10T06:55:00.000Z',
    // Task 6a: mock này refund toàn phần không qua flow cancellation-request
    // (admin refund trực tiếp, W3) — không có request nào đứng sau nó.
    cancellationStatus: null,
  },
  {
    id: '51e30145-336e-411d-b285-4daffa5f1943',
    code: 'BK-PARTREF1',
    status: 'PARTIALLY_REFUNDED',
    tourTitle: 'Lan Hạ Bay & Cát Bà Kayak Cruise 3D2N',
    departureStartDate: '2026-10-01',
    departureEndDate: '2026-10-03',
    unitPrice: '210.00',
    totalAmount: '420.00',
    currency: CURRENCY,
    numAdults: 2,
    numChildren: 0,
    contactName: CONTACT_NAME,
    contactEmail: CONTACT_EMAIL,
    contactPhone: null,
    specialRequests: 'Late check-in, arriving on a delayed flight.',
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-06-01T10:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-06-01T09:52:00.000Z',
    // Task 6a: refund một phần trực tiếp bởi admin — không qua cancellation-request.
    cancellationStatus: null,
  },
];

/**
 * Trạng thái cancellation request theo `bookingCode`, KEYED riêng khỏi
 * `Booking` (xem lý do đầy đủ ở JSDoc `CancellationView` trong
 * `booking-vm.ts`) — chỉ 2 booking PAID có request đang mở/bị từ chối,
 * booking PAID thứ ba (`BK-PAIDOK01`) chưa từng yêu cầu hủy (không có key).
 */
export const MOCK_CANCELLATIONS: Record<string, CancellationView> = {
  'BK-PAIDREQ1': { status: 'REQUESTED', decisionNote: null },
  'BK-PAIDDEN1': {
    status: 'DENIED',
    decisionNote: 'Departure is less than 14 days away — outside our cancellation window.',
  },
};

/** 3 tour đã lưu (spec §3 dashboard: "3 tour đã lưu") — đủ dữ liệu cho grid `/account/saved`. */
export const MOCK_WISHLIST: WishlistItem[] = [
  {
    tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a',
    slug: 'ninh-binh-trang-an-day',
    title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields',
    basePrice: '79.00',
    currency: CURRENCY,
    durationDays: 1,
    ratingAvg: 4.8,
    ratingCount: 132,
    addedAt: '2026-07-28T14:00:00.000Z',
    unavailable: false,
  },
  {
    tourId: 'ded599f0-df12-43a3-9b3d-bbe5d26764dc',
    slug: 'ha-giang-loop-4d',
    title: 'Hà Giang Loop by Easyrider 4D3N',
    basePrice: '189.00',
    currency: CURRENCY,
    durationDays: 4,
    ratingAvg: 4.9,
    ratingCount: 87,
    addedAt: '2026-07-20T09:30:00.000Z',
    unavailable: false,
  },
  {
    tourId: '98b95716-3daf-4347-8fc1-08cbe5aaa5e0',
    slug: 'phong-nha-paradise-cave-day',
    title: 'Phong Nha & Paradise Cave Day Trip',
    basePrice: '55.00',
    currency: CURRENCY,
    durationDays: 1,
    ratingAvg: null,
    ratingCount: 0,
    addedAt: '2026-07-10T16:45:00.000Z',
    // Tour đã unpublish sau khi lưu — nhánh "không còn khả dụng" cho grid saved.
    unavailable: true,
  },
];

/**
 * Hồ sơ khách demo — cùng shape `SessionUser` đã đo THẬT ở Task 1
 * (`lib/api/session.ts`, subset field response `GET /api/auth/get-session`),
 * KHÔNG tự chế field mới cho profile.
 */
export const MOCK_PROFILE: SessionUser = {
  id: 'ebb2d257-6658-4a84-9c51-17026935abd5',
  name: CONTACT_NAME,
  email: CONTACT_EMAIL,
  role: 'CUSTOMER',
  phone: '+84901234567',
};
