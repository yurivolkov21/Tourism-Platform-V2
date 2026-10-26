import { type BookingCancellation, type BookingDetail, bookingPhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  formatDepartureDate,
  formatDepartureRange,
  formatFullDate,
} from '@/features/tour-detail/departures';
import { bookingStatusPill } from '@/features/trips/trips-list';
import { formatMoney } from '@/lib/format-money';
import {
  bookingDetailActions,
  bookingDetailKind,
  canWriteReview,
  operatorRefund,
} from './booking-detail';
import type {
  BookingDetailRow,
  BookingDetailScreenProps,
  BookingDetailTrip,
} from './booking-detail-screen';
import type { CancelBookingSheetProps } from './cancel-sheet';

/**
 * Nội dung hoá đơn (T4/T5/T8, W4) và tấm huỷ (T6/T7, W5) dựng từ đơn — review M3-14 tách khỏi
 * route `app/bookings/[code].tsx` để test từng khung bằng unit test thay vì phải render. Hàm
 * thuần: việc của từng nút (điều hướng, mở tấm, gọi mutation) do route truyền vào qua
 * `handlers`, view chỉ gắn đúng việc vào đúng nút. Kiểu lấy từ props của màn, nên màn đổi props
 * (hay tên icon) thì tsc chỉ ra chỗ phải sửa ở đây.
 */

/** Lỗi bấm Pay đang hiện ngay trên T5 — `closed` khi đợt vừa đóng (chỉ còn nút bỏ booking). */
export type PayError = { kind: 'closed' } | { kind: 'message'; text: string };

/** Việc route làm khi khách bấm một nút của hoá đơn. */
export interface BookingDetailHandlers {
  pay: () => void;
  openCancelPending: () => void;
  openCancel: () => void;
  writeReview: () => void;
  browse: () => void;
  contact: () => void;
}

export interface BookingDetailViewState {
  /** Ngày Việt Nam của đồng hồ server — giai đoạn đơn (`bookingPhase`) cùng luật tab Trips. */
  today: string;
  /** Giờ server — lời mời viết đánh giá so ngày UTC như cổng review của API. */
  now: Date;
  payError: PayError | null;
  /** `bookings.checkout` đang chạy — khoá nút Pay. */
  paying: boolean;
}

export type BookingDetailView = Omit<BookingDetailScreenProps, 'transformUrl'>;

/** Phần đổi theo khung — thẻ chuyến và pill thì khung nào cũng như nhau. */
type Slots = Omit<BookingDetailView, 'trip' | 'pillLabel' | 'pillTone'>;

const copy = messages.mobile.booking;
const t = copy.detail;

/** Thẻ chuyến ở đầu hoá đơn. */
export function bookingTrip(booking: BookingDetail): BookingDetailTrip {
  return {
    imageUrl: booking.tourImage?.url ?? null,
    title: booking.tourTitle,
    dateRangeLabel: formatDepartureRange(booking.departureStartDate, booking.departureEndDate),
  };
}

/** Tham số của form hỏi gắn sẵn chuyến — đích chung của mọi "Contact us" trên hoá đơn và tracker. */
export function bookingEnquiryParams(booking: BookingDetail): {
  tourSlug: string;
  tripTitle: string;
  tripSubtitle: string;
  tripImageUrl?: string;
} {
  return {
    tourSlug: booking.tourSlug,
    tripTitle: booking.tourTitle,
    tripSubtitle: formatDepartureRange(booking.departureStartDate, booking.departureEndDate),
    ...(booking.tourImage ? { tripImageUrl: booking.tourImage.url } : {}),
  };
}

