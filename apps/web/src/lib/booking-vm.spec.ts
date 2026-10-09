import { type BookingCancellation, BookingPhaseSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  bookingPass,
  bookingTotalLabel,
  bookingView,
  cancellationDeadlineText,
  cancelledByOperator,
  cancelledOn,
  freeCancellationOpen,
  legacyCancellationNote,
  operatorRefundPending,
  paymentProviderLabel,
  refundSentence,
  refundSummary,
  vietnamDay,
  wasCharged,
} from './booking-vm';

/** Cờ huỷ SERVER trả ở `bookings.byCode` — mặc định: còn trong hạn, huỷ được. */
function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-10-13',
    withinDeadline: true,
    refundAmount: '1200.00',
    canCancel: true,
    ...overrides,
  };
}

describe('bookingView', () => {
  it('PENDING → warning + [payNow, cancelPending]', () => {
    const view = bookingView(makeBooking({ status: 'PENDING', cancellation: null }));
    expect(view).toEqual({
      tone: 'warning',
      statusKey: 'PENDING',
      actions: ['payNow', 'cancelPending'],
    });
  });

  it('PAID + server cho huỷ → success + [cancelBooking]', () => {
    const view = bookingView(makeBooking({ status: 'PAID' }), cancellationOf());
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: ['cancelBooking'] });
  });

  it('PAID đã quá hạn chót nhưng chưa khởi hành → vẫn có nút huỷ (huỷ không hoàn)', () => {
    // Quá hạn KHÔNG khoá nút: khách vẫn tự huỷ, chỉ là hoàn 0 (ADR-0041 §4).
    const view = bookingView(
      makeBooking({ status: 'PAID' }),
      cancellationOf({ withinDeadline: false, refundAmount: '0.00' }),
    );
    expect(view.actions).toEqual(['cancelBooking']);
  });

  it('PAID + server báo không huỷ online được (đã tới ngày khởi hành) → success + []', () => {
    const view = bookingView(
      makeBooking({ status: 'PAID' }),
      cancellationOf({ withinDeadline: false, refundAmount: '0.00', canCancel: false }),
    );
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: [] });
  });

  it('PAID không kèm cờ huỷ (danh sách `mine`, hộ chiếu) → success + [], không tự đoán', () => {
    const view = bookingView(makeBooking({ status: 'PAID' }));
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: [] });
  });

  it('PARTIALLY_REFUNDED + server cho huỷ → destructive + [cancelBooking]', () => {
    const view = bookingView(makeBooking({ status: 'PARTIALLY_REFUNDED' }), cancellationOf());
    expect(view).toEqual({
      tone: 'destructive',
      statusKey: 'PARTIALLY_REFUNDED',
      actions: ['cancelBooking'],
    });
  });

  it('REFUNDED → destructive + [] kể cả khi cờ nói huỷ được (spec §3.3: liên hệ)', () => {
    const view = bookingView(makeBooking({ status: 'REFUNDED' }), cancellationOf());
    expect(view).toEqual({ tone: 'destructive', statusKey: 'REFUNDED', actions: [] });
  });

  it('CANCELLED → muted + [] kể cả khi cờ nói huỷ được', () => {
    const view = bookingView(makeBooking({ status: 'CANCELLED' }), cancellationOf());
    expect(view).toEqual({ tone: 'muted', statusKey: 'CANCELLED', actions: [] });
  });
});

/**
 * Voucher và mã vạch theo giai đoạn — MỘT luật cho vé và nút "View voucher" của trang chi tiết
 * đơn, voucher `/checkout/success` và accordion My bookings (ADR-0054 AMEND 1 §5, review P7 B11).
 */
