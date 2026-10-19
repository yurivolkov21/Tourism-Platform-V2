import {
  type Booking,
  BookingCodeSchema,
  type BookingDetail,
  type BookingPhase,
  type BookingStatusValue,
  type BookingsListQuery,
  BookingsListQuerySchema,
  type BookingsListResult,
  bookingPhase,
  type CancellationRequestStatusValue,
  vietnamToday,
} from '@tourism/contract';
import { z } from 'zod';

/**
 * Hai tool đọc đơn của chính khách (ADR-0050 AMEND 2) — phần thuần: input, truy vấn,
 * hàm thu gọn. Thu gọn ở đây là lớp chặn dữ liệu cá nhân: model chỉ nhận đúng các trường
 * liệt kê dưới, KHÔNG có email, điện thoại, tên liên hệ, ghi chú, link thanh toán, id nội
 * bộ hay nội dung review. Trạng thái viết sẵn bằng chữ để model không tự diễn giải enum.
 */

/** Trần số đơn mỗi lần `listMyBookings` (kế hoạch 19/10: khoảng 1–2 nghìn token). */
export const MY_BOOKINGS_LIMIT = 10;

const bookingUrl = (code: string) => `/account/bookings/${code}`;
const tourUrl = (slug: string) => `/tours/${slug}`;

/** Mốc ISO → ngày lịch Việt Nam, cùng cách trang đơn của web ghi ngày. */
const vietnamDate = (iso: string) => vietnamToday(new Date(iso));

// ── listMyBookings ──────────────────────────────────────────────────────────

export const ListMyBookingsInputSchema = z.object({
  when: z
    .enum(['upcoming', 'past', 'all'])
    .optional()
    .describe(
      'upcoming: trips not finished yet, including unpaid bookings and trips in progress. past: completed, cancelled or expired bookings. Default all.',
    ),
});

export type ListMyBookingsInput = z.infer<typeof ListMyBookingsInputSchema>;

const WHEN_FILTER = {
  upcoming: ['ON_TOUR', 'UPCOMING'],
  past: ['PAST'],
  all: undefined,
} as const;

/** Input của model → truy vấn `bookings.mine`, thứ tự `journey` như trang My bookings. */
export function toMyBookingsQuery(when: ListMyBookingsInput['when']): BookingsListQuery {
  const filter = WHEN_FILTER[when ?? 'all'];
  return BookingsListQuerySchema.parse({
    page: 1,
    limit: MY_BOOKINGS_LIMIT,
    order: 'journey',
    ...(filter === undefined ? {} : { when: [...filter] }),
  });
}

// ── Trạng thái bằng chữ ─────────────────────────────────────────────────────

const PHASE_TEXT: Record<Exclude<BookingPhase, 'cancelled'>, string> = {
  awaiting_payment: 'Awaiting payment',
  upcoming: 'Confirmed, trip upcoming',
  on_tour: 'Confirmed, trip in progress',
  travelled: 'Trip completed',
  lapsed: 'Not confirmed: the payment deadline has passed',
};

/**
 * Giai đoạn của đơn bằng chữ, suy bằng CHÍNH `bookingPhase` của contract (luật của trang
 * My bookings). Chuyến bị công ty huỷ thì ghi rõ ai huỷ: khách hay hỏi "sao đơn tôi bị
 * huỷ", và mọi khoản đã trả đều được hoàn trọn qua job (ADR-0041 AMEND 1).
 */
export function bookingStatusText(booking: Booking, today: string): string {
  const phase = bookingPhase(booking, today);
  if (phase !== 'cancelled') return PHASE_TEXT[phase];
  return booking.departureCancelled
    ? 'Cancelled by Nexora; anything paid is refunded in full'
    : 'Cancelled';
}

const PAYMENT_TEXT: Record<BookingStatusValue, string> = {
  PENDING: 'Not paid',
  // CANCELLED chỉ đến từ đơn chưa trả (tự huỷ hay hết hạn); đơn đã trả mà huỷ là REFUNDED.
  CANCELLED: 'Not paid',
  PAID: 'Paid',
  PARTIALLY_REFUNDED: 'Paid, partly refunded',
  REFUNDED: 'Refunded in full',
};

export function paymentText(status: BookingStatusValue): string {
  return PAYMENT_TEXT[status];
}

// ── Thu gọn ─────────────────────────────────────────────────────────────────

/** Một đơn trong danh sách: chỉ các trường cột trái của bảng dữ liệu (ADR-0050 AMEND 2). */
export function toBookingSummary(booking: Booking, today: string) {
  const status = bookingStatusText(booking, today);
  return {
    code: booking.code,
    url: bookingUrl(booking.code),
    tour: booking.tourTitle,
    tourUrl: tourUrl(booking.tourSlug),
    startDate: booking.departureStartDate,
    endDate: booking.departureEndDate,
    adults: booking.numAdults,
    children: booking.numChildren,
    status,
    payment: paymentText(booking.status),
    total: booking.totalAmount,
    currency: booking.currency,
    // Hạn chót của chuyến cũng là ngày cuối còn trả được (ADR-0041 §3).
    ...(status === PHASE_TEXT.awaiting_payment ? { payBy: booking.cancellationDeadline } : {}),
  };
}

