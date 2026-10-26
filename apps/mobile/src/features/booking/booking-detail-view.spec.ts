import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  type BookingDetailHandlers,
  bookingDetailView,
  bookingEnquiryParams,
  bookingTrip,
  cancelSheetView,
} from './booking-detail-view';

function makeBooking(overrides: Partial<BookingDetail>): BookingDetail {
  return {
    id: 'b1',
    code: 'BK-TEST0001',
    status: 'PAID',
    tourTitle: 'Test tour',
    tourSlug: 'test-tour',
    tourImage: null,
    tourDestinations: [],
    departureStartDate: '2026-10-17',
    departureEndDate: '2026-10-17',
    cancellationDeadline: '2026-10-16',
    departureCancelled: false,
    unitPrice: '35.00',
    totalAmount: '35.00',
    currency: 'USD',
    numAdults: 1,
    numChildren: 0,
    contactName: 'A',
    contactEmail: 'a@example.com',
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-10-01T03:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-10-01T03:00:00.000Z',
    cancellationStatus: null,
    cancellationRequestedAt: null,
    cancellationDecidedAt: null,
    refundedTotal: '0.00',
    reviewedAt: null,
    review: null,
    cancellation: null,
    departureCancelReason: null,
    ...overrides,
  };
}

const CANCELLABLE: BookingCancellation = {
  deadline: '2026-10-16',
  withinDeadline: true,
  refundAmount: '35.00',
  canCancel: true,
};

// Ảnh bìa tour — route chỉ đọc `url`.
const IMAGE = { url: 'https://img.test/a.jpg' } as NonNullable<BookingDetail['tourImage']>;

const t = messages.mobile.booking.detail;
const bookingCopy = messages.mobile.booking;
const closed = messages.bookingDetail.closed;

/** Mỗi nút gắn một `jest.fn` riêng — test bấm nút rồi xem đúng việc nào chạy. */
function makeHandlers(): jest.Mocked<BookingDetailHandlers> {
  return {
    pay: jest.fn(),
    openCancelPending: jest.fn(),
    openCancel: jest.fn(),
    writeReview: jest.fn(),
    browse: jest.fn(),
    contact: jest.fn(),
  };
}

// Hôm nay của test: trước hạn chót 16/10 của chuyến mẫu 17/10, giờ server cùng ngày.
const CLOCK = { today: '2026-10-14', now: new Date('2026-10-14T03:00:00Z') };

function viewOf(
  booking: BookingDetail,
  state: Partial<Parameters<typeof bookingDetailView>[1]> = {},
  on = makeHandlers(),
) {
  return bookingDetailView(booking, { ...CLOCK, payError: null, paying: false, ...state }, on);
}

const codeRow = { label: bookingCopy.bookingCodeLabel, value: 'BK-TEST0001' };
const travellersRow = { label: t.travellersLabel, value: messages.mobile.trips.travellersCount(1) };