describe('bookingPass', () => {
  const PAID = makeBooking({ paidAt: '2026-08-14T03:05:00.000Z' });

  it.each([
    ['upcoming', { voucher: true, barcode: true }],
    ['on_tour', { voucher: true, barcode: true }],
    // Chuyến đã xong: voucher còn để xem lại, mã vạch không còn cổng nào để quét.
    ['travelled', { voucher: true, barcode: false }],
    ['awaiting_payment', { voucher: false, barcode: false }],
    ['cancelled', { voucher: false, barcode: false }],
    ['lapsed', { voucher: false, barcode: false }],
  ] as const)('đơn đã trả, giai đoạn %s → %o', (phase, pass) => {
    expect(bookingPass(PAID, phase)).toMatchObject(pass);
  });

  it('chưa có paidAt thì không voucher, không mã vạch ở giai đoạn nào', () => {
    const unpaid = makeBooking({ paidAt: null });
    for (const phase of BookingPhaseSchema.options) {
      expect(bookingPass(unpaid, phase)).toMatchObject({ voucher: false, barcode: false });
    }
  });

  /**
   * Mộc trên vé: chữ của trạng thái đơn, mực theo tông của `bookingView` — trừ hai giai đoạn mà
   * trạng thái đơn nói sai (ADR-0054 AMEND 1 §4, §5; review P7 B9, S1).
   */
  it.each([
    ['PAID sắp đi', 'PAID', 'upcoming', { label: 'CONFIRMED', tone: 'success' }],
    [
      'hoàn một phần đã đi',
      'PARTIALLY_REFUNDED',
      'travelled',
      { label: 'PARTLY REFUNDED', tone: 'destructive' },
    ],
    [
      'hoàn thiện chí trọn còn sắp đi',
      'REFUNDED',
      'upcoming',
      { label: 'REFUNDED', tone: 'destructive' },
    ],
    [
      'chờ trả còn trong hạn',
      'PENDING',
      'awaiting_payment',
      { label: 'AWAITING PAYMENT', tone: 'warning' },
    ],
    // Qua hạn chót: không mở lại phiên trả được, nhưng chưa chắc đã lỡ — chữ trung tính, mực xám.
    ['chờ trả qua hạn chót', 'PENDING', 'lapsed', { label: 'NOT PAID', tone: 'muted' }],
    ['đã huỷ', 'CANCELLED', 'cancelled', { label: 'CANCELLED', tone: 'muted' }],
    ['huỷ có hoàn', 'REFUNDED', 'cancelled', { label: 'REFUNDED', tone: 'muted' }],
    // Chuyến công ty huỷ, job hoàn tiền chưa chạy: đơn còn PAID nhưng chuyến không chạy.
    [
      'chuyến công ty huỷ, đơn còn PAID',
      'PAID',
      'cancelled',
      { label: 'CANCELLED', tone: 'muted' },
    ],
    [
      'chuyến công ty huỷ, đơn hoàn một phần',
      'PARTIALLY_REFUNDED',
      'cancelled',
      { label: 'CANCELLED', tone: 'muted' },
    ],
  ] as const)('mộc — %s → %o', (_, status, phase, stamp) => {
    expect(bookingPass(makeBooking({ status }), phase).stamp).toEqual(stamp);
  });

  /**
   * Badge của hàng accordion My bookings: CÙNG luật giai đoạn với mộc, chỉ khác bộ chữ (chữ của
   * danh sách đơn). Bản trước của accordion chỉ đè giai đoạn `lapsed`: đơn PAID trên chuyến công ty
   * huỷ chờ job hoàn tiền vẫn hiện "Paid" xanh trong khi mộc của trang chi tiết đơn và voucher nói
   * "CANCELLED" (review cuối I1).
   */
  it.each([
    ['PAID sắp đi', 'PAID', 'upcoming', { label: 'Paid', tone: 'success' }],
    [
      'hoàn một phần đã đi',
      'PARTIALLY_REFUNDED',
      'travelled',
      { label: 'Partially refunded', tone: 'destructive' },
    ],
    [
      'hoàn thiện chí trọn còn sắp đi',
      'REFUNDED',
      'upcoming',
      { label: 'Refunded', tone: 'destructive' },
    ],
    [
      'chờ trả còn trong hạn',
      'PENDING',
      'awaiting_payment',
      { label: 'Awaiting payment', tone: 'warning' },
    ],
    [
      'chờ trả qua hạn chót',
      'PENDING',
      'lapsed',
      { label: 'Payment not completed', tone: 'muted' },
    ],
    ['đã huỷ', 'CANCELLED', 'cancelled', { label: 'Cancelled', tone: 'muted' }],
    ['huỷ có hoàn', 'REFUNDED', 'cancelled', { label: 'Refunded', tone: 'muted' }],
    [
      'chuyến công ty huỷ, đơn còn PAID',
      'PAID',
      'cancelled',
      { label: 'Cancelled', tone: 'muted' },
    ],
    [
      'chuyến công ty huỷ, đơn hoàn một phần',
      'PARTIALLY_REFUNDED',
      'cancelled',
      { label: 'Cancelled', tone: 'muted' },
    ],
    // Lõi huỷ chuyến huỷ luôn giữ chỗ chưa trả — trạng thái chớp nhoáng, vẫn không mời trả tiền.
    [
      'chuyến công ty huỷ, giữ chỗ chưa trả',
      'PENDING',
      'cancelled',
      { label: 'Cancelled', tone: 'muted' },
    ],
  ] as const)('badge — %s → %o', (_, status, phase, badge) => {
    expect(bookingPass(makeBooking({ status }), phase).badge).toEqual(badge);
  });
});

