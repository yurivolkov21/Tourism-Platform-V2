import { contract, DEPARTURE_SEATS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  CREATE_CONTRACT_CODES,
  departureFormPayload,
  hasFormErrors,
  isSetStatusStale,
  isUpdateStale,
  SET_STATUS_CONTRACT_CODES,
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
});