describe('bookingDetailView — T5 chờ trả', () => {
  const pending = makeBooking({ status: 'PENDING', paidAt: null });

  it('mời trả: khối cảnh báo chưa trả, ba hàng, nút Pay gọi pay và nút phụ mở tấm huỷ giữ chỗ', () => {
    const on = makeHandlers();
    const view = viewOf(pending, {}, on);

    expect(view.note).toEqual({
      tone: 'warning',
      icon: 'alert-circle',
      title: t.paymentNotFinishedTitle,
      body: t.paymentNotFinishedBody,
    });
    expect(view.rows).toEqual([
      codeRow,
      travellersRow,
      { label: t.totalDueLabel, value: '$35', emphasis: true },
    ]);
    expect(view.primaryAction).toMatchObject({
      label: messages.booking.wizard.payCta('$35'),
      disabled: false,
    });
    view.primaryAction?.onPress();
    expect(on.pay).toHaveBeenCalledTimes(1);
    expect(view.secondaryAction?.label).toBe(t.cancelThisBooking);
    view.secondaryAction?.onPress();
    expect(on.openCancelPending).toHaveBeenCalledTimes(1);
    expect(view.contactLine).toBeUndefined();
    expect(view.reason).toBeUndefined();
  });

  it('đang mở phiên trả: nút Pay khoá để không bấm hai lần', () => {
    expect(viewOf(pending, { paying: true }).primaryAction?.disabled).toBe(true);
  });

  it('đợt vừa đóng lúc bấm Pay: khối nói đợt đã đóng, bỏ nút Pay, còn nút bỏ booking', () => {
    const view = viewOf(pending, { payError: { kind: 'closed' } });
    expect(view.note).toEqual({
      tone: 'warning',
      icon: 'alert-circle',
      title: t.departureClosedTitle,
      body: t.departureClosedBody,
    });
    expect(view.primaryAction).toBeNull();
    expect(view.secondaryAction?.label).toBe(t.cancelThisBooking);
  });

  it('lỗi Pay khác: câu lỗi thay chỗ tiêu đề khối, không có thân', () => {
    const view = viewOf(pending, { payError: { kind: 'message', text: 'Boom' } });
    expect(view.note).toEqual({ tone: 'warning', icon: 'alert-circle', title: 'Boom' });
    expect(view.primaryAction?.label).toBe(messages.booking.wizard.payCta('$35'));
  });

  it('qua hạn chót (G54): khối đồng hồ, tổng không gọi là "due", chỉ còn Browse tours', () => {
    const on = makeHandlers();
    const view = viewOf(pending, { today: '2026-10-17' }, on);

    expect(view.note).toEqual({
      tone: 'warning',
      icon: 'clock',
      title: closed.notPaidByDeadline,
      body: closed.finishOpenPayment,
    });
    expect(view.rows).toEqual([
      codeRow,
      travellersRow,
      { label: messages.checkoutSummary.totalLabel, value: '$35', emphasis: true },
    ]);
    expect(view.primaryAction?.label).toBe(messages.mobile.trips.browse);
    view.primaryAction?.onPress();
    expect(on.browse).toHaveBeenCalledTimes(1);
    expect(view.secondaryAction).toBeNull();
  });
});

describe('bookingDetailView — T4 đã trả', () => {
  it('còn hạn huỷ: khối hạn chót kèm số hoàn, năm hàng, nút huỷ và dòng Contact us', () => {
    const on = makeHandlers();
    const view = viewOf(makeBooking({ cancellation: CANCELLABLE }), {}, on);

    expect(view.note).toEqual({
      tone: 'success',
      icon: 'shield',
      title: messages.cancellationDeadline.short('Fri 16 Oct'),
      body: t.cancelByThenNote('$35'),
    });
    expect(view.rows).toEqual([
      codeRow,
      travellersRow,
      { label: t.contactLabel, value: 'a@example.com' },
      { label: t.paidOnLabel, value: '1 Oct 2026' },
      { label: t.totalPaidLabel, value: '$35', emphasis: true },
    ]);
    // Chuyến chưa về thì chưa mời viết đánh giá.
    expect(view.primaryAction).toBeNull();
    expect(view.secondaryAction?.label).toBe(t.cancelThisBooking);
    view.secondaryAction?.onPress();
    expect(on.openCancel).toHaveBeenCalledTimes(1);
    expect(view.contactLine).toMatchObject({
      prompt: t.questionsAboutTrip,
      actionLabel: t.contactLinkLabel,
    });
    view.contactLine?.onPress();
    expect(on.contact).toHaveBeenCalledTimes(1);
  });

  it('quá hạn huỷ miễn phí mà còn huỷ được: khối cảnh báo không hứa hoàn tiền', () => {
    const view = viewOf(
      makeBooking({
        cancellation: { ...CANCELLABLE, withinDeadline: false, refundAmount: '0.00' },
      }),
    );
    expect(view.note).toEqual({
      tone: 'warning',
      icon: 'alert-circle',
      title: messages.mobile.trip.freeCancellationEnded,
      body: t.cancelAfterBody('Fri 16 Oct'),
    });
    expect(view.secondaryAction?.label).toBe(t.cancelThisBooking);
  });

  it('server không gửi khối huỷ, chưa có ngày trả: không khối nổi bật, không nút huỷ, không dòng ngày trả', () => {
    const view = viewOf(makeBooking({ paidAt: null }));
    expect(view.note).toBeNull();
    expect(view.rows.map((row) => row.label)).toEqual([
      bookingCopy.bookingCodeLabel,
      t.travellersLabel,
      t.contactLabel,
      t.totalPaidLabel,
    ]);
    expect(view.secondaryAction).toBeNull();
    expect(view.contactLine).toBeUndefined();
  });

  it('chuyến đã về mà chưa có bài: nút chính mời viết đánh giá', () => {
    const on = makeHandlers();
    const view = viewOf(
      makeBooking({}),
      { today: '2026-10-20', now: new Date('2026-10-20T03:00:00Z') },
      on,
    );
    expect(view.primaryAction?.label).toBe(messages.mobile.trip.writeReview);
    view.primaryAction?.onPress();
    expect(on.writeReview).toHaveBeenCalledTimes(1);
  });

  it('pill theo luật thẻ Trips', () => {
    const view = viewOf(makeBooking({}));
    expect(view.pillLabel).toBe(messages.mobile.trips.status.PAID);
    expect(view.pillTone).toBe('paid');
  });
});

