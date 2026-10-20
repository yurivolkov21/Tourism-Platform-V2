import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { parsePaymentEventsSearchParams } from '@/lib/payment-events-query';
import type { PaymentEventRowVM } from '@/lib/payment-events-view';
import { PaymentEventsTable } from './payment-events-table';

/**
 * Ghi chú handler phải thấy được từ BẢNG (review A1, 20/10). Row "auto-refund … FAILED —
 * operator must refund manually" vẫn có `processedAt`, nên không vào "Unprocessed now", không
 * bật "Needs attention"; trước bản này ghi chú chỉ hiện trong drawer, tức Owner phải mở từng row
 * mới biết có khoản phải hoàn tay.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const t = messages.admin.paymentEvents;

const NOTE =
  'amount mismatch; auto-refund of capture pi_1 FAILED (card_declined) — operator must refund manually';

function row(n: number, note: string | null): PaymentEventRowVM {
  return {
    id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`,
    provider: 'STRIPE',
    providerLabel: t.provider.STRIPE,
    eventId: `evt_${n}`,
    type: 'payment.completed',
    typeLabel: t.type['payment.completed'],
    amount: '$117.00',
    bookingCode: null,
    received: '20 Oct 2026, 03:00 UTC',
    processed: '20 Oct 2026, 03:01 UTC',
    note,
  };
}

describe('PaymentEventsTable — ghi chú handler', () => {
  it('row có ghi chú mang badge cạnh mốc Processed; row bình thường thì không', () => {
    render(
      <PaymentEventsTable
        rows={[row(1, NOTE), row(2, null)]}
        query={parsePaymentEventsSearchParams({})}
        total={2}
        totalPages={1}
        load={vi.fn()}
      />,
    );

    const [, noted, plain] = screen.getAllByRole('row');
    if (!noted || !plain) throw new Error('Bảng thiếu hàng');
    expect(within(noted).getByText(t.detail.note)).toBeInTheDocument();
    expect(within(plain).queryByText(t.detail.note)).not.toBeInTheDocument();
    // Mốc vẫn còn: badge đứng CẠNH, không thay chỗ của nó.
    expect(within(noted).getByText('20 Oct 2026, 03:01 UTC')).toBeInTheDocument();
  });
});