export function bookingDetailView(
  booking: BookingDetail,
  state: BookingDetailViewState,
  on: BookingDetailHandlers,
): BookingDetailView {
  const phase = bookingPhase(booking, state.today);
  const actions = bookingDetailActions(booking, phase);
  // Cùng luật pill với thẻ Trips: chuyến công ty huỷ không mang "Paid" xanh dù đơn còn PAID, đơn
  // chờ trả quá hạn chót không mang "Payment due" cam (G54).
  const pill = bookingStatusPill(booking, phase, {
    status: messages.mobile.trips.status,
    lapsed: messages.accountBookings.lapsedBadge,
  });
  const canCancel = actions.includes('cancelBooking');

  let slots: Slots;
  switch (bookingDetailKind(booking, phase)) {
    case 'pending':
      slots = pendingSlots(booking, state, actions.includes('cancelPending'), on);
      break;
    case 'lapsed':
      slots = lapsedSlots(booking, on);
      break;
    case 'paid':
      slots = paidSlots(booking, canWriteReview(booking, state.now), canCancel, on);
      break;
    case 'departureCancelled':
      slots = departureCancelledSlots(booking, on);
      break;
    case 'cancelled':
      slots = cancelledSlots(booking, on);
      break;
    case 'refunded':
      slots = refundedSlots(booking, canCancel, on);
      break;
  }
  return { trip: bookingTrip(booking), pillLabel: pill.label, pillTone: pill.tone, ...slots };
}

function codeRow(booking: BookingDetail): BookingDetailRow {
  return { label: copy.bookingCodeLabel, value: booking.code };
}

function travellersRow(booking: BookingDetail): BookingDetailRow {
  return {
    label: t.travellersLabel,
    value: messages.mobile.trips.travellersCount(booking.numAdults + booking.numChildren),
  };
}

/** Dòng ngày huỷ — đơn chưa có mốc huỷ thì không in. */
function cancelledOnRows(booking: BookingDetail): BookingDetailRow[] {
  return booking.cancelledAt
    ? [{ label: t.cancelledOnLabel, value: formatFullDate(booking.cancelledAt) }]
    : [];
}

function browseAction(on: BookingDetailHandlers): Slots['primaryAction'] {
  return { label: messages.mobile.trips.browse, onPress: on.browse };
}

/**
 * Nút huỷ của đơn đã trả — chỉ khi server cho huỷ (`cancellation.canCancel`). Cùng nhãn "Cancel
 * this booking" với đơn chờ trả: màn vẽ nó thành hàng chữ đỏ ở khối riêng cuối nội dung (C6).
 */
function cancelAction(canCancel: boolean, on: BookingDetailHandlers): Slots['secondaryAction'] {
  return canCancel ? { label: t.cancelThisBooking, onPress: on.openCancel } : null;
}

function pendingSlots(
  booking: BookingDetail,
  state: BookingDetailViewState,
  canCancelPending: boolean,
  on: BookingDetailHandlers,
): Slots {
  const amount = formatMoney(booking.totalAmount, booking.currency);
  const { payError } = state;
  const note: Slots['note'] =
    payError === null
      ? {
          tone: 'warning',
          icon: 'alert-circle',
          title: t.paymentNotFinishedTitle,
          body: t.paymentNotFinishedBody,
        }
      : payError.kind === 'closed'
        ? {
            tone: 'warning',
            icon: 'alert-circle',
            title: t.departureClosedTitle,
            body: t.departureClosedBody,
          }
        : { tone: 'warning', icon: 'alert-circle', title: payError.text };
  return {
    note,
    rows: [
      codeRow(booking),
      travellersRow(booking),
      { label: t.totalDueLabel, value: amount, emphasis: true },
    ],
    // Đợt đã đóng thì không còn gì để trả — chỉ để lại nút bỏ booking.
    primaryAction:
      payError?.kind === 'closed'
        ? null
        : {
            label: messages.booking.wizard.payCta(amount),
            onPress: on.pay,
            disabled: state.paying,
          },
    secondaryAction: canCancelPending
      ? { label: t.cancelThisBooking, onPress: on.openCancelPending }
      : null,
  };
}

/**
 * G54: quá hạn chót mà chưa trả — cùng câu với khung đã đóng của web (`closedNarrative`): câu sự
 * việc rồi câu điều kiện. Không mời trả (API không mở phiên nào nữa) mà cũng không khẳng định
 * "đã lỡ": claim của webhook còn nhận phiên mở trước hạn (ADR-0054 AMEND 1 §4).
 */