export type BookingSummary = ReturnType<typeof toBookingSummary>;

export function toMyBookingsResult(result: BookingsListResult) {
  return {
    today: result.today,
    /** Số đơn khớp bộ lọc; lớn hơn `shown` thì phần còn lại xem ở `allBookingsUrl`. */
    total: result.total,
    shown: result.items.length,
    allBookingsUrl: '/account/bookings',
    bookings: result.items.map((booking) => toBookingSummary(booking, result.today)),
  };
}

export type MyBookingsResult = ReturnType<typeof toMyBookingsResult>;

// ── getMyBooking ────────────────────────────────────────────────────────────

export const GetMyBookingInputSchema = z.object({
  code: z.string().min(1).max(40).describe('Booking code, for example BK-AB12CD34.'),
});

export type GetMyBookingInput = z.infer<typeof GetMyBookingInputSchema>;

/**
 * Mã khách gõ → mã đúng khuôn `BK-XXXXXXXX`, hoặc null. Nhận chữ thường và mã thiếu tiền
 * tố `BK-` vì khách hay gõ vậy; chuỗi lạ là null để tool trả "không thấy" mà khỏi chạm DB.
 */
export function normalizeBookingCode(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  const code = upper.startsWith('BK-') ? upper : `BK-${upper}`;
  const parsed = BookingCodeSchema.safeParse(code);
  return parsed.success ? parsed.data : null;
}

const CANCELLATION_REQUEST_TEXT: Record<CancellationRequestStatusValue, string> = {
  REQUESTED: 'Waiting for review',
  REFUNDED: 'Approved and refunded',
  DENIED: 'Declined',
};

const REVIEW_TEXT = {
  pending: 'Submitted, waiting for moderation',
  approved: 'Published',
  // Lý do bác là chữ người duyệt viết cho riêng khách: không gửi model, trang đơn có đủ.
  rejected: 'Not approved; see the booking page',
  retracted: 'Withdrawn',
} as const;

/**
 * Review của đơn bằng chữ — cùng cổng với `reviewSlot` của web: có review thì nói trạng
 * thái; chưa có thì chỉ đơn PAID của chuyến công ty không huỷ mới viết được, và chỉ từ
 * ngày về theo lịch UTC (cổng `checkReviewEligibility` của API). Ngoài các ca ấy là null:
 * không có gì để nói.
 */
function reviewText(booking: BookingDetail, now: Date): string | null {
  if (booking.review) return REVIEW_TEXT[booking.review.moderationState];
  if (booking.departureCancelled || booking.status !== 'PAID') return null;
  return booking.departureEndDate > now.toISOString().slice(0, 10)
    ? 'Can be written after the trip ends'
    : 'Not written yet; can be written on the booking page';
}

/** Một đơn đầy đủ hơn: thanh toán, huỷ và hoàn tiền, review. */
export function toMyBookingDetails(booking: BookingDetail, now: Date) {
  return {
    found: true as const,
    ...toBookingSummary(booking, vietnamToday(now)),
    paymentMethod: booking.paymentProvider === 'PAYPAL' ? 'PayPal' : 'Card',
    paidOn: booking.paidAt === null ? null : vietnamDate(booking.paidAt),
    refunded: booking.refundedTotal,
    // Số server đã tính bằng chính hàm luật của lệnh huỷ (ADR-0041 §4); null khi đơn không
    // ở trạng thái huỷ được.
    cancellation:
      booking.cancellation === null
        ? null
        : {
            freeCancellationUntil: booking.cancellation.deadline,
            refundIfCancelledNow: booking.cancellation.refundAmount,
            canCancelOnline: booking.cancellation.canCancel,
          },
    cancellationRequest:
      booking.cancellationStatus === null
        ? null
        : {
            status: CANCELLATION_REQUEST_TEXT[booking.cancellationStatus],
            requestedOn:
              booking.cancellationRequestedAt === null
                ? null
                : vietnamDate(booking.cancellationRequestedAt),
            decidedOn:
              booking.cancellationDecidedAt === null
                ? null
                : vietnamDate(booking.cancellationDecidedAt),
          },
    ...(booking.cancelledAt === null ? {} : { cancelledOn: vietnamDate(booking.cancelledAt) }),
    ...(booking.departureCancelled
      ? { nexoraCancellationReason: booking.departureCancelReason }
      : {}),
    review: reviewText(booking, now),
  };
}

export type MyBookingDetails = ReturnType<typeof toMyBookingDetails>;
export type MyBookingResult = MyBookingDetails | { found: false };