/**
 * "Còn huỷ miễn phí không" — CHỈ cờ server (ADR-0041 §7). Vắng cờ là không mở: server không gửi
 * cờ cho đơn hoàn thiện chí trọn hay chuyến công ty huỷ, nên tự so ngày chót là hứa một quyền huỷ
 * không còn (review P7 B2, B15, C mục 16).
 */
describe('freeCancellationOpen', () => {
  it('cờ server còn trong hạn → mở', () => {
    expect(freeCancellationOpen(makeBooking({ cancellation: cancellationOf() }))).toBe(true);
  });

  it('cờ server đã quá hạn → đóng', () => {
    const b = makeBooking({ cancellation: cancellationOf({ withinDeadline: false }) });
    expect(freeCancellationOpen(b)).toBe(false);
  });

  it('vắng cờ → đóng, kể cả khi ngày chót còn rất xa', () => {
    const b = makeBooking({ cancellation: null, cancellationDeadline: '2099-12-31' });
    expect(freeCancellationOpen(b)).toBe(false);
  });
});

/**
 * Ngày huỷ của MỘT đơn cho thanh hành trình và nhật ký voucher (review P7 B3, B15): `cancelledAt`
 * trước; dữ liệu của luồng duyệt cũ thiếu nó thì chỉ mốc quyết của yêu cầu huỷ ĐƯỢC DUYỆT.
 */
describe('cancelledOn', () => {
  /** Yêu cầu huỷ của luồng cũ: gửi 19/09, quyết 20/09 — trạng thái do từng ca đặt. */
  const REQUEST = {
    cancellationRequestedAt: '2026-09-19T08:00:00.000Z',
    cancellationDecidedAt: '2026-09-20T08:00:00.000Z',
  } as const;

  it('có cancelledAt → ngày lịch VN của nó (06:30 giờ VN 22/09), bỏ qua mốc của yêu cầu', () => {
    const b = makeBooking({
      ...REQUEST,
      cancellationStatus: 'REFUNDED',
      cancelledAt: '2026-09-21T23:30:00.000Z',
    });
    expect(cancelledOn(b)).toBe('2026-09-22');
  });

  it('thiếu cancelledAt, yêu cầu được duyệt (REFUNDED) → ngày QUYẾT', () => {
    expect(cancelledOn(makeBooking({ ...REQUEST, cancellationStatus: 'REFUNDED' }))).toBe(
      '2026-09-20',
    );
  });

  it.each(['DENIED', 'REQUESTED'] as const)(
    'thiếu cancelledAt, yêu cầu %s → null: yêu cầu không thành thì không có ngày huỷ',
    (cancellationStatus) => {
      expect(cancelledOn(makeBooking({ ...REQUEST, cancellationStatus }))).toBeNull();
    },
  );

  it('không mốc nào → null, không bịa ngày', () => {
    expect(cancelledOn(makeBooking({ status: 'CANCELLED', cancelledAt: null }))).toBeNull();
  });
});

