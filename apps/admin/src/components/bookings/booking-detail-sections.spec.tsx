import { render, screen } from '@testing-library/react';
import type { AdminBookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { BookingSummaryCards, RefundLedgerTable } from './booking-detail-sections';

/**
 * Ba card ngữ cảnh của `/bookings/[code]` — pin ba sạn nhỏ của spec 2026-10-05 §4: email
 * xuống dòng sau `@` (#7), provider in nhãn thay vì enum thô (#9), chuyến một ngày in một
 * ngày (#10). Thêm một ca canh luật rỗng của `DetailRow`, vì nó vừa đổi sang nhận node.
 * Cuối file là ô lý do của sổ hoàn (review A1).
 */
const t = messages.admin.bookings.detail;

/** Một booking đủ field contract — chỉ đổi phần từng test quan tâm. */
function makeDetail(overrides: Partial<AdminBookingDetail> = {}): AdminBookingDetail {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'NX-ABC123',
    status: 'PAID',
    tourTitle: 'Ha Long Bay Cruise',
    tourSlug: 'ha-long-bay-cruise',
    tourImage: null,
    tourDestinations: [],
    departureStartDate: '2026-09-14',
    departureEndDate: '2026-09-20',
    cancellationDeadline: '2026-09-07',
    departureCancelled: false,
    unitPrice: '499.00',
    totalAmount: '1497.00',
    currency: 'USD',
    numAdults: 2,
    numChildren: 1,
    contactName: 'Ann Nguyen',
    contactEmail: 'ann@example.com',
    contactPhone: '+84 90 000 0000',
    specialRequests: 'Vegetarian meals',
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-08-30T09:30:00.000Z',
    cancelledAt: null,
    createdAt: '2026-08-29T02:05:00.000Z',
    cancellationStatus: null,
    cancellationRequestedAt: null,
    cancellationDecidedAt: null,
    refundedTotal: '0.00',
    reviewedAt: null,
    cancellationRequests: [],
    refunds: [],
    ...overrides,
  };
}

/** Ô giá trị `<dd>` đứng ngay sau nhãn — mỗi nhãn chỉ có một lần trong ba card. */
function valueCell(label: string): Element {
  const value = screen.getByText(label).nextElementSibling;
  if (!value) throw new Error(`Nhãn "${label}" không có ô giá trị đi kèm`);
  return value;
}

describe('BookingSummaryCards', () => {
  it('email có MỘT cơ hội xuống dòng ngay sau @, chữ giữ nguyên', () => {
    render(<BookingSummaryCards booking={makeDetail({ contactEmail: 'linh.nguyen@gmail.com' })} />);

    expect(valueCell(t.customer.email).innerHTML).toBe('linh.nguyen@<wbr>gmail.com');
  });

  it('provider in nhãn của vùng Payment events, không in enum thô', () => {
    render(<BookingSummaryCards booking={makeDetail({ paymentProvider: 'PAYPAL' })} />);

    expect(valueCell(t.payment.provider).textContent).toBe('PayPal');
  });

  it('chuyến một ngày in MỘT ngày', () => {
    render(
      <BookingSummaryCards
        booking={makeDetail({ departureStartDate: '2026-12-27', departureEndDate: '2026-12-27' })}
      />,
    );

    expect(valueCell(t.departure.dates).textContent).toBe('27 Dec 2026');
  });

  it('giá trị trống vẫn in gạch ngang — cả `null` lẫn chuỗi rỗng', () => {
    // Ca canh luật rỗng: `DetailRow` đổi từ `value || t.empty` sang nhận node, và luật
    // mới phải giữ đúng hai nghĩa "trống" của bản cũ.
    render(
      <BookingSummaryCards booking={makeDetail({ contactPhone: null, specialRequests: '' })} />,
    );

    expect(valueCell(t.customer.phone).textContent).toBe(t.empty);
    expect(valueCell(t.customer.requests).textContent).toBe(t.empty);
  });
});

describe('RefundLedgerTable', () => {
  it('lý do dài xuống dòng chứ không bị cắt mất (review A1)', () => {
    // Ô bảng của kit UI mặc `whitespace-nowrap`; bản cũ `max-w-64 truncate` không có `title`
    // nên phần sau dấu "…" của một lý do 500 ký tự không đọc được ở đâu cả.
    const reason =
      'Medical emergency: the customer sent a hospital note on 18 Oct and asked to move the trip; Owner approved half back as goodwill.';
    render(
      <RefundLedgerTable
        refunds={[
          {
            id: '22222222-2222-4222-8222-222222222222',
            amount: '58.50',
            currency: 'USD',
            providerRefundId: 're_test_1',
            adminId: '33333333-3333-4333-8333-333333333333',
            reason,
            createdAt: '2026-10-18T03:00:00.000Z',
          },
        ]}
        refundedTotal="58.50"
        currency="USD"
      />,
    );

    const cell = screen.getByText(reason);
    expect(cell).toHaveClass('max-w-64', 'whitespace-normal', 'wrap-anywhere');
    expect(cell).not.toHaveClass('truncate');
  });
});
