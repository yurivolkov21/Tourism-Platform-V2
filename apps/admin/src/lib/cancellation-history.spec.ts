import type { Refund } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { formatDateTime } from './bookings-view';
import {
  type CancellationHistoryBooking,
  type CancellationHistoryRequest,
  cancellationStatusBadgeVariant,
  refundedForRequest,
  toCancellationHistoryRow,
} from './cancellation-history';

/**
 * Khối "Cancellation history" của `/bookings/[code]` (ADR-0041, spec §6): ai
 * huỷ, lúc nào, trong hay quá hạn chót, hoàn bao nhiêu, lý do. Mọi mốc trong
 * bộ này là mốc cố định — mapper không được đọc đồng hồ (Q7).
 */
const t = messages.admin.bookings.detail.cancellations;

/** Chuyến 2 ngày 20–21/10/2026: N = 3 → ngày chót 17/10 (ADR-0041 §3.1). */
const BOOKING: CancellationHistoryBooking = {
  departureStartDate: '2026-10-20',
  departureEndDate: '2026-10-21',
  currency: 'USD',
  refunds: [],
};

function refund(n: number, amount: string, createdAt: string, adminId: string | null): Refund {
  return {
    id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`,
    amount,
    currency: 'USD',
    providerRefundId: `re_test_${n}`,
    adminId,
    reason: adminId ? 'Medical emergency' : null,
    createdAt,
  };
}

const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

/** Lõi huỷ ghi yêu cầu và dòng hoàn trong CÙNG giao dịch: gửi = quyết = hoàn. */
function selfCancel(at: string): CancellationHistoryRequest {
  return {
    id: '22222222-2222-4222-8222-000000000001',
    status: 'REFUNDED',
    reason: null,
    decisionNote: null,
    decidedAt: at,
    decidedByCustomer: true,
    createdAt: at,
  };
}

describe('toCancellationHistoryRow — khách tự huỷ', () => {
  it('23:59:59 ngày chót theo giờ Việt Nam → trong hạn, hoàn đủ, "By the customer"', () => {
    const at = '2026-10-17T16:59:59.000Z';
    const row = toCancellationHistoryRow(selfCancel(at), {
      ...BOOKING,
      refunds: [refund(1, '117.00', at, null)],
    });

    expect(row).toEqual({
      id: '22222222-2222-4222-8222-000000000001',
      statusLabel: t.status.REFUNDED,
      badgeVariant: 'default',
      actor: t.byCustomer,
      requested: formatDateTime(at),
      decided: formatDateTime(at),
      deadline: t.withinDeadline('17 Oct 2026'),
      refund: t.refunded('$117.00'),
      reason: t.noReason,
      decisionNote: null,
    });
  });

  it('00:00 ngày hôm sau theo giờ Việt Nam (UTC vẫn là ngày chót) → QUÁ hạn, không hoàn', () => {
    const row = toCancellationHistoryRow(selfCancel('2026-10-17T17:00:00.000Z'), BOOKING);

    expect(row.deadline).toBe(t.afterDeadline('17 Oct 2026'));
    expect(row.refund).toBe(t.notRefunded);
  });

  it('hoàn thiện chí SAU lần huỷ không bị tính là tiền của lần huỷ', () => {
    const row = toCancellationHistoryRow(selfCancel('2026-10-17T17:00:00.000Z'), {
      ...BOOKING,
      refunds: [refund(2, '40.00', '2026-10-19T03:00:00.000Z', ADMIN_ID)],
    });

    expect(row.refund).toBe(t.notRefunded);
  });

  it('hoàn thiện chí TRƯỚC lần huỷ (booking PARTIALLY_REFUNDED) cũng không lẫn vào', () => {
    const at = '2026-10-10T03:00:00.000Z';
    const row = toCancellationHistoryRow(
      { ...selfCancel(at), reason: 'Change of plans' },
      {
        ...BOOKING,
        refunds: [
          refund(1, '30.00', '2026-10-01T03:00:00.000Z', ADMIN_ID),
          refund(2, '87.00', at, null),
        ],
      },
    );

    expect(row.refund).toBe(t.refunded('$87.00'));
    expect(row.reason).toBe('Change of plans');
  });
});

describe('toCancellationHistoryRow — dữ liệu của luồng duyệt cũ', () => {
  it('nhân viên duyệt → "By staff", tiền hoàn tính trong khoảng từ lúc gửi tới lúc quyết', () => {
    const row = toCancellationHistoryRow(
      {
        id: '22222222-2222-4222-8222-000000000002',
        status: 'REFUNDED',
        reason: 'Family emergency',
        decisionNote: 'Approved per policy.',
        decidedAt: '2026-10-02T03:00:00.000Z',
        decidedByCustomer: false,
        createdAt: '2026-10-01T03:00:00.000Z',
      },
      { ...BOOKING, refunds: [refund(3, '58.50', '2026-10-02T03:00:00.000Z', ADMIN_ID)] },
    );

    expect(row.actor).toBe(t.byStaff);
    expect(row.deadline).toBe(t.withinDeadline('17 Oct 2026'));
    expect(row.refund).toBe(t.refunded('$58.50'));
    expect(row.decisionNote).toBe('Approved per policy.');
  });

  it('DENIED và REQUESTED không in hạn chót lẫn số tiền — yêu cầu ấy không huỷ booking', () => {
    const denied = toCancellationHistoryRow(
      {
        id: '22222222-2222-4222-8222-000000000003',
        status: 'DENIED',
        reason: 'Changed my mind',
        decisionNote: null,
        decidedAt: '2026-10-05T03:00:00.000Z',
        decidedByCustomer: false,
        createdAt: '2026-10-04T03:00:00.000Z',
      },
      BOOKING,
    );
    expect(denied).toMatchObject({
      statusLabel: t.status.DENIED,
      badgeVariant: 'outline',
      actor: t.byStaff,
      deadline: null,
      refund: null,
    });

    const open = toCancellationHistoryRow(
      {
        id: '22222222-2222-4222-8222-000000000004',
        status: 'REQUESTED',
        reason: 'Please cancel',
        decisionNote: null,
        decidedAt: null,
        decidedByCustomer: false,
        createdAt: '2026-10-06T03:00:00.000Z',
      },
      BOOKING,
    );
    expect(open).toMatchObject({
      statusLabel: t.status.REQUESTED,
      badgeVariant: 'secondary',
      actor: null,
      decided: null,
      deadline: null,
      refund: null,
    });
  });
});

describe('refundedForRequest', () => {
  it('cộng theo cent trong khoảng [min, max] của hai mốc — mốc JS lệch vài ms vẫn đúng', () => {
    expect(
      refundedForRequest(
        { createdAt: '2026-10-10T03:00:00.005Z', decidedAt: '2026-10-10T03:00:00.000Z' },
        [
          { amount: '0.1', createdAt: '2026-10-10T03:00:00.005Z' },
          { amount: '0.2', createdAt: '2026-10-10T03:00:00.000Z' },
          { amount: '5', createdAt: '2026-10-10T03:00:00.006Z' },
        ],
      ),
    ).toBe('0.30');
  });

  it('yêu cầu chưa quyết thì chưa có đồng nào của nó', () => {
    expect(
      refundedForRequest({ createdAt: '2026-10-10T03:00:00.000Z', decidedAt: null }, [
        { amount: '10.00', createdAt: '2026-10-10T03:00:00.000Z' },
      ]),
    ).toBe('0.00');
  });
});

describe('cancellationStatusBadgeVariant', () => {
  it('REFUNDED nổi bật, REQUESTED nhạt, DENIED viền trơn', () => {
    expect(cancellationStatusBadgeVariant('REFUNDED')).toBe('default');
    expect(cancellationStatusBadgeVariant('REQUESTED')).toBe('secondary');
    expect(cancellationStatusBadgeVariant('DENIED')).toBe('outline');
  });
});