describe('bookingDetailView — chuyến bị công ty huỷ', () => {
  it('job hoàn tiền chưa chạy: tiền đang về, lý do của admin, dòng tiền đã trả, chỉ còn Browse tours', () => {
    const on = makeHandlers();
    const view = viewOf(
      makeBooking({
        departureCancelled: true,
        departureCancelReason: 'Typhoon warning',
        cancellation: CANCELLABLE,
      }),
      {},
      on,
    );

    expect(view.note).toEqual({
      tone: 'warning',
      icon: 'x-circle',
      title: closed.weCancelled,
      body: closed.refundOnItsWay,
    });
    expect(view.reason).toEqual({ label: closed.whyLabel, text: 'Typhoon warning' });
    expect(view.rows).toEqual([codeRow, { label: t.paidLabel, value: '$35' }]);
    view.primaryAction?.onPress();
    expect(on.browse).toHaveBeenCalledTimes(1);
    expect(view.secondaryAction).toBeNull();
    expect(view.contactLine).toBeUndefined();
  });

  it('đã hoàn: khoản sổ ghi kèm mốc quyết hoàn, dòng ngày huỷ', () => {
    const view = viewOf(
      makeBooking({
        status: 'REFUNDED',
        departureCancelled: true,
        refundedTotal: '35.00',
        cancelledAt: '2026-10-05T03:00:00.000Z',
        cancellationDecidedAt: '2026-10-06T03:00:00.000Z',
      }),
    );
    expect(view.note?.body).toBe(t.refundedNote('$35', '6 Oct 2026'));
    expect(view.rows).toEqual([
      codeRow,
      { label: t.cancelledOnLabel, value: '5 Oct 2026' },
      { label: t.paidLabel, value: '$35' },
    ]);
  });

  it('đã hoàn mà không có mốc nào: không in ngày', () => {
    const view = viewOf(
      makeBooking({ status: 'REFUNDED', departureCancelled: true, refundedTotal: '35.00' }),
    );
    expect(view.note?.body).toBe(t.refundedNoDate('$35'));
  });

  it('đơn chưa từng thu tiền: không có chuyện tiền, không dòng tiền, không khối lý do khi admin không gõ', () => {
    const view = viewOf(
      makeBooking({
        status: 'CANCELLED',
        paidAt: null,
        departureCancelled: true,
        cancelledAt: '2026-10-05T03:00:00.000Z',
      }),
    );
    expect(view.note).toEqual({ tone: 'warning', icon: 'x-circle', title: closed.weCancelled });
    expect(view.reason).toBeUndefined();
    expect(view.rows).toEqual([codeRow, { label: t.cancelledOnLabel, value: '5 Oct 2026' }]);
  });
});

