import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { type DepartureRowFixture, withPhase } from '@/test/departure-row';
import { departurePhaseBadgeVariant, toDepartureRowVM } from './departures-view';

/**
 * VM của một hàng bảng chuyến (spec P4e-1 F12). Ba lá cờ `canEdit`/`canClose`/
 * `canReopen` là phần đáng test nhất: chúng quyết định nút nào bấm được, và
 * chúng là bản SOI GƯƠNG của luật server — lệch là mời admin bấm một thứ chắc
 * chắn bị từ chối (hoặc giấu mất một thao tác hợp lệ).
 */

const t = messages.admin.departures;

const ROW: DepartureRowFixture = {
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
  version: '2026-09-20T08:00:00.000Z',
};

/** Trước hạn chót (03/10) và sau nó — hai thế giới của mọi ca dưới đây. */
const BEFORE = '2026-10-01';
const AFTER = '2026-10-04';

/** VM của một hàng ở ngày `today`, `phase` do chính hàm server tính. */
const vmAt = (row: DepartureRowFixture, today: string) =>
  toDepartureRowVM(withPhase(row, today), today);

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

    expect(vmAt(closed, BEFORE).canReopen).toBe(true);
    expect(vmAt(closed, AFTER).canReopen).toBe(false);
    expect(vmAt(closed, AFTER).deadlinePassed).toBe(true);
  });

  it('chuyến OPEN thì đóng được, chuyến CLOSED thì không có gì để đóng', () => {
    expect(vmAt(ROW, BEFORE).canClose).toBe(true);
    expect(vmAt({ ...ROW, status: 'CLOSED' }, BEFORE).canClose).toBe(false);
  });

  it('chuyến ĐÃ HUỶ đóng sổ: không sửa, không đóng, không mở lại', () => {
    // Khách của nó đã được hoàn tiền theo đường F13 — mọi nút ở đây đều là
    // một cách đi vòng quanh việc ấy.
    const vm = vmAt({ ...ROW, status: 'CANCELLED' }, BEFORE);

    expect(vm.canEdit).toBe(false);
    expect(vm.canClose).toBe(false);
    expect(vm.canReopen).toBe(false);
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
  it('xanh đặc ĐÚNG MỘT chỗ — còn nhận tiền được; đỏ chỉ cho chuyến đã huỷ', () => {
    expect(departurePhaseBadgeVariant('on-sale')).toBe('default');
    expect(departurePhaseBadgeVariant('deadline-passed')).toBe('outline');
    expect(departurePhaseBadgeVariant('closed')).toBe('secondary');
    expect(departurePhaseBadgeVariant('departed')).toBe('outline');
    expect(departurePhaseBadgeVariant('completed')).toBe('secondary');
    expect(departurePhaseBadgeVariant('cancelled')).toBe('destructive');
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
    const vm = vmAt(ROW, AFTER);

    expect(vm.canCancel).toBe(true);
    expect(vm.canReopen).toBe(false);
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

describe('toDepartureRowVM — cờ theo GIAI ĐOẠN (F16)', () => {
  // Chuyến 10/10 → 14/10, hạn chót 03/10. Mỗi ca chọn `status` và `today` để
  // server ra đúng giai đoạn cần thử.
  it.each([
    // giai đoạn, status, today, showToggle, canClose, canReopen, canCancel, canEdit
    ['on-sale', 'OPEN', '2026-10-01', true, true, false, true, true],
    ['deadline-passed', 'OPEN', '2026-10-05', true, true, false, true, true],
    ['closed', 'CLOSED', '2026-10-01', true, false, true, true, true],
    ['departed', 'OPEN', '2026-10-12', false, false, false, false, true],
    ['completed', 'CLOSED', '2026-10-20', false, false, false, false, true],
    ['cancelled', 'CANCELLED', '2026-10-01', false, false, false, false, false],
  ] as const)('%s', (phase, status, today, showToggle, canClose, canReopen, canCancel, canEdit) => {
    const vm = vmAt({ ...ROW, status }, today);

    expect(vm.phase).toBe(phase);
    expect(vm.phaseLabel).toBe(t.phase[phase]);
    expect({
      showToggle: vm.showToggle,
      canClose: vm.canClose,
      canReopen: vm.canReopen,
      canCancel: vm.canCancel,
      canEdit: vm.canEdit,
    }).toEqual({ showToggle, canClose, canReopen, canCancel, canEdit });
  });

  it('closed ĐÃ QUA hạn chót: còn chỗ cho nút Reopen nhưng nút tắt', () => {
    const vm = vmAt({ ...ROW, status: 'CLOSED' }, '2026-10-05');

    expect(vm.phase).toBe('closed');
    expect(vm.showToggle).toBe(true);
    expect(vm.canReopen).toBe(false);
  });

  it('VM TIN `phase` của server, không tự tính lại từ `today`', () => {
    // Server nói `departed` trong khi `today` của trang còn trước ngày đi —
    // chuyện có thật khi hai đồng hồ đứng hai bên mốc nửa đêm. Huy hiệu, nút
    // đóng/mở và nút huỷ phải cùng nghe server.
    const vm = toDepartureRowVM(
      { ...withPhase(ROW, '2026-10-01'), phase: 'departed' },
      '2026-10-01',
    );

    expect(vm.showToggle).toBe(false);
    expect(vm.canCancel).toBe(false);
  });
});