function lapsedSlots(booking: BookingDetail, on: BookingDetailHandlers): Slots {
  return {
    note: {
      tone: 'warning',
      icon: 'clock',
      title: messages.bookingDetail.closed.notPaidByDeadline,
      body: messages.bookingDetail.closed.finishOpenPayment,
    },
    rows: [
      codeRow(booking),
      travellersRow(booking),
      // Chưa trả thì không "Total due" (mời trả) cũng không "Total paid" — cùng `bookingTotalLabel` của web.
      {
        label: messages.checkoutSummary.totalLabel,
        value: formatMoney(booking.totalAmount, booking.currency),
        emphasis: true,
      },
    ],
    primaryAction: browseAction(on),
    secondaryAction: null,
  };
}

function paidSlots(
  booking: BookingDetail,
  inviteReview: boolean,
  canCancel: boolean,
  on: BookingDetailHandlers,
): Slots {
  const { cancellation } = booking;
  let note: Slots['note'] = null;
  if (cancellation) {
    note = cancellation.withinDeadline
      ? {
          tone: 'success',
          icon: 'shield',
          title: messages.cancellationDeadline.short(formatDepartureDate(cancellation.deadline)),
          body: t.cancelByThenNote(formatMoney(cancellation.refundAmount, booking.currency)),
        }
      : // Quá hạn: không được hứa hoàn tiền (quy tắc #5 — chỉ tin `withinDeadline` của server).
        {
          tone: 'warning',
          icon: 'alert-circle',
          title: messages.mobile.trip.freeCancellationEnded,
          body: t.cancelAfterBody(formatDepartureDate(cancellation.deadline)),
        };
  }
  return {
    note,
    rows: [
      codeRow(booking),
      travellersRow(booking),
      { label: t.contactLabel, value: booking.contactEmail },
      ...(booking.paidAt ? [{ label: t.paidOnLabel, value: formatFullDate(booking.paidAt) }] : []),
      {
        label: t.totalPaidLabel,
        value: formatMoney(booking.totalAmount, booking.currency),
        emphasis: true,
      },
    ],
    // Nợ nhỏ P5b-5 mục 1: chuyến đã về mà chưa có bài thì hoá đơn là lối thứ hai vào R1, như
    // mockup `mobile-review-screens` ghi — trước đó chỉ P6 mời viết.
    primaryAction: inviteReview
      ? { label: messages.mobile.trip.writeReview, onPress: on.writeReview }
      : null,
    secondaryAction: cancelAction(canCancel, on),
    ...(canCancel
      ? {
          contactLine: {
            prompt: t.questionsAboutTrip,
            actionLabel: t.contactLinkLabel,
            onPress: on.contact,
          },
        }
      : {}),
  };
}

/**
 * Công ty huỷ chuyến (ADR-0041 AMEND 1): cùng câu với trang chi tiết đơn của web, rồi chuyện
 * tiền — đang về khi job hoàn tiền chưa chạy, hay khoản sổ đã ghi.
 */
function departureCancelledSlots(booking: BookingDetail, on: BookingDetailHandlers): Slots {
  const refund = operatorRefund(booking);
  const refundBody =
    refund === null
      ? null
      : refund.kind === 'onItsWay'
        ? messages.bookingDetail.closed.refundOnItsWay
        : refund.refundedAt === null
          ? t.refundedNoDate(formatMoney(refund.amount, booking.currency))
          : t.refundedNote(
              formatMoney(refund.amount, booking.currency),
              formatFullDate(refund.refundedAt),
            );
  return {
    note: {
      tone: 'warning',
      icon: 'x-circle',
      title: messages.bookingDetail.closed.weCancelled,
      ...(refundBody === null ? {} : { body: refundBody }),
    },
    // ADR-0041 AMEND 2: nguyên văn lý do admin gõ lúc huỷ chuyến — câu khách đã nhận ở email báo
    // huỷ. Chuyến huỷ không có lý do (seed lượt 1) thì không in khối rỗng.
    ...(booking.departureCancelReason === null
      ? {}
      : {
          reason: {
            label: messages.bookingDetail.closed.whyLabel,
            text: booking.departureCancelReason,
          },
        }),
    rows: [
      codeRow(booking),
      ...cancelledOnRows(booking),
      // Đơn chưa từng thu tiền thì không có dòng tiền nào để in.
      ...(refund === null
        ? []
        : [{ label: t.paidLabel, value: formatMoney(booking.totalAmount, booking.currency) }]),
    ],
    primaryAction: browseAction(on),
    secondaryAction: null,
  };
}

