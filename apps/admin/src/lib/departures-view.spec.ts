import type { DeparturePhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { makeDepartureRow, serverRow, vmAt } from '@/test/departure-row';
import { departurePhaseBadgeVariant, phaseFilterLabel, toDepartureRowVM } from './departures-view';

/**
 * VM của một hàng bảng chuyến (spec P4e-1 F12, F16). Phần đáng test nhất là ba
 * thứ quyết định nút: `canEdit`, `toggle` và `canCancel`. Chúng quyết định nút
 * nào hiện và bấm được; lệch là mời admin bấm một thứ chắc chắn bị từ chối,
 * hoặc giấu mất một thao tác hợp lệ.
 */

const t = messages.admin.departures;

/** Chuyến 10/10 → 14/10, hạn chót 03/10; một checkout đang dở. */
const ROW = makeDepartureRow({ pendingBookingCount: 1 });

/** Trước hạn chót (03/10) và sau nó — hai thế giới của mọi ca dưới đây. */
const BEFORE = '2026-10-01';
const AFTER = '2026-10-04';

describe('toDepartureRowVM', () => {
  it('gộp hai ngày thành một ô đọc được, giữ ISO thô cho form', () => {
    const vm = vmAt(ROW, BEFORE);

    expect(vm.dates).toBe('10 Oct 2026 – 14 Oct 2026');
    expect(vm.startDate).toBe('2026-10-10');
    expect(vm.endDate).toBe('2026-10-14');
  });

  it('giá không có override thì kèm dòng phụ nói nó từ tour mà ra', () => {
    const inherited = vmAt(ROW, BEFORE);
    const own = vmAt({ ...ROW, priceOverride: '99.00', price: '99.00' }, BEFORE);

    expect(inherited.price).toBe('$129.00');
    expect(inherited.priceNote).toBe(t.list.inheritedPrice);
    expect(own.priceNote).toBeNull();
    // Ô giá của form mở đúng trạng thái hiện tại: trống hay mang số riêng.
    expect(inherited.priceOverride).toBeNull();
    expect(own.priceOverride).toBe('99.00');
  });

  it('ĐÚNG ngày hạn chót vẫn chưa phải là quá hạn', () => {
    // Hạn hết lúc 23:59:59 giờ Việt Nam của chính ngày đó (ADR-0041).
    const vm = vmAt(ROW, '2026-10-03');

    expect(vm.deadlinePassed).toBe(false);
  });

  it('qua hạn chót: nhãn đổi và chuyến đã đóng KHÔNG mở lại được', () => {
    const closed = { ...ROW, status: 'CLOSED' as const };

    expect(vmAt(closed, BEFORE).toggle).toEqual({ next: 'OPEN', enabled: true });
    expect(vmAt(closed, AFTER).toggle).toEqual({ next: 'OPEN', enabled: false });
    expect(vmAt(closed, AFTER).deadlinePassed).toBe(true);
  });

  it('chuyến OPEN có nút đóng, chuyến CLOSED có nút mở lại', () => {
    expect(vmAt(ROW, BEFORE).toggle?.next).toBe('CLOSED');
    expect(vmAt({ ...ROW, status: 'CLOSED' }, BEFORE).toggle?.next).toBe('OPEN');
  });

  it('chuyến ĐÃ HUỶ đóng sổ: không sửa, không đóng, không mở lại', () => {
    // Khách của nó đã được hoàn tiền theo đường F13 — mọi nút ở đây đều là
    // một cách đi vòng quanh việc ấy.
    const vm = vmAt({ ...ROW, status: 'CANCELLED' }, BEFORE);

    expect(vm.canEdit).toBe(false);
    expect(vm.toggle).toBeNull();
  });

  it('ghế và booking là HAI con số khác nhau', () => {
    // Một booking chở nhiều khách: 2 booking sống trên 4 ghế đã đặt.
    const vm = vmAt(ROW, BEFORE);

    expect(vm.seats).toBe('4 / 20');
    expect(vm.liveBookingCount).toBe(2);
    expect(vm.bookingsLabel).toBe(t.list.bookings(2));
  });

  it('khách ĐÃ trả là HIỆU, không phải một con số thứ ba từ server', () => {
    // Hai nguồn cho cùng một phép trừ là hai chỗ có thể lệch nhau.
    const vm = vmAt({ ...ROW, liveBookingCount: 5, pendingBookingCount: 2 }, BEFORE);

    expect(vm.pendingBookingCount).toBe(2);
    expect(vm.paidBookingCount).toBe(3);
  });

  it('chở NGUYÊN token phiên bản xuống form, không diễn giải gì', () => {
    // Form sửa gửi ngược token này lên để server phát hiện ghi đè mù giữa hai
    // tab; VM mà "làm sạch" nó là tự vô hiệu hoá lớp chống ấy.
    expect(vmAt(ROW, BEFORE).version).toBe(ROW.version);
  });
});

describe('departurePhaseBadgeVariant', () => {
  it('xanh đặc ĐÚNG MỘT chỗ — còn nhận booking mới; đỏ chỉ cho chuyến đã huỷ', () => {
    expect(departurePhaseBadgeVariant('on-sale')).toBe('default');
    expect(departurePhaseBadgeVariant('deadline-passed')).toBe('outline');
    expect(departurePhaseBadgeVariant('closed')).toBe('secondary');
    expect(departurePhaseBadgeVariant('departed')).toBe('outline');
    expect(departurePhaseBadgeVariant('completed')).toBe('secondary');
    expect(departurePhaseBadgeVariant('cancelled')).toBe('destructive');
  });
});

describe('phaseFilterLabel', () => {
  it('nhóm MỘT giai đoạn mượn đúng nhãn huy hiệu — một khái niệm, một chữ', () => {
    // Đổi nhãn huy hiệu mà tab lọc đúng các hàng ấy vẫn giữ chữ cũ là hai chữ
    // cho một thứ (vòng review F16).
    expect(phaseFilterLabel('departed')).toBe(t.phase.departed);
    expect(phaseFilterLabel('completed')).toBe(t.phase.completed);
    expect(phaseFilterLabel('cancelled')).toBe(t.phase.cancelled);
  });

  it('Upcoming gom ba giai đoạn nên có chữ riêng', () => {
    expect(phaseFilterLabel('upcoming')).toBe(t.list.upcoming);
  });
});

describe('toDepartureRowVM — huỷ chuyến và hoàn tiền (F13)', () => {
  it('chuyến còn sống: huỷ được, cột hoàn tiền TRỐNG', () => {
    const vm = vmAt(ROW, BEFORE);

    expect(vm.canCancel).toBe(true);
    expect(vm.refundOutstanding).toBeNull();
  });

  it('QUÁ hạn đặt vẫn huỷ được — khác hẳn nút Mở lại', () => {
    // Hạn chót là luật cho việc BÁN. Một chuyến quá hạn đặt mà hướng dẫn viên
    // gãy chân vẫn phải huỷ được; đó đúng là lúc cần nút này nhất.
    const vm = vmAt({ ...ROW, status: 'CLOSED' }, AFTER);

    expect(vm.canCancel).toBe(true);
    expect(vm.toggle).toEqual({ next: 'OPEN', enabled: false });
  });

  it('ĐÃ tới ngày khởi hành thì thôi huỷ', () => {
    expect(vmAt(ROW, '2026-10-10').canCancel).toBe(false);
    expect(vmAt(ROW, '2026-10-09').canCancel).toBe(true);
  });

  it('chuyến đã huỷ còn người chờ: in ĐÚNG số người chưa nhận tiền', () => {
    const vm = vmAt({ ...ROW, status: 'CANCELLED', liveBookingCount: 2 }, BEFORE);

    expect(vm.refundOutstanding).toBe(t.list.refundOutstanding(2));
    expect(vm.canCancel).toBe(false);
  });

  it('hoàn xong hết thì cột TRỐNG, không in "0"', () => {
    // Cột Status đã nói chuyến đã huỷ; một con số 0 ở đây chỉ là nhiễu.
    const vm = vmAt({ ...ROW, status: 'CANCELLED', liveBookingCount: 0 }, BEFORE);

    expect(vm.refundOutstanding).toBeNull();
  });

  it('chuyến huỷ khi CHƯA AI ĐẶT cũng trống — không có gì để hoàn', () => {
    // Ca phổ biến nhất của nút huỷ (dọn lịch dựng nhầm). Bản đầu in
    // "0 / 0 refunded" ở đây, một tỉ lệ không nói gì trên màn tiền.
    const vm = vmAt({ ...ROW, status: 'CANCELLED', liveBookingCount: 0, seatsBooked: 0 }, BEFORE);

    expect(vm.refundOutstanding).toBeNull();
  });
});

describe('toDepartureRowVM — nút theo GIAI ĐOẠN (F16)', () => {
  // Chuyến 10/10 → 14/10, hạn chót 03/10. Mỗi ca chọn `status` và `today` để
  // server ra đúng giai đoạn cần thử.
  it.each([
    // giai đoạn, status, today, toggle, canCancel, canEdit
    ['on-sale', 'OPEN', '2026-10-01', { next: 'CLOSED', enabled: true }, true, true],
    // Quá hạn mà chưa đi vẫn đóng được: checkout mở trước hạn có thể đang dở.
    ['deadline-passed', 'OPEN', '2026-10-05', { next: 'CLOSED', enabled: true }, true, true],
    ['closed', 'CLOSED', '2026-10-01', { next: 'OPEN', enabled: true }, true, true],
    ['departed', 'OPEN', '2026-10-12', null, false, true],
    ['completed', 'CLOSED', '2026-10-20', null, false, true],
    ['cancelled', 'CANCELLED', '2026-10-01', null, false, false],
  ] as const)('%s', (phase, status, today, toggle, canCancel, canEdit) => {
    const vm = vmAt({ ...ROW, status }, today);

    expect(vm.phase).toBe(phase);
    expect(vm.phaseLabel).toBe(t.phase[phase]);
    expect({ toggle: vm.toggle, canCancel: vm.canCancel, canEdit: vm.canEdit }).toEqual({
      toggle,
      canCancel,
      canEdit,
    });
  });

  it('closed ĐÃ QUA hạn chót: còn nút Reopen nhưng nút tắt', () => {
    const vm = vmAt({ ...ROW, status: 'CLOSED' }, '2026-10-05');

    expect(vm.phase).toBe('closed');
    expect(vm.toggle).toEqual({ next: 'OPEN', enabled: false });
  });

  it('VM TIN `phase` của server, không tự tính lại từ `today`', () => {
    // Server nói `departed` trong khi `today` còn trước ngày đi. Huy hiệu, nút
    // đóng/mở và nút huỷ phải cùng nghe server.
    const vm = toDepartureRowVM(
      { ...serverRow(ROW, '2026-10-01'), phase: 'departed' },
      '2026-10-01',
    );

    expect(vm.toggle).toBeNull();
    expect(vm.canCancel).toBe(false);
  });

  it('hàng THIẾU `phase` (API cũ trong khe deploy): không mời bấm gì ngoài Sửa', () => {
    // Vercel thường deploy xong trước Render; vài phút ấy admin mới đọc API cũ
    // và hàng không có `phase`. Lùi về phía an toàn: không đóng, không huỷ.
    const vm = toDepartureRowVM(
      { ...serverRow(ROW, '2026-10-01'), phase: undefined as unknown as DeparturePhase },
      '2026-10-01',
    );

    expect(vm.toggle).toBeNull();
    expect(vm.canCancel).toBe(false);
    expect(vm.canEdit).toBe(true);
  });
});
