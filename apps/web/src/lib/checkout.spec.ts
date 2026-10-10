import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  bookingPriceLines,
  cancelPageRedirect,
  checkoutMood,
  computeBookingTotal,
  formatBookingMoney,
  PENDING_TTL_MINUTES,
  pendingDeadline,
  pendingExpiry,
  receiptNote,
  ticketBarcodeWidths,
} from './checkout';

describe('checkoutMood — tâm trạng của hoá đơn chờ đọc từ status', () => {
  it('PENDING → confirming (webhook chưa về)', () => {
    expect(checkoutMood(makeBooking({ status: 'PENDING' }))).toBe('confirming');
  });

  /**
   * Các status còn lại KHÔNG phải "đang chờ webhook" — chúng là kết cục đã rồi.
   * Nếu khách quay về từ cổng mà booking đã CANCELLED (hết hạn giữa chừng) thì
   * hiện mood confirming là nói dối: trang sẽ tự làm mới mãi mãi cho một thứ
   * không bao giờ đổi. PAID không tới hoá đơn (đơn đã trả mở voucher), nên hoá đơn
   * không còn tâm trạng "đã xác nhận" riêng (review cuối P7, M3).
   */
  it.each(['PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const)(
    '%s → settled, KHÔNG tự làm mới',
    (status) => {
      expect(checkoutMood(makeBooking({ status }))).toBe('settled');
    },
  );
});

/**
 * `/checkout/cancel` kể chuyện của đơn CHƯA trả ("Payment cancelled", "No charge was made…").
 * Đơn đã trả (trả ở tab khác rồi bấm huỷ ở cổng) từng rơi vào nhánh hoá đơn cũ: pill "Paid" và mã
 * vạch ngay dưới "Payment cancelled", cả đơn đã trả rồi huỷ cũng có mã vạch (review P7C, "Ngoài
 * diff"). Đơn đã trả sang voucher, nơi nó được kể theo đúng giai đoạn.
 */
describe('cancelPageRedirect — đơn đã trả về /checkout/cancel thì sang voucher', () => {
  it('đã trả → voucher của chính đơn ấy', () => {
    expect(cancelPageRedirect(makeBooking({ code: 'BK-B6VCOQNW' }))).toBe(
      '/checkout/success?code=BK-B6VCOQNW',
    );
  });

  it('đã trả rồi huỷ → vẫn sang voucher (voucher nói hết hiệu lực, không mã vạch)', () => {
    const cancelled = makeBooking({
      code: 'BK-B6VCOQNW',
      status: 'CANCELLED',
      cancelledAt: '2026-07-02T00:00:00.000Z',
    });
    expect(cancelPageRedirect(cancelled)).toBe('/checkout/success?code=BK-B6VCOQNW');
  });

  it('chưa trả → null: trang huỷ giữ hoá đơn chờ', () => {
    expect(cancelPageRedirect(makeBooking({ status: 'PENDING', paidAt: null }))).toBeNull();
  });
});

/**
 * Câu dưới tiêu đề hoá đơn khi trang không truyền câu riêng (review P7C#5). Hoá đơn ở
 * `/checkout/success` nay chỉ còn cho đơn CHƯA trả: câu cũ "A copy of this receipt was sent to …"
 * sai với đơn chưa trả (không email nào đi), và im về khoản hoàn của đơn bị thu rồi hoàn tự động.
 */
describe('receiptNote — câu dưới tiêu đề hoá đơn theo tâm trạng', () => {
  it('chờ webhook → thanh toán đang được xác nhận, KHÔNG "was sent to"', () => {
    const pending = makeBooking({ status: 'PENDING', paidAt: null });
    expect(receiptNote(pending, 'confirming')).toBe(
      'Your payment is being confirmed — this usually takes a few seconds. This page updates automatically; you can also refresh.',
    );
  });

  it('giữ chỗ hết hạn, chưa từng thu → không còn gì để trả', () => {
    const lapsed = makeBooking({ status: 'CANCELLED', paidAt: null });
    expect(receiptNote(lapsed, 'settled')).toBe(
      'There’s nothing left to pay here. Open the booking to see where it stands.',
    );
  });

  it('bị thu rồi hoàn tự động (thua đua ghế — paidAt vẫn null) → kể khoản hoàn và thời gian về', () => {
    const lostRace = makeBooking({
      status: 'CANCELLED',
      paidAt: null,
      totalAmount: '147.00',
      refundedTotal: '147.00',
    });
    expect(receiptNote(lostRace, 'settled')).toBe(
      '$147.00 has been refunded to your original payment method. It can take 5–10 business days to appear on your statement.',
    );
  });
});

describe('pendingExpiry — hạn 65 phút tính từ createdAt', () => {
  const createdAt = '2026-08-07T10:00:00.000Z';

  it('còn 65 phút ngay lúc vừa tạo', () => {
    const at = new Date('2026-08-07T10:00:00.000Z');
    expect(pendingExpiry(createdAt, at).minutesLeft).toBe(65);
    expect(pendingExpiry(createdAt, at).expired).toBe(false);
  });

  it('làm tròn XUỐNG phút — không bao giờ hứa nhiều hơn thực tế', () => {
    // 10:00 + 12 phút 40 giây trôi qua → còn 52 phút 20 giây → in "52", không phải "53".
    const at = new Date('2026-08-07T10:12:40.000Z');
    expect(pendingExpiry(createdAt, at).minutesLeft).toBe(52);
  });

  it('đúng mốc 65 phút là ĐÃ hết hạn, không phải còn 0', () => {
    const at = new Date('2026-08-07T11:05:00.000Z');
    const r = pendingExpiry(createdAt, at);
    expect(r.expired).toBe(true);
    expect(r.minutesLeft).toBe(0);
  });

  it('quá hạn thì kẹp ở 0, không trả số âm', () => {
    const at = new Date('2026-08-07T23:00:00.000Z');
    expect(pendingExpiry(createdAt, at).minutesLeft).toBe(0);
    expect(pendingExpiry(createdAt, at).expired).toBe(true);
  });

  it('hằng số khớp PENDING_TTL_MINUTES của API', () => {
    expect(PENDING_TTL_MINUTES).toBe(65);
  });
});

describe('pendingDeadline — mốc đơn chờ bị nhả', () => {
  it('là createdAt cộng PENDING_TTL_MINUTES', () => {
    expect(pendingDeadline('2026-10-09T10:59:36.812Z').toISOString()).toBe(
      '2026-10-09T12:04:36.812Z',
    );
  });
});

// Final review (NHÓM 5) — MỘT nguồn cho cả nhãn nút Pay (`booking-wizard.tsx`) VÀ
// dòng Total (`checkout-summary.tsx`): trẻ em CÙNG đơn giá người lớn.
describe('computeBookingTotal — tổng tiền, trẻ em CÙNG đơn giá', () => {
  it('2 adults 1 child × $1,290 → "3870.00"', () => {
    expect(computeBookingTotal('1290.00', 2, 1)).toBe('3870.00');
  });

  it('1 adult, 0 children → chính đơn giá', () => {
    expect(computeBookingTotal('1290.00', 1, 0)).toBe('1290.00');
  });

  it('luôn trả 2 chữ số thập phân, kể cả giá tròn', () => {
    expect(computeBookingTotal('100', 1, 0)).toBe('100.00');
  });
});

// Vé success dựng theo giải phẫu boarding-pass thật (docs/adr redesign) — barcode
// là "trang trí ấn phẩm" sinh từ CHÍNH mã đặt chỗ, KHÔNG random: random sẽ đổi
// hình mỗi lần render (SSR/CSR lệch nhau) và trông giả hơn cả dashed-border
// cliché mà bản trước vừa gỡ. (Serial "NO. …" của cuống hoá đơn gỡ ở review cuối
// P7 cùng nhánh "đã là voucher" của hoá đơn.)
describe('ticketBarcodeWidths — vạch barcode giả deterministic theo mã đặt chỗ', () => {
  it('cùng mã → cùng mảng bề rộng', () => {
    expect(ticketBarcodeWidths('TRV-ABC123')).toEqual(ticketBarcodeWidths('TRV-ABC123'));
  });

  it('khác mã → khác mảng bề rộng', () => {
    expect(ticketBarcodeWidths('TRV-ABC123')).not.toEqual(ticketBarcodeWidths('TRV-XYZ999'));
  });

  it('52 phần tử, mỗi bề rộng trong khoảng 1-4px', () => {
    const widths = ticketBarcodeWidths('BK-TESTAAAA');
    expect(widths).toHaveLength(52);
    for (const w of widths) {
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(4);
    }
  });

  /**
   * Số phần tử bị RÀNG BUỘC BỞI BỀ NGANG CUỐNG, không phải chọn cho đẹp — nên
   * canh bằng test thay vì để trong một comment rồi có người nâng lên cho
   * "dày hơn nữa" và làm tràn.
   *
   * Trần 160px đến từ cuống vé DỌC của `CheckoutShell` — component đó đã xoá
   * 19/08, nhưng trần được GIỮ LẠI có chủ đích: bỏ nó đi thì chẳng còn gì canh
   * khi có người nâng số vạch. (Cuống ngang của `BookingReceipt` từng là chỗ vẽ
   * rộng rãi nhất; hoá đơn thôi in mã vạch từ review cuối P7 — mã vạch nay ở vé
   * của trang chi tiết đơn và voucher, qua `TicketBarcode`.)
   *
   * Chỉ canh trên mã HỢP LỆ (`BK-` + 8 ký tự, theo `BookingCodeSchema`). Mã
   * ngắn hơn như `BK-1` cho tổng lớn hơn hẳn vì chu kỳ lặp ngắn rơi vào toàn
   * ký tự cho vạch dày — nhưng mã đó không tồn tại được, nên bắt nó là tự trói
   * mình vào một ràng buộc giả.
   */
  it('tổng bề ngang khi vẽ dính liền phải lọt trong 160px của cuống vé dọc', () => {
    const QUIET_ZONE = 8;
    const STUB_INNER_WIDTH = 160;
    // Bốn mã hợp lệ, gồm cả mã cho tổng lớn nhất tìm được khi quét 200k mã.
    for (const code of ['BK-TESTAAAA', 'BK-RGXA2GLQ', 'BK-ZZZZZZZZ', 'BK-00000000']) {
      const total = ticketBarcodeWidths(code).reduce((a, b) => a + b, 0) + QUIET_ZONE;
      expect(total, code).toBeLessThanOrEqual(STUB_INNER_WIDTH);
    }
  });

  it('mã ngắn hơn số vạch vẫn sinh đủ vạch (lặp ký tự theo chu kỳ)', () => {
    expect(ticketBarcodeWidths('BK-1')).toHaveLength(52);
  });
});

describe('bookingPriceLines — dòng tiền theo người lớn và trẻ em (spec P7 §4.2)', () => {
  it('tách người lớn và trẻ em; số tiền = đơn giá × số người', () => {
    expect(
      bookingPriceLines({ unitPrice: '49.00', numAdults: 2, numChildren: 1, currency: 'USD' }),
    ).toEqual([
      { label: '2 adults', amount: '$98' },
      { label: '1 child', amount: '$49' },
    ]);
  });

  /** Một dòng "0 children" chỉ làm hoá đơn dài ra mà không thêm sự thật nào. */
  it('không có trẻ em thì chỉ một dòng', () => {
    expect(
      bookingPriceLines({ unitPrice: '39.00', numAdults: 1, numChildren: 0, currency: 'USD' }),
    ).toEqual([{ label: '1 adult', amount: '$39' }]);
  });

  /**
   * Đơn giá có xu (giá khuyến mãi của seed: 49 × 0.85 = 41.65) thì cả đơn in đủ hai số lẻ —
   * review P7 06/10: làm tròn riêng từng dòng thì "$90 + $90" lại ra Total "$181", còn Stripe
   * thu $180.96 (BK-LRYP3PBP của seed).
   */
  it('đơn giá có xu: mọi dòng in đủ hai số lẻ, cộng lại đúng bằng tổng', () => {
    const booking = { unitPrice: '45.24', numAdults: 2, numChildren: 2, currency: 'USD' };
    expect(bookingPriceLines(booking)).toEqual([
      { label: '2 adults', amount: '$90.48' },
      { label: '2 children', amount: '$90.48' },
    ]);
    expect(formatBookingMoney(booking, '180.96')).toBe('$180.96');
  });

  it('nhận thẳng một Booking — đúng cách trang chi tiết và voucher gọi', () => {
    expect(
      bookingPriceLines(makeBooking({ unitPrice: '120.00', numAdults: 2, numChildren: 0 })),
    ).toEqual([{ label: '2 adults', amount: '$240' }]);
  });

  it('exact: mọi dòng đủ hai số lẻ dù đơn giá chẵn — khối tiền có dòng hoàn đứng cùng cột', () => {
    expect(
      bookingPriceLines(
        { unitPrice: '49.00', numAdults: 2, numChildren: 1, currency: 'USD' },
        { exact: true },
      ),
    ).toEqual([
      { label: '2 adults', amount: '$98.00' },
      { label: '1 child', amount: '$49.00' },
    ]);
  });
});

describe('formatBookingMoney — tiền của MỘT đơn định dạng theo cả đơn', () => {
  it('đơn giá chẵn: không số lẻ, như biên nhận trước nay', () => {
    expect(formatBookingMoney({ unitPrice: '49.00', currency: 'USD' }, '147.00')).toBe('$147');
  });

  it('đơn giá có xu: đủ hai số lẻ, kể cả số tròn của chính đơn ấy', () => {
    const promo = { unitPrice: '41.65', currency: 'USD' };
    expect(formatBookingMoney(promo, '83.30')).toBe('$83.30');
    expect(formatBookingMoney(promo, '41.65')).toBe('$41.65');
  });

  it('exact: đủ hai số lẻ dù đơn giá chẵn', () => {
    expect(
      formatBookingMoney({ unitPrice: '49.00', currency: 'USD' }, '147.00', { exact: true }),
    ).toBe('$147.00');
  });
});
