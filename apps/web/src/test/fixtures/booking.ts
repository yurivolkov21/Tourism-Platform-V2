import {
  type BookingCancellation,
  type BookingDetail,
  cancellationDeadline,
  type MyReview,
  remainingRefundable,
} from '@tourism/contract';
import type { BookingTourData } from '@/lib/get-ready';

/**
 * Fixture `BookingDetail` dùng chung cho test tầng web.
 *
 * Vì sao gom về một chỗ: trước cụm C có BA bản `makeBooking` chép tay
 * (`account-stats.spec`, `booking-card.spec`, `account-dashboard.spec`) khác
 * nhau vài giá trị mặc định. Thêm đúng ba field vào `BookingSchema` là cả ba
 * vỡ typecheck cùng lúc — mỗi lần contract nở ra là phải sửa n chỗ. Một fixture
 * thì lần sau chỉ sửa một.
 *
 * Mặc định là một booking PAID, chuyến còn ở tương lai, chưa hoàn đồng nào —
 * ca thường gặp nhất. Test cần ca khác thì đè bằng `overrides`; spec nào cần
 * mốc thời gian riêng thì truyền `paidAt`/`createdAt` tường minh thay vì dựa
 * vào giá trị ở đây.
 */
export function makeBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'b0000000-0000-4000-8000-000000000000',
    code: 'BK-TESTAAAA',
    status: 'PAID',
    tourTitle: 'Test Tour',
    tourSlug: 'test-tour',
    tourImage: null,
    // Passport (spec 11/08): snapshot đích đến — primary đứng đầu, nguồn cho
    // tem/stats/bản đồ. Test cần tour nhiều đích hoặc rỗng thì đè overrides.
    tourDestinations: [{ slug: 'ha-long-bay', name: 'Hạ Long Bay', isPrimary: true }],
    departureStartDate: '2026-09-01',
    departureEndDate: '2026-09-02',
    // ADR-0041: ngày chót do server tính — chuyến 2 ngày nên N = 3.
    cancellationDeadline: '2026-08-29',
    // ADR-0054 AMEND 1: chuyến còn chạy. Test cần chuyến bị công ty huỷ thì đè overrides.
    departureCancelled: false,
    unitPrice: '10.00',
    totalAmount: '10.00',
    currency: 'USD',
    numAdults: 1,
    numChildren: 0,
    contactName: 'Test Traveller',
    contactEmail: 'test@example.com',
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-07-01T00:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    cancellationStatus: null,
    // Cụm C: ba field đọc-kèm. Chỉ `bookings.byCode` điền giá trị thật, nên
    // mặc định ở đây khớp với thứ list/dashboard thật sự nhận được.
    cancellationRequestedAt: null,
    cancellationDecidedAt: null,
    refundedTotal: '0.00',
    // Cụm B: null = chưa viết đánh giá. Chỉ `byCode` điền giá trị thật.
    reviewedAt: null,
    review: null,
    // ADR-0041: trạng thái huỷ theo hạn chót (byCode). Mặc định null — test cần
    // hộp xác nhận huỷ thì đè overrides.
    cancellation: null,
    ...overrides,
  };
}

/**
 * Cờ huỷ `bookings.byCode.cancellation` của MỘT đơn — mặc định còn trong hạn và còn nút huỷ.
 *
 * Hạn chót và số hoàn SUY từ chính đơn bằng đúng các hàm server dùng (`cancellationDeadline`,
 * `remainingRefundable` của contract), nên cờ khớp `cancellationDeadline` của cùng chuyến thay
 * vì mỗi spec tự gõ một ngày (review P7 B19: năm spec chép tay một literal, có bản lệch ngày).
 * Quá hạn thì server hoàn 0. Ca cần cờ nói KHÁC ngày của đơn (cờ server thắng — ADR-0041 §7)
 * thì đè `deadline` hay `withinDeadline` tường minh.
 */
export function makeCancellation(
  booking: Pick<
    BookingDetail,
    'departureStartDate' | 'departureEndDate' | 'totalAmount' | 'refundedTotal'
  > = makeBooking(),
  overrides: Partial<BookingCancellation> = {},
): BookingCancellation {
  const withinDeadline = overrides.withinDeadline ?? true;
  return {
    deadline: cancellationDeadline(booking.departureStartDate, booking.departureEndDate),
    withinDeadline,
    refundAmount: withinDeadline
      ? remainingRefundable(booking.totalAmount, booking.refundedTotal)
      : '0.00',
    canCancel: true,
    ...overrides,
  };
}

/**
 * Review của chính khách gắn trên đơn (`booking.review`) — mặc định đang chờ duyệt, chưa bị bác
 * lần nào. Ca cần đã duyệt, bị bác hay đã rút thì đè (`moderationState` kèm các trường đi cùng).
 */
export function makeReview(overrides: Partial<MyReview> = {}): MyReview {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    rating: 5,
    title: null,
    body: 'Chuyến đi rất đáng nhớ và hướng dẫn viên nhiệt tình',
    authorName: 'Test Traveller',
    authorDeleted: false,
    createdAt: '2026-02-12T00:00:00.000Z',
    media: [],
    isApproved: false,
    moderationState: 'pending',
    moderationNote: null,
    rejectionCount: 0,
    tourSlug: 'test-tour',
    tourTitle: 'Test Tour',
    retractedAt: null,
    ...overrides,
  };
}

/**
 * Phần dữ liệu tour mà trang chi tiết đơn và voucher đọc (`BookingTourData`: mục gồm và không gồm,
 * điểm hẹn, lịch trình) — đủ cả nên khối Get ready có đủ bốn bước và bản in có đủ khối. Spec cần thiếu một phần thì đè; một chỗ
 * dựng nên `BookingTourData` thêm trường là chỉ sửa ở đây.
 */
export function makeTourData(overrides: Partial<BookingTourData> = {}): BookingTourData {
  return {
    included: ['English-speaking guide', 'Entrance tickets'],
    excluded: ['Lunch (own arrangement)', 'Tips'],
    meetingPoint: 'Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ',
    itinerary: [
      { dayNumber: 1, title: 'Ba Đình to the Old Quarter', description: '08:00 — Hotel pickup' },
    ],
    ...overrides,
  };
}
