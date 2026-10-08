import { describe, expect, it } from 'vitest';
import { makeCancellation } from '@/test/fixtures/booking';
import {
  minutesBeforeNow,
  THREE_DAY_TRIP,
  VOUCHER_NOW,
  VOUCHER_TODAY,
  voucherBooking,
} from '@/test/fixtures/voucher';
import { VOUCHER_FRESH_MINUTES, type VoucherView, voucherView } from './voucher';

/**
 * Bảng quyết định của voucher `/checkout/success` (spec P7 §2.6). Chữ khớp NGUYÊN VĂN —
 * câu mới của khối `messages.voucher` lẫn câu dùng lại (thuế phí, hạn huỷ, hoàn tiền) đều
 * được ghim ở đây: đổi chữ là phải đổi test, có chủ ý.
 */
function view(...args: Parameters<typeof voucherView>): VoucherView {
  const result = voucherView(...args);
  if (result === null) throw new Error('fixture phải là đơn đã trả');
  return result;
}

/** Cờ server của chuyến ba ngày 3–5/11 khi hạn chót (31/10) đã qua và đã tới ngày đi: hết nút huỷ. */
const PASSED = makeCancellation(voucherBooking(THREE_DAY_TRIP), {
  withinDeadline: false,
  canCancel: false,
});

/**
 * Đơn đã trả rồi huỷ quá hạn: không hoàn đồng nào. Hai mốc huỷ lệch ngày nhau CHỈ để ca
 * nhật ký phân biệt được thứ tự ưu tiên `cancelledAt` → `cancellationDecidedAt` →
 * `cancellationRequestedAt`.
 */
const CANCELLED = {
  status: 'CANCELLED',
  cancellation: null,
  cancelledAt: '2026-11-01T10:00:00.000Z',
  cancellationDecidedAt: '2026-10-31T09:00:00.000Z',
} as const;

const SHOW_CODE = 'Show this code at pickup — printed or on your phone.';
const TAXES = 'Includes all taxes and fees.';

describe('voucherView — đơn nào dùng thiết kế voucher (spec §2.6)', () => {
  it('đơn chưa có paidAt (PENDING chờ webhook) → null: trang giữ hoá đơn chờ', () => {
    const pending = voucherBooking({ status: 'PENDING', paidAt: null, cancellation: null });
    expect(voucherView(pending, VOUCHER_NOW, VOUCHER_TODAY)).toBeNull();
  });

  it('giữ chỗ hết hạn rồi bị huỷ, chưa từng trả → null, dù giai đoạn là cancelled', () => {
    const lapsed = voucherBooking({ ...CANCELLED, paidAt: null });
    expect(voucherView(lapsed, VOUCHER_NOW, VOUCHER_TODAY)).toBeNull();
  });
});