describe('cancellationDeadlineText', () => {
  it('server không gửi cờ huỷ → không có câu nào', () => {
    expect(cancellationDeadlineText(null)).toBeNull();
  });

  it('còn trong hạn → ngày chót cụ thể, giờ Việt Nam, và nói rõ sau đó không hoàn', () => {
    expect(cancellationDeadlineText(cancellationOf({ deadline: '2026-10-17' }))).toBe(
      'Free cancellation until 17 Oct, 11:59 pm Vietnam time. No refund after that.',
    );
  });

  it('quá hạn → câu hạn đã qua, vẫn in đúng ngày chót', () => {
    expect(
      cancellationDeadlineText(cancellationOf({ deadline: '2026-10-17', withinDeadline: false })),
    ).toBe('The free-cancellation deadline (17 Oct) has passed.');
  });
});

describe('legacyCancellationNote', () => {
  it('chưa từng gửi yêu cầu → null', () => {
    expect(legacyCancellationNote(makeBooking({ cancellationStatus: null }))).toBeNull();
  });

  it('REQUESTED của luồng duyệt cũ → kể lại ngày gửi, không hứa ai xem xét', () => {
    const b = makeBooking({
      cancellationStatus: 'REQUESTED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBe('You sent a cancellation request on 3 Sep 2026.');
  });

  it('DENIED của luồng duyệt cũ → kể lại là đã bị từ chối', () => {
    const b = makeBooking({
      cancellationStatus: 'DENIED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBe('Your cancellation request of 3 Sep 2026 was declined.');
  });

  it('ngày gửi là ngày lịch Việt Nam: gửi lúc 03:15 giờ VN (20:15Z hôm trước)', () => {
    const b = makeBooking({
      cancellationStatus: 'REQUESTED',
      cancellationRequestedAt: '2026-09-02T20:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBe('You sent a cancellation request on 3 Sep 2026.');
  });

  it('REFUNDED (kết cục thường của mọi lần huỷ) → null', () => {
    const b = makeBooking({
      status: 'CANCELLED',
      cancellationStatus: 'REFUNDED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBeNull();
  });
});

/**
 * Dòng tiền trên trang chi tiết booking của khách. Tới 04/09 trang ấy KHÔNG hề
 * nói số tiền đã hoàn — khách chỉ thấy chữ "Cancelled", còn con số nằm trong
 * hộp mail.
 */
describe('refundSummary', () => {
  it('chưa từng trả tiền → KHÔNG kể gì, kể cả khi đã huỷ', () => {
    // PENDING hết hạn hay khách tự huỷ trước khi trả là "chưa bao giờ có giao
    // dịch", không phải "hoàn 0 đồng".
    expect(refundSummary(makeBooking({ status: 'CANCELLED', paidAt: null }))).toBeNull();
  });

  it('bị thu rồi hoàn tự động trước khi kịp sang PAID (paidAt null): vẫn kể khoản hoàn', () => {
    // Thua đua ghế hay chuyến đóng lúc capture về: API hoàn trọn, đặt CANCELLED mà không ghi
    // `paid_at` — tiền ĐÃ đi một vòng, khối Payment cùng trang in "Refunded −$147.00" (B1).
    expect(
      refundSummary(
        makeBooking({
          status: 'CANCELLED',
          paidAt: null,
          totalAmount: '147.00',
          refundedTotal: '147.00',
        }),
      ),
    ).toEqual({ kind: 'full', amount: '147.00' });
  });

  it('đã trả tiền, chưa hoàn gì, chưa huỷ → KHÔNG kể gì', () => {
    expect(refundSummary(makeBooking({ status: 'PAID', refundedTotal: '0.00' }))).toBeNull();
  });

  it('huỷ mà KHÔNG hoàn đồng nào (huỷ quá hạn chót) → vẫn phải kể', () => {
    // Im lặng thì khách tự đoán rồi ngồi đợi một khoản không bao giờ tới.
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0.00' }))).toEqual({
      kind: 'none',
    });
  });

  it('hoàn một phần → mang CẢ số đã hoàn lẫn tổng', () => {
    const summary = refundSummary(
      makeBooking({ status: 'CANCELLED', totalAmount: '29.00', refundedTotal: '10.00' }),
    );
    expect(summary).toEqual({ kind: 'partial', amount: '10.00', total: '29.00' });
  });

  it('hoàn đủ → `full`, không phải `partial`', () => {
    expect(
      refundSummary(
        makeBooking({ status: 'REFUNDED', totalAmount: '29.00', refundedTotal: '29.00' }),
      ),
    ).toEqual({ kind: 'full', amount: '29.00' });
  });

  it("'0' và '0.00' là cùng một số tiền — so bằng số, không bằng chuỗi", () => {
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0' }))).toEqual({
      kind: 'none',
    });
  });

  it('lẻ cent vượt tổng vẫn là `full`, không rơi xuống `partial`', () => {
    expect(
      refundSummary(
        makeBooking({ status: 'REFUNDED', totalAmount: '29.00', refundedTotal: '29.01' }),
      ),
    ).toEqual({ kind: 'full', amount: '29.01' });
  });
});

/**
 * "Đã từng thu tiền" — cổng của `refundSummary` và của mọi chỗ in tên cổng thanh toán. `paidAt`
 * một mình không đủ: đơn bị thu rồi hoàn tự động trước khi sang PAID không có `paidAt` (review
 * P7 B1).
 */
describe('wasCharged', () => {
  it.each([
    [
      'đã trả (có paidAt) → đã thu',
      { paidAt: '2026-08-14T03:05:00.000Z', refundedTotal: '0.00' },
      true,
    ],
    ['chưa trả, chưa hoàn đồng nào → chưa thu', { paidAt: null, refundedTotal: '0.00' }, false],
    ["sổ rỗng trả '0' → vẫn là chưa thu", { paidAt: null, refundedTotal: '0' }, false],
    [
      'không paidAt mà đã hoàn (thu rồi hoàn tự động) → đã thu',
      { paidAt: null, refundedTotal: '147.00' },
      true,
    ],
  ] as const)('%s', (_, patch, expected) => {
    expect(wasCharged(makeBooking(patch))).toBe(expected);
  });
});

/**
 * Câu kể khoản hoàn cho khách — MỘT bản cho cột phải của đơn đã huỷ và nhật ký voucher (review P7
 * B14, C#14). Số tiền THẬT nên đủ hai số lẻ.
 */
describe('refundSentence', () => {
  it.each([
    [
      'hoàn đủ',
      { kind: 'full', amount: '147' },
      '$147.00 has been refunded to your original payment method.',
    ],
    [
      'hoàn một phần: nói cả hai số',
      { kind: 'partial', amount: '73.5', total: '147.00' },
      '$73.50 of $147.00 has been refunded to your original payment method.',
    ],
    ['không hoàn đồng nào cũng nói ra', { kind: 'none' }, 'No refund was due on this booking.'],
  ] as const)('%s', (_, refund, sentence) => {
    expect(refundSentence(refund, 'USD')).toBe(sentence);
  });
});

/**
 * Chuyến bị CÔNG TY huỷ (ADR-0041 AMEND 1): trang kể "chúng tôi huỷ chuyến" thay cho "đơn đã
 * huỷ". Lõi huỷ của công ty bỏ qua đơn đã đóng, nên đơn khách tự huỷ TRƯỚC đó mang cờ chuyến huỷ
 * mà câu chuyện vẫn là của khách.
 */
describe('cancelledByOperator — đơn đóng vì công ty huỷ chuyến', () => {
  it.each([
    ['chuyến vẫn chạy, khách tự huỷ', { status: 'CANCELLED', refundedTotal: '10.00' }, false],
    ['công ty huỷ, job hoàn tiền chưa chạy (đơn còn PAID)', { departureCancelled: true }, true],
    [
      'công ty huỷ, job đã hoàn trọn',
      { departureCancelled: true, status: 'CANCELLED', refundedTotal: '10.00' },
      true,
    ],
    [
      'công ty huỷ, giữ chỗ chưa trả bị huỷ theo',
      { departureCancelled: true, status: 'CANCELLED', paidAt: null },
      true,
    ],
    [
      'seed lượt 1: REFUNDED trên chuyến huỷ',
      { departureCancelled: true, status: 'REFUNDED', refundedTotal: '10.00' },
      true,
    ],
    // Công ty huỷ chuyến thì hoàn trọn phần còn lại; không hoàn đồng nào nghĩa là khách đã tự huỷ
    // sau hạn chót trước khi chuyến bị huỷ — "chúng tôi huỷ chuyến" cạnh "No refund" là nói sai.
    [
      'khách tự huỷ sau hạn chót, trước khi công ty huỷ chuyến',
      { departureCancelled: true, status: 'CANCELLED', refundedTotal: '0.00' },
      false,
    ],
  ] as const)('%s → %s', (_, patch, expected) => {
    expect(cancelledByOperator(makeBooking(patch))).toBe(expected);
  });
});

describe('operatorRefundPending — tiền của đơn trên chuyến công ty huỷ còn đang về', () => {
  it.each([
    ['PAID, job chưa chạy', { departureCancelled: true, status: 'PAID' }, true],
    [
      'hoàn một phần, job chưa chạy',
      { departureCancelled: true, status: 'PARTIALLY_REFUNDED' },
      true,
    ],
    ['job đã chạy (CANCELLED)', { departureCancelled: true, status: 'CANCELLED' }, false],
    ['seed lượt 1 (REFUNDED)', { departureCancelled: true, status: 'REFUNDED' }, false],
    ['chuyến vẫn chạy', { departureCancelled: false, status: 'PAID' }, false],
  ] as const)('%s → %s', (_, patch, expected) => {
    expect(operatorRefundPending(makeBooking(patch))).toBe(expected);
  });
});

/**
 * Mọi luật ngày của hệ chạy theo lịch Việt Nam (hạn chót hết 23:59 giờ VN, giai đoạn so ngày VN);
 * cắt `slice(0, 10)` là lấy ngày UTC — sự kiện 00:00–06:59 giờ VN rơi về hôm trước (review P7 B4,
 * C#3: huỷ 06:30 ngày 01/11 sau hạn 31/10 từng in "Cancelled · 31 Oct").
 */
describe('vietnamDay — ngày lịch Việt Nam của một mốc của đơn', () => {
  it.each([
    ['00:00 giờ VN đã là ngày mới (17:00Z hôm trước)', '2026-10-31T17:00:00.000Z', '2026-11-01'],
    ['06:30 giờ VN — cắt chuỗi UTC sẽ ra hôm trước', '2026-10-31T23:30:00.000Z', '2026-11-01'],
    ['23:59 giờ VN vẫn là ngày cũ', '2026-10-31T16:59:59.999Z', '2026-10-31'],
    ['giữa ngày: ngày UTC và ngày VN trùng nhau', '2026-08-14T03:05:00.000Z', '2026-08-14'],
  ])('%s', (_, iso, day) => {
    expect(vietnamDay(iso)).toBe(day);
  });

  it('mốc hỏng ném RangeError chứ không in một ngày bịa', () => {
    expect(() => vietnamDay('not-a-date')).toThrow(RangeError);
  });
});

describe('paymentProviderLabel — tên cổng thanh toán cho khách đọc', () => {
  // Chữ ghim nguyên văn `messages.booking.form.stripe|paypal` (messages.ts:289,291).
  it.each([
    ['STRIPE', 'Card (Stripe)'],
    ['PAYPAL', 'PayPal'],
  ] as const)('%s → %s', (provider, label) => {
    expect(paymentProviderLabel(provider)).toBe(label);
  });
});

describe('bookingTotalLabel — nhãn ô tổng tiền theo tiền đã về hay chưa', () => {
  it('đã trả (có paidAt) → "Total paid"', () => {
    expect(bookingTotalLabel(makeBooking({ paidAt: '2026-10-01T03:00:00.000Z' }))).toBe(
      'Total paid',
    );
  });

  /** Đơn chưa từng trả — giữ chỗ đang chờ, hay giỏ bỏ dở đã huỷ — không được ghi "Total paid". */
  it.each(['PENDING', 'CANCELLED'] as const)('%s chưa từng trả → "Total"', (status) => {
    expect(bookingTotalLabel(makeBooking({ status, paidAt: null }))).toBe('Total');
  });
});
