import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PAYMENT_EVENT_TYPES } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PaymentEventsQuery, paymentEventsHref } from '@/lib/payment-events-query';
import { PaymentEventsTypeMenu } from './payment-events-type-menu';

/**
 * Lọc theo type của `/payment-events`, chuyển từ `ToolbarSelect` sang kit
 * `ToolbarFilterMenu` ngày 03/09 (đợt 2, user chốt: áp khuôn `dropdown-menu-10`
 * cho nút "All types" của trang này).
 *
 * Spec canh phần RIÊNG của vùng — kit đã có spec của nó. Hai thứ ở đây không
 * được rơi khi đổi control:
 *
 * 1. Tiền tố `v:` (`toFreeValue`, vòng vá review F10): cột DB là chuỗi tự do
 *    nên một hàng `type = 'ALL'` từng trùng sentinel của kit.
 * 2. Mục TẠM cho type ngoài tuple (vòng vá review F8): `?type=` lạ vẫn lọc
 *    thật ở API, nên nút phải hiện đúng giá trị đó thay vì nói "All types"
 *    trong khi bảng đang lọc theo thứ khác.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const t = messages.admin.paymentEvents;
const QUERY: PaymentEventsQuery = { page: 2, limit: 20 };

beforeEach(() => {
  push.mockReset();
});

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: new RegExp(t.list.typeLabel) }));
  await screen.findByRole('menuitemradio', { name: t.list.typeAll });
}

describe('PaymentEventsTypeMenu', () => {
  it('mở ra có đủ bốn type gateway biết, cộng mục "All types"', async () => {
    const user = userEvent.setup();
    render(<PaymentEventsTypeMenu query={QUERY} />);
    await openMenu(user);

    for (const type of PAYMENT_EVENT_TYPES) {
      expect(screen.getByRole('menuitemradio', { name: t.type[type] })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(PAYMENT_EVENT_TYPES.length + 1);
  });

  it('chọn một type thì đẩy giá trị THÔ lên URL, không mang tiền tố `v:` theo', async () => {
    const user = userEvent.setup();
    render(<PaymentEventsTypeMenu query={QUERY} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: t.type['payment.failed'] }));

    const href = paymentEventsHref(QUERY, { type: 'payment.failed' });
    expect(push).toHaveBeenCalledWith(href);
    expect(href).not.toContain('v%3A');
    expect(href).not.toContain('v:');
  });

  it('chọn "All types" thì XOÁ filter khỏi URL', async () => {
    const user = userEvent.setup();
    render(<PaymentEventsTypeMenu query={{ ...QUERY, type: 'payment.completed' }} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: t.list.typeAll }));

    const href = paymentEventsHref({ ...QUERY, type: 'payment.completed' }, { type: null });
    expect(push).toHaveBeenCalledWith(href);
    expect(href).not.toContain('type=');
  });

  it('type NGOÀI tuple vẫn được nút hiện đúng — không nói dối là "All types"', async () => {
    const user = userEvent.setup();
    render(<PaymentEventsTypeMenu query={{ ...QUERY, type: 'charge.dispute.created' }} />);

    expect(screen.getByRole('button', { name: new RegExp(t.list.typeLabel) })).toHaveTextContent(
      'charge.dispute.created',
    );

    await openMenu(user);
    // Mục tạm phải có mặt VÀ đang được tích — nếu không, `RadioGroup` sẽ
    // không có mục nào khớp và dấu tích rơi vào khoảng không.
    expect(screen.getByRole('menuitemradio', { name: 'charge.dispute.created' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('một hàng `type = "ALL"` KHÔNG được biến thành mục xoá filter (review F10)', async () => {
    const user = userEvent.setup();
    render(<PaymentEventsTypeMenu query={{ ...QUERY, type: 'ALL' }} />);
    await openMenu(user);

    // Hai mục KHÁC NHAU cùng tồn tại: mục tạm "ALL" (giá trị thật, đang tích)
    // và mục "All types" (sentinel, không tích).
    expect(screen.getByRole('menuitemradio', { name: 'ALL' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: t.list.typeAll })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
