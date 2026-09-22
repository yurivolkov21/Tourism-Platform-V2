import { contract, DEPARTURE_SEATS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  CREATE_CONTRACT_CODES,
  createDeadlineHint,
  departureFormPayload,
  hasFormErrors,
  isSetStatusStale,
  isUpdateStale,
  SET_STATUS_CONTRACT_CODES,
  setStatusConfirmRows,
  setStatusDialogCopy,
  UPDATE_CONTRACT_CODES,
  updateErrorCopy,
  validateDepartureForm,
} from './departures-write';

/**
 * Logic thuần của ba lệnh ghi vùng chuyến (spec P4e-1 F12).
 *
 * Ca đắt nhất ở đây là phép đối chiếu tập mã: i18n là nguồn của tập mã phía
 * admin, nên một mã contract thêm vào mà quên viết câu sẽ rơi về câu GENERIC
 * mập mờ — và không có gì đỏ. Test này là thứ đỏ thay.
 */

const t = messages.admin.departures;
const VALID = { startDate: '2026-12-01', endDate: '2026-12-03', seats: '12', price: '' };

describe('tập mã lỗi khớp contract', () => {
  it('ba codec phủ ĐÚNG các mã mà contract khai', () => {
    const codes = (errorMap: object) => Object.keys(errorMap).sort();

    expect([...CREATE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.departures.create['~orpc'].errorMap),
    );
    expect([...UPDATE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.departures.update['~orpc'].errorMap),
    );
    expect([...SET_STATUS_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.departures.setStatus['~orpc'].errorMap),
    );
  });

  it('mã TRẠNG-THÁI-CŨ đóng dialog; mã sửa-tại-chỗ thì không', () => {
    // Thế giới đã đổi dưới chân dialog → đóng + toast + refresh.
    expect(isUpdateStale('DEPARTURE_HAS_BOOKINGS')).toBe(true);
    expect(isUpdateStale('SEATS_BELOW_BOOKED')).toBe(true);
    // Ai đó vừa sửa chính chuyến này: bấm lại cùng payload cũ thì lần nào
    // cũng hỏng như nhau, nên đóng dialog + làm mới bảng mới là lối ra đúng.
    expect(isUpdateStale('DEPARTURE_STALE')).toBe(true);
    expect(isSetStatusStale('DEADLINE_PASSED')).toBe(true);
    // Còn hai mã này nói về thứ đang nằm trong ô nhập — đóng dialog ở đây là
    // bắt người ta gõ lại từ đầu.
    expect(isUpdateStale('INVALID_DATE_RANGE')).toBe(false);
    expect(isUpdateStale('START_IN_PAST')).toBe(false);
  });

  it('mỗi mã một câu riêng, không rơi về giọng GENERIC', () => {
    expect(updateErrorCopy('DEPARTURE_HAS_BOOKINGS')).toBe(t.edit.errors.DEPARTURE_HAS_BOOKINGS);
    expect(updateErrorCopy('UNAUTHORIZED')).toBe(messages.admin.errors.write.UNAUTHORIZED);
  });
});

describe('validateDepartureForm', () => {
  it('form hợp lệ không có lỗi nào', () => {
    expect(hasFormErrors(validateDepartureForm(VALID, { seatsBooked: 0 }))).toBe(false);
  });

  it('thiếu ngày là lỗi của ĐÚNG ô đó', () => {
    const errors = validateDepartureForm({ ...VALID, startDate: '' }, { seatsBooked: 0 });

    expect(errors.startDate).toBe(t.form.errors.startRequired);
    expect(errors.endDate).toBeUndefined();
  });

  it('ngày về trước ngày đi báo ở ô ngày về', () => {
    const errors = validateDepartureForm(
      { ...VALID, startDate: '2026-12-05', endDate: '2026-12-01' },
      { seatsBooked: 0 },
    );

    expect(errors.endDate).toBe(t.form.errors.range);
  });

  it('ghế phải là số nguyên trong khoảng, trần đọc từ contract', () => {
    const bad = (seats: string) => validateDepartureForm({ ...VALID, seats }, { seatsBooked: 0 });

    expect(bad('0').seats).toBeDefined();
    expect(bad('2.5').seats).toBeDefined();
    expect(bad('abc').seats).toBeDefined();
    expect(bad(String(DEPARTURE_SEATS_MAX + 1)).seats).toBeDefined();
    expect(bad(String(DEPARTURE_SEATS_MAX)).seats).toBeUndefined();
  });

  it('hạ ghế dưới số đã đặt báo NGAY tại ô, kèm con số thật', () => {
    // Soi gương luật server: `seatsBooked` nằm sẵn trên hàng đang sửa, nên
    // không cần đi một vòng 409 mới biết.
    const errors = validateDepartureForm({ ...VALID, seats: '3' }, { seatsBooked: 4 });

    expect(errors.seats).toBe(t.form.errors.seatsBelowBooked(4));
  });

  it('hạ xuống ĐÚNG bằng số đã đặt thì cho đi — cùng biên với server', () => {
    expect(
      validateDepartureForm({ ...VALID, seats: '4' }, { seatsBooked: 4 }).seats,
    ).toBeUndefined();
  });

  it('giá trống là hợp lệ (thừa hưởng basePrice); quá 2 số lẻ thì không', () => {
    expect(validateDepartureForm(VALID, { seatsBooked: 0 }).price).toBeUndefined();
    expect(
      validateDepartureForm({ ...VALID, price: '129.999' }, { seatsBooked: 0 }).price,
    ).toBeDefined();
    expect(
      validateDepartureForm({ ...VALID, price: '-1' }, { seatsBooked: 0 }).price,
    ).toBeDefined();
  });
});

