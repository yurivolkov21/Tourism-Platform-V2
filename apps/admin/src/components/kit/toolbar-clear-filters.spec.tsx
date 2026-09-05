import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFiltersHref, ToolbarClearFilters } from './toolbar-clear-filters';

/**
 * Nút xoá DUY NHẤT của hàng điều khiển (05/09) — thay bảy cặp nút xoá rời mà
 * `TableSearchForm` và `ToolbarDateRange` từng tự mang.
 *
 * Hai thứ đáng canh, và cả hai đều là chỗ một nút xoá hay nói dối:
 *
 * 1. **Không có gì để xoá thì KHÔNG vẽ.** Một nút xoá luôn hiện là một nút
 *    mời bỏ bộ lọc không tồn tại — và trên `/bookings`, nơi URL trần được độn
 *    sẵn khoảng tháng hiện tại, đó là trạng thái thường gặp nhất.
 * 2. **Phép so phải GHIM trang.** Đây là mẹo mà `ToolbarDateRange.go()` trả
 *    giá hai vòng review mới tìm ra; `clearFiltersHref` giữ nó ở kit để bảy
 *    vùng không ai chép sai.
 */
const onNavigate = vi.fn();
const LABEL = messages.admin.table.clearFilters;

beforeEach(() => {
  onNavigate.mockReset();
});

describe('clearFiltersHref', () => {
  it('hai href bằng nhau → null, tức không có gì để xoá', () => {
    expect(clearFiltersHref('/reviews', '/reviews')).toBeNull();
  });

  it('khác nhau → trả chính href đã xoá', () => {
    expect(clearFiltersHref('/reviews', '/reviews?q=ada')).toBe('/reviews');
  });

  it('so bằng CHUỖI nên thứ tự tham số cũng phải khớp', () => {
    // Không phải sự khắt khe thừa: `*Href` của mọi vùng ghi tham số theo một
    // thứ tự cố định (chính vì lý do này), nên hai chuỗi chỉ khác thứ tự là
    // dấu hiệu ai đó vừa dựng href bằng tay thay vì gọi hàm của vùng.
    expect(clearFiltersHref('/reviews?a=1&b=2', '/reviews?b=2&a=1')).toBe('/reviews?a=1&b=2');
  });
});

describe('ToolbarClearFilters', () => {
  it('href null thì KHÔNG vẽ gì cả', () => {
    const { container } = render(
      <ToolbarClearFilters label={LABEL} href={null} onNavigate={onNavigate} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('bấm thì điều hướng tới đúng href đã cho', async () => {
    const user = userEvent.setup();
    render(<ToolbarClearFilters label={LABEL} href="/reviews" onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: LABEL }));

    expect(onNavigate).toHaveBeenCalledWith('/reviews');
  });

  it('nhãn nói số nhiều — nó xoá cả hàng, không riêng ô đứng cạnh', () => {
    render(<ToolbarClearFilters label={LABEL} href="/reviews" onNavigate={onNavigate} />);

    expect(screen.getByRole('button')).toHaveTextContent('Clear filters');
  });
});
