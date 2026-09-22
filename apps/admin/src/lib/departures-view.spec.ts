import type { AdminDepartureRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { departureStatusBadgeVariant, toDepartureRowVM } from './departures-view';

/**
 * VM của một hàng bảng chuyến (spec P4e-1 F12). Ba lá cờ `canEdit`/`canClose`/
 * `canReopen` là phần đáng test nhất: chúng quyết định nút nào bấm được, và
 * chúng là bản SOI GƯƠNG của luật server — lệch là mời admin bấm một thứ chắc
 * chắn bị từ chối (hoặc giấu mất một thao tác hợp lệ).
 */

const t = messages.admin.departures;

const ROW: AdminDepartureRow = {
  id: '4f1b1f2e-0000-4000-8000-000000000001',
  startDate: '2026-10-10',
  endDate: '2026-10-14',
  price: '129.00',
  priceOverride: null,
  currency: 'USD',
  seatsBooked: 4,
  seatsTotal: 20,
  status: 'OPEN',
  cancellationDeadline: '2026-10-03',
  liveBookingCount: 2,
  pendingBookingCount: 1,
  cancelledBookingCount: 0,
  version: '2026-09-20T08:00:00.000Z',
};

/** Trước hạn chót (03/10) và sau nó — hai thế giới của mọi ca dưới đây. */
const BEFORE = '2026-10-01';
const AFTER = '2026-10-04';

describe('toDepartureRowVM', () => {
  it('gộp hai ngày thành một ô đọc được, giữ ISO thô cho form', () => {
    const vm = toDepartureRowVM(ROW, BEFORE);

    expect(vm.dates).toBe('10 Oct 2026 – 14 Oct 2026');
    expect(vm.startDate).toBe('2026-10-10');
    expect(vm.endDate).toBe('2026-10-14');
  });

  it('giá không có override thì kèm dòng phụ nói nó từ tour mà ra', () => {
    const inherited = toDepartureRowVM(ROW, BEFORE);
    const own = toDepartureRowVM({ ...ROW, priceOverride: '99.00', price: '99.00' }, BEFORE);

    expect(inherited.price).toBe('$129.00');
    expect(inherited.priceNote).toBe(t.list.inheritedPrice);
    expect(own.priceNote).toBeNull();
    // Ô giá của form mở đúng trạng thái hiện tại: trống hay mang số riêng.
    expect(inherited.priceOverride).toBeNull();
    expect(own.priceOverride).toBe('99.00');
  });

  it('ĐÚNG ngày hạn chót vẫn chưa phải là quá hạn', () => {
    // Hạn hết lúc 23:59:59 giờ Việt Nam của chính ngày đó (ADR-0041).
    const vm = toDepartureRowVM(ROW, '2026-10-03');

    expect(vm.deadlinePassed).toBe(false);
  });

  it('qua hạn chót: nhãn đổi và chuyến đã đóng KHÔNG mở lại được', () => {
    const closed = { ...ROW, status: 'CLOSED' as const };

    expect(toDepartureRowVM(closed, BEFORE).canReopen).toBe(true);
    expect(toDepartureRowVM(closed, AFTER).canReopen).toBe(false);
    expect(toDepartureRowVM(closed, AFTER).deadlinePassed).toBe(true);
  });

  it('chuyến OPEN thì đóng được, chuyến CLOSED thì không có gì để đóng', () => {
    expect(toDepartureRowVM(ROW, BEFORE).canClose).toBe(true);
    expect(toDepartureRowVM({ ...ROW, status: 'CLOSED' }, BEFORE).canClose).toBe(false);
  });

  it('chuyến ĐÃ HUỶ đóng sổ: không sửa, không đóng, không mở lại', () => {
    // Khách của nó đã được hoàn tiền theo đường F13 — mọi nút ở đây đều là
    // một cách đi vòng quanh việc ấy.
    const vm = toDepartureRowVM({ ...ROW, status: 'CANCELLED' }, BEFORE);

    expect(vm.canEdit).toBe(false);
    expect(vm.canClose).toBe(false);
    expect(vm.canReopen).toBe(false);
  });

  it('ghế và booking là HAI con số khác nhau', () => {
    // Một booking chở nhiều khách: 2 booking sống trên 4 ghế đã đặt.
    const vm = toDepartureRowVM(ROW, BEFORE);

    expect(vm.seats).toBe('4 / 20');
    expect(vm.liveBookingCount).toBe(2);
    expect(vm.bookingsLabel).toBe(t.list.bookings(2));
  });

  it('khách ĐÃ trả là HIỆU, không phải một con số thứ ba từ server', () => {
    // Hai nguồn cho cùng một phép trừ là hai chỗ có thể lệch nhau.
    const vm = toDepartureRowVM({ ...ROW, liveBookingCount: 5, pendingBookingCount: 2 }, BEFORE);

    expect(vm.pendingBookingCount).toBe(2);
    expect(vm.paidBookingCount).toBe(3);
  });

  it('chở NGUYÊN token phiên bản xuống form, không diễn giải gì', () => {
    // Form sửa gửi ngược token này lên để server phát hiện ghi đè mù giữa hai
    // tab; VM mà "làm sạch" nó là tự vô hiệu hoá lớp chống ấy.
    expect(toDepartureRowVM(ROW, BEFORE).version).toBe(ROW.version);
  });
});

describe('departureStatusBadgeVariant', () => {
  it('ba trạng thái ba tone, và chỉ CANCELLED mới là tone cảnh báo', () => {
    expect(departureStatusBadgeVariant('OPEN')).toBe('default');
    expect(departureStatusBadgeVariant('CLOSED')).toBe('secondary');
    expect(departureStatusBadgeVariant('CANCELLED')).toBe('destructive');
  });
});

describe('toDepartureRowVM — huỷ chuyến và tiến độ hoàn tiền (F13)', () => {
  it('chuyến còn sống: huỷ được, KHÔNG có cột tiến độ', () => {
    // Tiến độ chỉ có nghĩa sau khi đã huỷ; in "0 / 2" ở mọi hàng là nhiễu.
    const vm = toDepartureRowVM(ROW, BEFORE);

    expect(vm.canCancel).toBe(true);
    expect(vm.refundProgress).toBeNull();
    expect(vm.refundPending).toBe(false);
  });

  it('QUÁ hạn đặt vẫn huỷ được — khác hẳn nút Mở lại', () => {
    // Hạn chót là luật cho việc BÁN. Một chuyến quá hạn đặt mà hướng dẫn viên
    // gãy chân vẫn phải huỷ được; đó đúng là lúc cần nút này nhất.
    const vm = toDepartureRowVM(ROW, AFTER);

    expect(vm.canCancel).toBe(true);
    expect(vm.canReopen).toBe(false);
  });

  it('ĐÃ tới ngày khởi hành thì thôi huỷ', () => {
    expect(toDepartureRowVM(ROW, '2026-10-10').canCancel).toBe(false);
    expect(toDepartureRowVM(ROW, '2026-10-09').canCancel).toBe(true);
  });

  it('chuyến đã huỷ: tiến độ là ĐÃ HUỶ trên ĐÃ HUỶ CỘNG CÒN SỐNG', () => {
    const vm = toDepartureRowVM(
      { ...ROW, status: 'CANCELLED', cancelledBookingCount: 3, liveBookingCount: 2 },
      BEFORE,
    );

    expect(vm.refundProgress).toBe(t.list.refundProgress(3, 5));
    // Còn 2 người chưa hoàn → bảng in dòng nói worker có thể đang ngủ.
    expect(vm.refundPending).toBe(true);
    expect(vm.canCancel).toBe(false);
  });

  it('hoàn xong hết thì tỉ lệ chạy tới đủ và dòng giải thích biến mất', () => {
    const vm = toDepartureRowVM(
      { ...ROW, status: 'CANCELLED', cancelledBookingCount: 5, liveBookingCount: 0 },
      BEFORE,
    );

    expect(vm.refundProgress).toBe(t.list.refundProgress(5, 5));
    expect(vm.refundPending).toBe(false);
  });
});
