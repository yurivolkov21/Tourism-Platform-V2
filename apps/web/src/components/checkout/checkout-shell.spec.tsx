import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckoutShell } from './checkout-shell';

/**
 * Smoke test cho khuôn "tấm vé" — chỉ canh những thứ dễ vỡ nhất khi redesign:
 * (1) có `code` thì phải có đường xé (đục lỗ) + cuống vé (mã, nút chép, dòng
 *     hint) + nhãn TOUR VOUCHER + fine print;
 * (2) KHÔNG có `code` (trang cancel không có mã, hoặc success nhánh notFound)
 *     thì KHÔNG được có bất kỳ thứ nào ở trên — card render bình thường.
 *
 * Mood/auto-refresh/notFound là logic của TRANG (`success/page.tsx`,
 * `cancel/page.tsx`), không phải của shell — không lặp lại ở đây.
 */
describe('CheckoutShell', () => {
  it('có code → có đường xé, cuống vé (mã, nút chép, dòng hint), nhãn TOUR VOUCHER và fine print', () => {
    render(
      <CheckoutShell tone="success" title="Booking confirmed" code="TRV-ABC123" codeLabel="Ref">
        <p>facts go here</p>
      </CheckoutShell>,
    );

    expect(document.querySelector('[data-slot="ticket-tear"]')).toBeInTheDocument();
    // Mã lặp lại HAI lần trong cuống — cỡ lớn cạnh nút chép, và cỡ nhỏ ngay
    // dưới barcode (giải phẫu vé thật, mục 7) — không phải lỗi trùng lặp.
    expect(screen.getAllByText('TRV-ABC123').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
    expect(screen.getByText(/show this code at the meeting point/i)).toBeInTheDocument();
    expect(screen.getAllByText(/tour voucher/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/present this voucher at the meeting point/i)).toBeInTheDocument();
  });

  it('KHÔNG có code (trang cancel không mã / success notFound) → KHÔNG đường xé, KHÔNG cuống, KHÔNG nhãn voucher/fine-print', () => {
    render(
      <CheckoutShell tone="muted" title="We couldn’t find that booking.">
        <p>fallback actions</p>
      </CheckoutShell>,
    );

    expect(document.querySelector('[data-slot="ticket-tear"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy code/i })).not.toBeInTheDocument();
    expect(screen.getByText('fallback actions')).toBeInTheDocument();
    expect(screen.queryByText(/tour voucher/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/present this voucher at the meeting point/i),
    ).not.toBeInTheDocument();
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
