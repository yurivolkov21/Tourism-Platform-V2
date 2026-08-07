import type { Booking } from '@tourism/contract';

/**
 * Fixture `Booking` dùng chung cho test tầng web.
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
export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b0000000-0000-4000-8000-000000000000',
    code: 'BK-TESTAAAA',
    status: 'PAID',
    tourTitle: 'Test Tour',
    departureStartDate: '2026-09-01',
    departureEndDate: '2026-09-02',
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
    ...overrides,
  };
}
