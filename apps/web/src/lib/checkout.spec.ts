import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  checkoutMood,
  computeBookingTotal,
  PENDING_TTL_MINUTES,
  pendingExpiry,
  ticketBarcodeWidths,
  ticketSerial,
} from './checkout';

describe('checkoutMood — tâm trạng màn /checkout/success đọc từ status', () => {
  it('PAID → confirmed', () => {
    expect(checkoutMood(makeBooking({ status: 'PAID' }))).toBe('confirmed');
  });

  it('PENDING → confirming (webhook chưa về)', () => {
    expect(checkoutMood(makeBooking({ status: 'PENDING' }))).toBe('confirming');
  });

  /**
   * Ba status còn lại KHÔNG phải "đang chờ webhook" — chúng là kết cục đã rồi.
   * Nếu khách quay về từ cổng mà booking đã CANCELLED (hết hạn giữa chừng) thì
   * hiện mood confirming là nói dối: trang sẽ tự làm mới mãi mãi cho một thứ
   * không bao giờ đổi.
   */
  it.each(['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const)(
    '%s → settled, KHÔNG tự làm mới',
    (status) => {
      expect(checkoutMood(makeBooking({ status }))).toBe('settled');
    },
  );
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

// Final review (NHÓM 5) — MỘT nguồn cho cả nhãn CTA (`booking-form.tsx`) VÀ
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

// Vé success dựng theo giải phẫu boarding-pass thật (docs/adr redesign) — cả
// serial lẫn barcode là "trang trí ấn phẩm" sinh từ CHÍNH mã đặt chỗ, KHÔNG
// random: random sẽ đổi hình mỗi lần render (SSR/CSR lệch nhau) và trông giả
// hơn cả dashed-border cliché mà bản trước vừa gỡ.
describe('ticketSerial — số serial 10 chữ số deterministic từ mã đặt chỗ', () => {
  it('cùng mã → luôn cùng serial', () => {
    expect(ticketSerial('TRV-ABC123')).toBe(ticketSerial('TRV-ABC123'));
  });

  it('khác mã → khác serial', () => {
    expect(ticketSerial('TRV-ABC123')).not.toBe(ticketSerial('TRV-XYZ999'));
  });

  it('luôn đúng 10 chữ số (đệm 0 bên trái nếu ngắn)', () => {
    expect(ticketSerial('BK-TESTAAAA')).toMatch(/^\d{10}$/);
  });
});

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
   * 19/08, nhưng trần được GIỮ LẠI có chủ đích: cuống ngang của `BookingReceipt`
   * rộng rãi hơn nhiều, nên một trần chật hơn là biên an toàn miễn phí, và bỏ
   * nó đi thì chẳng còn gì canh khi có người nâng số vạch.
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
