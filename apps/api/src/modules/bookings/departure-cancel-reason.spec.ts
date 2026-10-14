import { DepartureStatus } from '../../generated/prisma/enums.js';
import { departureCancelReason } from './departure-cancel-reason.js';

const REASON = 'Heavy rain has closed the trail, so this departure is called off.';

describe('departureCancelReason — lý do công ty huỷ chuyến cho khách đọc (ADR-0041 AMEND 2)', () => {
  it('chuyến đã huỷ có lý do → trả nguyên văn câu admin gõ', () => {
    expect(departureCancelReason({ status: DepartureStatus.CANCELLED, cancelReason: REASON })).toBe(
      REASON,
    );
  });

  it('chuyến còn chạy hay chỉ tạm ngừng bán → null, dù cột có chữ', () => {
    for (const status of [DepartureStatus.OPEN, DepartureStatus.CLOSED]) {
      expect(departureCancelReason({ status, cancelReason: REASON })).toBeNull();
    }
  });

  it('chuyến huỷ không có lý do (chuyến của seed lượt 1) → null', () => {
    expect(
      departureCancelReason({ status: DepartureStatus.CANCELLED, cancelReason: null }),
    ).toBeNull();
  });

  it('lý do chỉ có khoảng trắng → null, không in một khối "Why" rỗng', () => {
    expect(
      departureCancelReason({ status: DepartureStatus.CANCELLED, cancelReason: '  \n ' }),
    ).toBeNull();
  });
});