describe('bookingDetailView — đơn đã đóng', () => {
  it('huỷ khi chưa trả: một câu đã huỷ, chỉ hàng mã, Browse tours', () => {
    const on = makeHandlers();
    const view = viewOf(makeBooking({ status: 'CANCELLED', paidAt: null }), {}, on);
    expect(view.note).toEqual({
      tone: 'warning',
      icon: 'x-circle',
      title: messages.accountBookingDetail.terminalNote.CANCELLED,
    });
    expect(view.rows).toEqual([codeRow]);
    view.primaryAction?.onPress();
    expect(on.browse).toHaveBeenCalledTimes(1);
    expect(view.secondaryAction).toBeNull();
  });

  it('đã hoàn (T8): số đã hoàn kèm mốc quyết, câu thời gian tiền về, ba hàng', () => {
    const view = viewOf(
      makeBooking({
        status: 'REFUNDED',
        refundedTotal: '35.00',
        cancelledAt: '2026-10-05T03:00:00.000Z',
        cancellationDecidedAt: '2026-10-06T03:00:00.000Z',
      }),
    );
    expect(view.note).toEqual({
      tone: 'success',
      icon: 'refresh-cw',
      title: t.refundedNote('$35', '6 Oct 2026'),
      body: t.refundedTiming,
    });
    expect(view.rows).toEqual([
      codeRow,
      { label: t.cancelledOnLabel, value: '5 Oct 2026' },
      { label: t.paidLabel, value: '$35' },
    ]);
  });

  it('hoàn do admin không qua đơn xin huỷ, không có mốc: không in ngày', () => {
    const view = viewOf(makeBooking({ status: 'REFUNDED', refundedTotal: '35.00' }));
    expect(view.note?.title).toBe(t.refundedNoDate('$35'));
  });

  it('khách tự huỷ quá hạn, không hoàn đồng nào: câu không hoàn', () => {
    const view = viewOf(
      makeBooking({ status: 'CANCELLED', cancelledAt: '2026-10-15T03:00:00.000Z' }),
    );
    expect(view.note).toEqual({
      tone: 'warning',
      icon: 'x-circle',
      title: messages.accountBookingDetail.refundLine.none,
    });
  });

  it('hoàn một phần mà server còn cho huỷ: còn nút huỷ', () => {
    const on = makeHandlers();
    const view = viewOf(
      makeBooking({
        status: 'PARTIALLY_REFUNDED',
        refundedTotal: '10.00',
        cancellation: { ...CANCELLABLE, refundAmount: '25.00' },
      }),
      {},
      on,
    );
    expect(view.secondaryAction?.label).toBe(t.cancelThisBooking);
    view.secondaryAction?.onPress();
    expect(on.openCancel).toHaveBeenCalledTimes(1);
  });
});

describe('bookingTrip / bookingEnquiryParams', () => {
  it('thẻ chuyến: ảnh tour, tên, khoảng ngày', () => {
    expect(
      bookingTrip(
        makeBooking({
          tourImage: IMAGE,
          departureEndDate: '2026-10-19',
        }),
      ),
    ).toEqual({
      imageUrl: 'https://img.test/a.jpg',
      title: 'Test tour',
      dateRangeLabel: 'Sat 17 – Mon 19 Oct',
    });
    expect(bookingTrip(makeBooking({})).imageUrl).toBeNull();
  });

  it('form hỏi gắn sẵn chuyến; không có ảnh thì không gửi tham số ảnh', () => {
    expect(bookingEnquiryParams(makeBooking({}))).toEqual({
      tourSlug: 'test-tour',
      tripTitle: 'Test tour',
      tripSubtitle: 'Sat 17 – Sat 17 Oct',
    });
    expect(
      bookingEnquiryParams(
        makeBooking({
          tourImage: IMAGE,
        }),
      ).tripImageUrl,
    ).toBe('https://img.test/a.jpg');
  });
});

describe('cancelSheetView — tấm huỷ đơn đã trả (T6/T7)', () => {
  const actions = messages.accountBookingDetail.actions;
  const dialog = messages.accountBookingDetail.cancelDialog;

  it('còn hạn (T6): số hoàn tông good, có ô lý do, không dòng liên hệ', () => {
    const on = { changeReason: jest.fn(), contact: jest.fn() };
    const sheet = cancelSheetView(CANCELLABLE, 'USD', on);
    expect(sheet).toEqual({
      title: actions.cancelConfirmTitle,
      body: t.cancelWithinBody,
      refundLabel: t.refundLabel,
      refundAmount: '$35',
      refundTone: 'good',
      reasonLabel: t.cancelReasonLabel,
      reasonPlaceholder: t.cancelReasonPlaceholder,
      onChangeReason: on.changeReason,
      confirmLabel: dialog.withinCta('$35'),
      dismissLabel: actions.cancelDismiss,
    });
  });

  it('quá hạn (T7): hoàn tông info, không ô lý do, dòng liên hệ gọi contact', () => {
    const on = { changeReason: jest.fn(), contact: jest.fn() };
    const sheet = cancelSheetView(
      { ...CANCELLABLE, withinDeadline: false, refundAmount: '0.00' },
      'USD',
      on,
    );
    expect(sheet).toMatchObject({
      title: t.cancelAfterTitle,
      body: t.cancelAfterBody('Fri 16 Oct'),
      refundAmount: '$0',
      refundTone: 'info',
      confirmLabel: dialog.afterCta,
    });
    expect(sheet.reasonLabel).toBeUndefined();
    expect(sheet.onChangeReason).toBeUndefined();
    expect(sheet.contactLine?.prompt).toBe(dialog.afterContact);
    sheet.contactLine?.onPress();
    expect(on.contact).toHaveBeenCalledTimes(1);
  });
});