/** Đơn huỷ khi chưa từng thu tiền — không có chuyện tiền để kể. */
function cancelledSlots(booking: BookingDetail, on: BookingDetailHandlers): Slots {
  return {
    note: {
      tone: 'warning',
      icon: 'x-circle',
      title: messages.accountBookingDetail.terminalNote.CANCELLED ?? '',
    },
    rows: [codeRow(booking)],
    primaryAction: browseAction(on),
    secondaryAction: null,
  };
}

/** T8: đơn đã thu tiền rồi hoàn (một phần hay trọn), hay khách tự huỷ quá hạn không hoàn. */
function refundedSlots(
  booking: BookingDetail,
  canCancel: boolean,
  on: BookingDetailHandlers,
): Slots {
  const refunded = Number(booking.refundedTotal) > 0;
  // Không có mốc hoàn thật (hoàn do admin không qua đơn xin huỷ) thì KHÔNG in ngày — trước đây
  // rơi về ngày đặt chỗ, sai sự thật.
  const refundedAt = booking.cancellationDecidedAt ?? booking.cancelledAt;
  const refundedMoney = formatMoney(booking.refundedTotal, booking.currency);
  return {
    note: refunded
      ? {
          tone: 'success',
          icon: 'refresh-cw',
          title:
            refundedAt === null
              ? t.refundedNoDate(refundedMoney)
              : t.refundedNote(refundedMoney, formatFullDate(refundedAt)),
          body: t.refundedTiming,
        }
      : {
          tone: 'warning',
          icon: 'x-circle',
          title: messages.accountBookingDetail.refundLine.none,
        },
    rows: [
      codeRow(booking),
      ...cancelledOnRows(booking),
      { label: t.paidLabel, value: formatMoney(booking.totalAmount, booking.currency) },
    ],
    primaryAction: browseAction(on),
    // PARTIALLY_REFUNDED không phải trạng thái cuối (booking-states.md, ADR-0041): khách vẫn đi
    // tour và còn huỷ được khi server cho phép.
    secondaryAction: cancelAction(canCancel, on),
  };
}

/** Phần của tấm huỷ dựng từ khối `cancellation` — trạng thái mở, lý do đang gõ, lỗi do route giữ. */
export type CancelSheetView = Omit<
  CancelBookingSheetProps,
  'visible' | 'onClose' | 'reason' | 'pending' | 'error' | 'onConfirm'
>;

/**
 * Tấm huỷ đơn đã trả: T6 còn hạn (hoàn tiền, hỏi lý do) hay T7 quá hạn. Mockup T7 KHÔNG có ô lý
 * do — chỉ T6 còn hạn mới hỏi; T7 thay bằng lối sang form hỏi (`contact`).
 */
export function cancelSheetView(
  cancellation: BookingCancellation,
  currency: string,
  on: { changeReason: (value: string) => void; contact: () => void },
): CancelSheetView {
  const { actions, cancelDialog } = messages.accountBookingDetail;
  const refundAmount = formatMoney(cancellation.refundAmount, currency);
  const shared = {
    refundLabel: t.refundLabel,
    refundAmount,
    dismissLabel: actions.cancelDismiss,
  };
  if (cancellation.withinDeadline) {
    return {
      ...shared,
      title: actions.cancelConfirmTitle,
      body: t.cancelWithinBody,
      refundTone: 'good',
      reasonLabel: t.cancelReasonLabel,
      reasonPlaceholder: t.cancelReasonPlaceholder,
      onChangeReason: on.changeReason,
      confirmLabel: cancelDialog.withinCta(refundAmount),
    };
  }
  return {
    ...shared,
    title: t.cancelAfterTitle,
    body: t.cancelAfterBody(formatDepartureDate(cancellation.deadline)),
    refundTone: 'info',
    contactLine: { prompt: cancelDialog.afterContact, onPress: on.contact },
    confirmLabel: cancelDialog.afterCta,
  };
}
