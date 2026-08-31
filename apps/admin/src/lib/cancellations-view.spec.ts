import type { AdminCancellationRequest } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { cancellationStatusBadgeVariant, canDecide, toCancellationRow } from './cancellations-view';

/**
 * Mapper hiển thị hàng đợi cancellation (spec P4b §3-F3) — THUẦN, ngoài
 * React: bảng chỉ render VM có sẵn, không tự format ngày hay tự đoán xem
 * hàng nào còn quyết được.
 */
const REQUESTED: AdminCancellationRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  bookingCode: 'BK-ABCD1234',
  reason: 'Family emergency — cannot travel.',
  status: 'REQUESTED',
  decisionNote: null,
  decidedAt: null,
  createdAt: '2026-08-30T09:30:00.000Z',
  tourTitle: 'Ha Long Bay Cruise',
  departureStartDate: '2026-09-14',
  contactName: 'Ada Lovelace',
  contactEmail: 'ada@example.com',
  // Tiền cho dialog approve (review F3): total + đã hoàn — server trả thật.
  totalAmount: '120.00',
  refundedTotal: '20.00',
  currency: 'USD',
};

describe('toCancellationRow', () => {
  it('request đang mở → hàng đầy đủ, có link chéo sang booking, chưa có quyết định', () => {
    expect(toCancellationRow(REQUESTED)).toEqual({
      id: REQUESTED.id,
      bookingCode: 'BK-ABCD1234',
      // Link chéo sang trang chi tiết booking (§3-F3) — admin quyết xong
      // thường muốn soi sổ cái ngay.
      bookingHref: '/bookings/BK-ABCD1234',
      tourTitle: 'Ha Long Bay Cruise',
      departure: '14 Sep 2026',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      reason: 'Family emergency — cannot travel.',
      status: 'REQUESTED',
      statusLabel: messages.admin.cancellations.status.REQUESTED,
      requested: '30 Aug 2026, 09:30 UTC',
      decided: null,
      decisionNote: null,
      pending: true,
      totalAmount: '120.00',
      refundedTotal: '20.00',
      currency: 'USD',
    });
  });

  it('request đã quyết → mốc quyết định + ghi chú hiện ra, hết pending', () => {
    const row = toCancellationRow({
      ...REQUESTED,
      status: 'DENIED',
      decisionNote: 'Departure is in 3 days.',
      decidedAt: '2026-08-31T14:05:00.000Z',
    });
    expect(row.decided).toBe('31 Aug 2026, 14:05 UTC');
    expect(row.decisionNote).toBe('Departure is in 3 days.');
    expect(row.pending).toBe(false);
    expect(row.statusLabel).toBe(messages.admin.cancellations.status.DENIED);
  });

  it('ngày khởi hành tách CHUỖI, không qua new Date() — không lệch một ngày ở múi giờ âm', () => {
    expect(toCancellationRow({ ...REQUESTED, departureStartDate: '2026-01-01' }).departure).toBe(
      '1 Jan 2026',
    );
  });
});

describe('canDecide', () => {
  it('chỉ REQUESTED mới quyết được — decision là chung cuộc (append-only D1-B)', () => {
    expect(canDecide('REQUESTED')).toBe(true);
    expect(canDecide('DENIED')).toBe(false);
    expect(canDecide('REFUNDED')).toBe(false);
  });
});

describe('cancellationStatusBadgeVariant', () => {
  it('mỗi trạng thái một variant; DENIED KHÔNG phải destructive — từ chối là kết cục bình thường', () => {
    expect(cancellationStatusBadgeVariant('REQUESTED')).toBe('secondary');
    expect(cancellationStatusBadgeVariant('REFUNDED')).toBe('default');
    expect(cancellationStatusBadgeVariant('DENIED')).toBe('outline');
  });
});
