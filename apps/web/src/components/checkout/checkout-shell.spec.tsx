import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckoutShell } from './checkout-shell';

/**
 * Smoke test cho khuôn "tấm vé" — chỉ canh HAI thứ dễ vỡ nhất khi redesign:
 * (1) có `code` thì phải có đường xé + cuống vé (mã, nút chép, dòng hint);
 * (2) KHÔNG có `code` (trang cancel không có mã, hoặc success nhánh notFound)
 * thì KHÔNG được có đường xé/cuống — card render bình thường.
 *
 * Mood/auto-refresh/notFound là logic của TRANG (`success/page.tsx`,
 * `cancel/page.tsx`), không phải của shell — không lặp lại ở đây.
 */
describe('CheckoutShell', () => {
  it('có code → có đường xé và cuống vé (mã, nút chép, dòng hint)', () => {
    render(
      <CheckoutShell tone="success" title="Booking confirmed" code="TRV-ABC123" codeLabel="Ref">
        <p>facts go here</p>
      </CheckoutShell>,
    );

    expect(document.querySelector('[data-slot="ticket-tear"]')).toBeInTheDocument();
    expect(screen.getByText('TRV-ABC123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
    expect(screen.getByText(/show this code at the meeting point/i)).toBeInTheDocument();
  });

  it('KHÔNG có code (trang cancel không mã / success notFound) → KHÔNG đường xé, KHÔNG cuống vé', () => {
    render(
      <CheckoutShell tone="muted" title="We couldn’t find that booking.">
        <p>fallback actions</p>
      </CheckoutShell>,
    );

    expect(document.querySelector('[data-slot="ticket-tear"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy code/i })).not.toBeInTheDocument();
    expect(screen.getByText('fallback actions')).toBeInTheDocument();
  });

  it('vẫn render title/body/children bình thường khi có code lẫn khi không', () => {
    render(
      <CheckoutShell tone="warning" title="Payment cancelled" body="No charge was made.">
        <p>cta buttons</p>
      </CheckoutShell>,
    );

    expect(screen.getByRole('heading', { name: /payment cancelled/i })).toBeInTheDocument();
    expect(screen.getByText(/no charge was made/i)).toBeInTheDocument();
    expect(screen.getByText('cta buttons')).toBeInTheDocument();
  });
});