describe('voucherView — vừa trả hay mở lại', () => {
  it('PAID 15 phút trước, chuyến một ngày → "Your day in {nơi} is booked."', () => {
    const v = view(voucherBooking({ paidAt: minutesBeforeNow(15) }), VOUCHER_NOW, VOUCHER_TODAY);
    expect(v.justPaid).toBe(true);
    expect(v.title).toBe('Your day in Hà Nội is booked.');
    expect(v.subtitle).toBe(
      'We’ve received booking BK-B6VCOQNW and a copy is on its way to erik.lund@example.com.',
    );
  });

  it('chuyến nhiều ngày → "Your trip to {nơi} is booked."', () => {
    const v = view(
      voucherBooking({ ...THREE_DAY_TRIP, paidAt: minutesBeforeNow(15) }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.title).toBe('Your trip to Hà Nội is booked.');
  });

  it('{nơi} là điểm đến ĐẦU TIÊN; tour không có điểm đến thì dùng tên tour', () => {
    // Fixture có hai điểm đến (Hà Nội, Ninh Bình): lấy nhầm điểm cuối là ca này đỏ.
    expect(view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY).place).toBe('Hà Nội');
    const bare = view(
      voucherBooking({ tourDestinations: [], paidAt: minutesBeforeNow(1) }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(bare.place).toBe('Hanoi Heritage in a Day');
    expect(bare.title).toBe('Your day in Hanoi Heritage in a Day is booked.');
  });

  it(`đúng ${VOUCHER_FRESH_MINUTES} phút vẫn là vừa trả; lẻ thêm 1 ms là mở lại`, () => {
    const edge = VOUCHER_NOW.getTime() - VOUCHER_FRESH_MINUTES * 60_000;
    const atEdge = voucherBooking({ paidAt: new Date(edge).toISOString() });
    expect(view(atEdge, VOUCHER_NOW, VOUCHER_TODAY).justPaid).toBe(true);

    const late = view(
      voucherBooking({ paidAt: new Date(edge - 1).toISOString() }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(late.justPaid).toBe(false);
    expect(late.title).toBe('Your trip voucher');
    // "Booked on" là ngày ĐẶT (18/10), không phải ngày trả (20/10).
    expect(late.subtitle).toBe('Booked on 18 Oct 2026 · a copy went to erik.lund@example.com');
  });

  it('paidAt nhanh hơn đồng hồ web vài giây vẫn là vừa trả', () => {
    const ahead = voucherBooking({ paidAt: minutesBeforeNow(-0.1) });
    expect(view(ahead, VOUCHER_NOW, VOUCHER_TODAY).justPaid).toBe(true);
  });

  it('chỉ PAID mới là vừa trả — PARTIALLY_REFUNDED trả 10 phút trước vẫn là mở lại', () => {
    const partly = voucherBooking({
      status: 'PARTIALLY_REFUNDED',
      refundedTotal: '49.00',
      paidAt: minutesBeforeNow(10),
    });
    expect(view(partly, VOUCHER_NOW, VOUCHER_TODAY).justPaid).toBe(false);
  });
});

describe('voucherView — trường dùng chung của hai cột', () => {
  it('chuyến một ngày: ngày đi một mốc, 1 ngày, cổng PayPal, ngày trả', () => {
    const v = view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY);
    expect([v.departure, v.tripDays, v.provider, v.paidOn]).toEqual([
      '3 Nov 2026',
      1,
      'PayPal',
      '18 Oct 2026',
    ]);
  });

  it('chuyến ba ngày trả bằng thẻ: khoảng ngày, 3 ngày, "Card (Stripe)", ngày TRẢ', () => {
    // paidAt 19/10 khác createdAt 18/10 CHỈ để phân biệt hai mốc.
    const v = view(
      voucherBooking({
        ...THREE_DAY_TRIP,
        paymentProvider: 'STRIPE',
        paidAt: '2026-10-19T03:00:00.000Z',
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect([v.departure, v.tripDays, v.provider, v.paidOn]).toEqual([
      '3–5 Nov 2026',
      3,
      'Card (Stripe)',
      '19 Oct 2026',
    ]);
  });
});

describe('voucherView — sắp đi (upcoming)', () => {
  it('ô mã, mã vạch và ba dòng điều kiện đúng thứ tự bảng §2.6', () => {
    const v = view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY);
    expect(v.phase).toBe('upcoming');
    expect([v.showCode, v.showBarcode, v.cancelledNotice]).toEqual([true, true, null]);
    expect(v.conditions).toEqual([
      SHOW_CODE,
      'Free cancellation until 2 Nov, 11:59 pm Vietnam time. No refund after that.',
      TAXES,
    ]);
  });

  it('nhật ký: Booked and paid ✓ · Free cancellation ends · Pickup day', () => {
    expect(view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY).journal).toEqual([
      { label: 'Booked and paid', detail: '18 Oct 2026 · PayPal', done: true },
      { label: 'Free cancellation ends', detail: '2 Nov, 11:59 pm Vietnam time', done: false },
      { label: 'Pickup day', detail: '3 Nov 2026 · Hà Nội', done: false },
    ]);
  });

  it('server nói đã quá hạn huỷ: bỏ dòng hạn huỷ, mốc nhật ký thành "Free cancellation ended" ✓', () => {
    // Chuyến 22–24/10, N = 3 → hạn chót 19/10; hôm nay 20/10 vẫn chưa đi.
    const trip = { departureStartDate: '2026-10-22', departureEndDate: '2026-10-24' };
    const v = view(
      voucherBooking({
        ...trip,
        cancellation: makeCancellation(voucherBooking(trip), { withinDeadline: false }),
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.phase).toBe('upcoming');
    expect(v.conditions).toEqual([SHOW_CODE, TAXES]);
    expect(v.journal[1]).toEqual({
      label: 'Free cancellation ended',
      detail: '19 Oct, 11:59 pm Vietnam time',
      done: true,
    });
  });

  it('vắng cờ server thì so ngày chót với hôm nay của server — đúng ngày chót vẫn còn hạn', () => {
    const passed = voucherBooking({
      departureStartDate: '2026-10-22',
      departureEndDate: '2026-10-24',
      cancellation: null,
    });
    expect(view(passed, VOUCHER_NOW, VOUCHER_TODAY).journal[1]?.label).toBe(
      'Free cancellation ended',
    );

    // Chuyến 23–25/10 → hạn chót 20/10 = hôm nay: hạn hết lúc 23:59 nên vẫn còn.
    const lastDay = voucherBooking({
      departureStartDate: '2026-10-23',
      departureEndDate: '2026-10-25',
      cancellation: null,
    });
    expect(view(lastDay, VOUCHER_NOW, VOUCHER_TODAY).journal[1]?.label).toBe(
      'Free cancellation ends',
    );
  });
});

describe('voucherView — đang đi (on_tour)', () => {
  it('còn mã và mã vạch; điều kiện bỏ hạn huỷ; nhật ký Trip started ✓ · Trip ends', () => {
    // `now` vẫn là 20/10 — chỉ dùng để đo "vừa trả"; giai đoạn đọc theo `today`.
    const v = view(
      voucherBooking({ ...THREE_DAY_TRIP, cancellation: PASSED }),
      VOUCHER_NOW,
      '2026-11-04',
    );
    expect(v.phase).toBe('on_tour');
    expect([v.showCode, v.showBarcode]).toEqual([true, true]);
    expect(v.conditions).toEqual([SHOW_CODE, TAXES]);
    expect(v.journal).toEqual([
      { label: 'Booked and paid', detail: '18 Oct 2026 · PayPal', done: true },
      { label: 'Trip started', detail: '3 Nov 2026', done: true },
      { label: 'Trip ends', detail: '5 Nov 2026', done: false },
    ]);
  });
});

describe('voucherView — đã đi (travelled)', () => {
  const AFTER = '2026-11-10';

  it('còn ô mã nhưng KHÔNG mã vạch; chỉ còn dòng giá đã gồm thuế phí', () => {
    const v = view(voucherBooking({ ...THREE_DAY_TRIP, cancellation: PASSED }), VOUCHER_NOW, AFTER);
    expect(v.phase).toBe('travelled');
    expect([v.showCode, v.showBarcode]).toEqual([true, false]);
    expect(v.conditions).toEqual([TAXES]);
  });

  it('chưa viết review → mục cuối "Write a review" mời viết', () => {
    const v = view(voucherBooking({ ...THREE_DAY_TRIP, cancellation: PASSED }), VOUCHER_NOW, AFTER);
    expect(v.journal).toEqual([
      { label: 'Booked and paid', detail: '18 Oct 2026 · PayPal', done: true },
      { label: 'Travelled', detail: '3–5 Nov 2026', done: true },
      { label: 'Write a review', detail: 'Tell other travellers how it went.', done: false },
    ]);
  });

  it('đã viết review → "Reviewed" ✓ kèm ngày viết', () => {
    const v = view(
      voucherBooking({
        ...THREE_DAY_TRIP,
        cancellation: PASSED,
        reviewedAt: '2026-11-07T08:00:00.000Z',
      }),
      VOUCHER_NOW,
      AFTER,
    );
    expect(v.journal[2]).toEqual({ label: 'Reviewed', detail: '7 Nov 2026', done: true });
  });

  it('PARTIALLY_REFUNDED chưa review → không mời viết (API chỉ nhận review của đơn PAID)', () => {
    const v = view(
      voucherBooking({
        ...THREE_DAY_TRIP,
        cancellation: PASSED,
        status: 'PARTIALLY_REFUNDED',
        refundedTotal: '49.00',
      }),
      VOUCHER_NOW,
      AFTER,
    );
    expect(v.journal.map((item) => item.label)).toEqual(['Booked and paid', 'Travelled']);
  });
});

describe('voucherView — đã huỷ (cancelled)', () => {
  it('không ô mã, không mã vạch, không điều kiện — dải "no longer valid" thay chỗ', () => {
    const v = view(voucherBooking(CANCELLED), VOUCHER_NOW, VOUCHER_TODAY);
    expect(v.phase).toBe('cancelled');
    expect([v.showCode, v.showBarcode, v.conditions]).toEqual([false, false, []]);
    expect(v.cancelledNotice).toBe('This booking was cancelled — this voucher is no longer valid.');
  });

  it('nhật ký: Booked ✓ · Cancelled ✓ (ngày cancelledAt) · Refund chưa có đồng nào', () => {
    expect(view(voucherBooking(CANCELLED), VOUCHER_NOW, VOUCHER_TODAY).journal).toEqual([
      { label: 'Booked', detail: '18 Oct 2026', done: true },
      { label: 'Cancelled', detail: '1 Nov 2026', done: true },
      { label: 'Refund', detail: 'No refund was due on this booking.', done: false },
    ]);
  });

  // ADR-0054 AMEND 1: REFUNDED không mốc huỷ chỉ là `cancelled` khi chuyến bị công ty huỷ —
  // thiếu cờ ấy thì đó là hoàn thiện chí trọn, khách vẫn đi.
  it('REFUNDED đủ trên chuyến công ty huỷ: Refund ✓ in đủ hai số lẻ; thiếu cancelledAt thì lấy ngày quyết huỷ', () => {
    const v = view(
      voucherBooking({
        status: 'REFUNDED',
        departureCancelled: true,
        cancellation: null,
        refundedTotal: '147.00',
        cancelledAt: null,
        cancellationDecidedAt: '2026-10-25T02:00:00.000Z',
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.journal.slice(1)).toEqual([
      { label: 'Cancelled', detail: '25 Oct 2026', done: true },
      {
        label: 'Refund',
        detail: '$147.00 has been refunded to your original payment method.',
        done: true,
      },
    ]);
  });

  it('chỉ còn ngày gửi yêu cầu huỷ thì mục Cancelled lấy ngày đó', () => {
    const v = view(
      voucherBooking({
        ...CANCELLED,
        cancelledAt: null,
        cancellationDecidedAt: null,
        cancellationRequestedAt: '2026-10-24T02:00:00.000Z',
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.journal[1]).toEqual({ label: 'Cancelled', detail: '24 Oct 2026', done: true });
  });

  it('không mốc huỷ nào thì mục Cancelled không có dòng ngày', () => {
    const v = view(
      voucherBooking({
        ...CANCELLED,
        cancelledAt: null,
        cancellationDecidedAt: null,
        cancellationRequestedAt: null,
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.journal[1]).toEqual({ label: 'Cancelled', detail: null, done: true });
  });

  it('huỷ ngay trong 30 phút sau khi trả: không phải "vừa trả", không pháo giấy', () => {
    const v = view(
      voucherBooking({
        ...CANCELLED,
        paidAt: minutesBeforeNow(10),
        cancelledAt: minutesBeforeNow(2),
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.justPaid).toBe(false);
    expect(v.title).toBe('Your trip voucher');
  });
});
