import type { PaymentEventRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { formatEventAmount, toPaymentEventRowVM } from './payment-events-view';

/**
 * Mapper hiển thị bảng `/payment-events` (spec P4c §3-F8) — THUẦN, ngoài
 * React: bảng và drawer chỉ render VM có sẵn, không tự format tiền/ngày,
 * không tự ghép href booking, không tự đoán nhãn type.
 */
const t = messages.admin.paymentEvents;

const COMPLETED: PaymentEventRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  provider: 'STRIPE',
  eventId: 'evt_1Pabc123',
  type: 'payment.completed',
  amount: '117.00',
  currency: 'USD',
  bookingCode: 'BK-ABCD1234',
  receivedAt: '2026-09-01T10:00:00.000Z',
  processedAt: '2026-09-01T10:00:01.000Z',
};

describe('toPaymentEventRowVM', () => {
  it('event đã xử lý: nhãn provider/type từ i18n, tiền theo đồng tiền server nói, link booking, ngày UTC', () => {
    expect(toPaymentEventRowVM(COMPLETED)).toEqual({
      id: COMPLETED.id,
      provider: 'STRIPE',
      providerLabel: t.provider.STRIPE,
      eventId: 'evt_1Pabc123',
      type: 'payment.completed',
      typeLabel: t.type['payment.completed'],
      amount: '$117.00',
      bookingCode: 'BK-ABCD1234',
      bookingHref: '/bookings/BK-ABCD1234',
      received: '1 Sep 2026, 10:00 UTC',
      processed: '1 Sep 2026, 10:00 UTC',
      unprocessed: false,
    });
  });

  it('event `other` chưa xử lý: amount/booking null giữ null (bảng tự chọn chữ thay), unprocessed = true', () => {
    const vm = toPaymentEventRowVM({
      ...COMPLETED,
      type: 'other',
      amount: null,
      currency: null,
      bookingCode: null,
      processedAt: null,
    });
    expect(vm).toMatchObject({
      typeLabel: t.type.other,
      amount: null,
      bookingCode: null,
      bookingHref: null,
      processed: null,
      unprocessed: true,
    });
  });

  it('type lạ (cột DB là chuỗi tự do) → nhãn là CHUỖI THÔ, không ném lỗi, không bịa "Unknown"', () => {
    expect(toPaymentEventRowVM({ ...COMPLETED, type: 'payment.chargeback' }).typeLabel).toBe(
      'payment.chargeback',
    );
  });

  it('PayPal + VND: tiền format theo đồng tiền thật, provider nhãn PayPal', () => {
    const vm = toPaymentEventRowVM({
      ...COMPLETED,
      provider: 'PAYPAL',
      amount: '500000.00',
      currency: 'VND',
    });
    expect(vm.providerLabel).toBe(t.provider.PAYPAL);
    expect(vm.amount).toBe('₫500,000.00');
  });
});

describe('formatEventAmount', () => {
  it('cả hai null → null; có tiền có đồng tiền → formatAmount của back-office', () => {
    expect(formatEventAmount(null, null)).toBeNull();
    expect(formatEventAmount('117.00', 'USD')).toBe('$117.00');
  });

  it('có tiền mà KHÔNG có đồng tiền → in chuỗi thập phân thô, KHÔNG đoán một ký hiệu', () => {
    // Quyết định tự chọn F8: gateway ghi cả hai hoặc không, nhưng contract
    // cho phép lệch — dán "$" lên một số không biết đồng tiền là nói dối.
    expect(formatEventAmount('117.00', null)).toBe('117.00');
  });

  it('có đồng tiền mà không có tiền → null (không có gì để in)', () => {
    expect(formatEventAmount(null, 'USD')).toBeNull();
  });
});