describe('departureFormPayload', () => {
  it('ô giá TRỐNG thành `null`, không thành chuỗi rỗng', () => {
    // Chuỗi rỗng rơi xuống `DecimalStringSchema` là một 400; `null` mới là
    // "thừa hưởng basePrice".
    expect(departureFormPayload(VALID)).toEqual({
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      seatsTotal: 12,
      priceOverride: null,
    });
  });

  it('khoảng trắng quanh giá bị cắt', () => {
    expect(departureFormPayload({ ...VALID, price: '  99.50 ' }).priceOverride).toBe('99.50');
  });
});

describe('setStatusDialogCopy', () => {
  it('hai chiều hai câu, và câu ĐÓNG nói thẳng thứ KHÔNG xảy ra', () => {
    // Đóng chuyến không báo ai và không hoàn đồng nào — đó là câu admin cần
    // nhất trước khi bấm.
    expect(setStatusDialogCopy('CLOSED').warning).toBe(t.setStatus.dialog.closeWarning);
    expect(setStatusDialogCopy('OPEN').warning).toBe(t.setStatus.dialog.reopenWarning);
  });

  it('còn checkout đang dở: NỐI thêm câu thứ hai, vì câu đầu nói sai về họ', () => {
    // "Nobody is told anything" đúng với khách ĐÃ trả, sai với khách ĐANG trả:
    // đường claim đòi chuyến còn mở, nên thanh toán về sau khi đóng sẽ bị từ
    // chối rồi hoàn tiền tự động KÈM EMAIL.
    const warning = setStatusDialogCopy('CLOSED', 2).warning;

    expect(warning).toContain(t.setStatus.dialog.closeWarning);
    expect(warning).toContain(t.setStatus.dialog.closePendingWarning(2));
  });

  it('chiều MỞ LẠI không đụng tới con số ấy — đóng mới là chiều gây hậu quả', () => {
    expect(setStatusDialogCopy('OPEN', 2).warning).toBe(t.setStatus.dialog.reopenWarning);
  });
});

describe('setStatusConfirmRows', () => {
  const ROW = { dates: '10 Oct 2026 – 14 Oct 2026', deadline: '3 Oct 2026' };

  it('khách ĐÃ trả và khách ĐANG trả là HAI dòng, không phải một con số gộp', () => {
    const rows = setStatusConfirmRows({ ...ROW, paidBookingCount: 3, pendingBookingCount: 2 });

    expect(rows.map((row) => row.label)).toEqual([
      t.setStatus.rows.departure,
      t.setStatus.rows.paidBookings,
      t.setStatus.rows.pendingBookings,
      t.setStatus.rows.deadline,
    ]);
    expect(rows[1]?.value).toBe('3');
    expect(rows[2]?.value).toBe('2');
  });

  it('không ai đang thanh toán thì dòng ấy BIẾN MẤT, không in số 0', () => {
    // Một dòng `0` cố định là nhiễu ở mọi chuyến bình thường, mà nhiễu thì
    // người ta thôi đọc — kể cả lần nó khác 0.
    const rows = setStatusConfirmRows({ ...ROW, paidBookingCount: 3, pendingBookingCount: 0 });

    expect(rows.map((row) => row.label)).not.toContain(t.setStatus.rows.pendingBookings);
    expect(rows).toHaveLength(3);
  });
});

describe('createDeadlineHint', () => {
  // Chuyến 3 ngày (01→03/12) ⇒ N = 3 ⇒ hạn nhận đặt 28/11.
  const DATES = { startDate: '2026-12-01', endDate: '2026-12-03', seats: '12', price: '' };

  it('tạo chuyến đã QUÁ hạn nhận đặt: nói trước rằng nó sẽ không bán được', () => {
    // Hạn là `ngày đi − N` với N tới 7 ngày, nên một chuyến khởi hành TUẦN SAU
    // có thể đã quá hạn ngay lúc tạo — copy cũ hứa "goes on sale straight
    // away" thì nói sai đúng chỗ đó.
    expect(createDeadlineHint(DATES, '2026-11-29')).toBe(t.create.deadlinePassedHint);
  });

  it('ĐÚNG ngày hạn chót vẫn còn kịp — hạn hết lúc 23:59:59 giờ Việt Nam', () => {
    expect(createDeadlineHint(DATES, '2026-11-28')).toBeUndefined();
    expect(createDeadlineHint(DATES, '2026-11-01')).toBeUndefined();
  });

  it('ngày chưa gõ xong hoặc ngược nhau: im lặng, KHÔNG ném', () => {
    // `cancellationDeadline` ném `RangeError` ở cả hai ca; một hint không được
    // phép giết cả dialog đang mở.
    expect(createDeadlineHint({ ...DATES, startDate: '' }, '2026-11-29')).toBeUndefined();
    expect(createDeadlineHint({ ...DATES, endDate: '2026-11-30' }, '2026-11-29')).toBeUndefined();
  });
});
