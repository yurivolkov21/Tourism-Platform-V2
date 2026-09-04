import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type SubscribersQuery, subscribersHref } from '@/lib/subscribers-query';
import { SubscribersSourceMenu } from './subscribers-source-menu';

/**
 * Lọc theo nguồn đăng ký của `/subscribers`, chuyển từ `ToolbarSelect` sang
 * kit `ToolbarFilterMenu` ngày 03/09 (đợt 2, user chốt: áp khuôn
 * `dropdown-menu-10` cho nút "All sources" của trang này).
 *
 * Spec canh phần RIÊNG của vùng — kit đã có spec của nó. Ba thứ không được
 * rơi khi đổi control, cả ba đều là quyết định đã cân nhắc ở F10:
 *
 * 1. Bảng chưa có nguồn nào thì KHÔNG render gì — một control chỉ có mục
 *    "All sources" là ô chiếm chỗ mà không lọc được gì. Hôm nay CHƯA đường
 *    ghi nào khai `source`, nên đây là trạng thái thường gặp nhất.
 * 2. Mục TẠM cho nguồn đang lọc mà không có trong danh sách distinct.
 * 3. Tiền tố `v:` — `source` là chuỗi tự do mà đường subscribe CÔNG KHAI ghi
 *    được, nên một hàng `source = 'ALL'` từng trùng sentinel của kit.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const t = messages.admin.subscribers.list;
const QUERY: SubscribersQuery = { page: 1, limit: 20 };
const SOURCES = ['blog-footer', 'checkout', 'homepage-hero'];

beforeEach(() => {
  push.mockReset();
});

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: new RegExp(t.sourceLabel) }));
  await screen.findByRole('menuitemradio', { name: t.sourceAll });
}

describe('SubscribersSourceMenu', () => {
  it('bảng chưa có nguồn nào thì không vẽ gì cả', () => {
    const { container } = render(<SubscribersSourceMenu query={QUERY} sources={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('mở ra có mục "All sources" và một mục cho mỗi nguồn distinct', async () => {
    const user = userEvent.setup();
    render(<SubscribersSourceMenu query={QUERY} sources={SOURCES} />);
    await openMenu(user);

    for (const source of SOURCES) {
      expect(screen.getByRole('menuitemradio', { name: source })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(SOURCES.length + 1);
  });

  it('chọn một nguồn thì đẩy giá trị THÔ lên URL, không mang tiền tố `v:` theo', async () => {
    const user = userEvent.setup();
    render(<SubscribersSourceMenu query={QUERY} sources={SOURCES} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: 'checkout' }));

    const href = subscribersHref(QUERY, { source: 'checkout' });
    expect(push).toHaveBeenCalledWith(href);
    expect(href).toContain('checkout');
    expect(href).not.toContain('v%3A');
  });

  it('chọn "All sources" thì XOÁ filter khỏi URL', async () => {
    const user = userEvent.setup();
    const filtered = { ...QUERY, source: 'checkout' };
    render(<SubscribersSourceMenu query={filtered} sources={SOURCES} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: t.sourceAll }));

    const href = subscribersHref(filtered, { source: null });
    expect(push).toHaveBeenCalledWith(href);
    expect(href).not.toContain('source=');
  });

  it('nguồn đang lọc mà không có trong danh sách vẫn được nút hiện đúng', async () => {
    const user = userEvent.setup();
    // Ca này xảy ra khi gõ tay `?source=`, hoặc khi hàng cuối cùng của nguồn
    // đó vừa bị lọc mất khỏi trang.
    render(<SubscribersSourceMenu query={{ ...QUERY, source: 'gone' }} sources={SOURCES} />);

    expect(screen.getByRole('button', { name: new RegExp(t.sourceLabel) })).toHaveTextContent(
      'gone',
    );

    await openMenu(user);
    expect(screen.getByRole('menuitemradio', { name: 'gone' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('không còn nguồn nào NHƯNG đang lọc theo một nguồn lạ thì vẫn phải vẽ', async () => {
    const user = userEvent.setup();
    // Không vẽ ở đây là nhốt người dùng: bảng đang lọc mà không có control
    // nào để bỏ lọc.
    render(<SubscribersSourceMenu query={{ ...QUERY, source: 'gone' }} sources={[]} />);
    await openMenu(user);

    expect(screen.getByRole('menuitemradio', { name: 'gone' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: t.sourceAll })).toBeInTheDocument();
  });

  it('một hàng `source = "ALL"` KHÔNG được biến thành mục xoá filter (review F10)', async () => {
    const user = userEvent.setup();
    render(<SubscribersSourceMenu query={{ ...QUERY, source: 'ALL' }} sources={['ALL']} />);
    await openMenu(user);

    expect(screen.getByRole('menuitemradio', { name: 'ALL' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: t.sourceAll })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
