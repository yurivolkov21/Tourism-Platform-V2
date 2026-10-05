import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TablePagination } from './table-pagination';

/**
 * Ô "Rows per page" của `TablePagination` (spec 2026-10-05 §2.3 và §5): từ 05/10 là kit
 * `Picker` biến thể field, thay cho `Select` trần `size="sm"` của block dashboard-01.
 * Spec này canh bốn điều của riêng chỗ ấy:
 *
 * - nhãn "Rows per page" gọi đúng tên ô — `Label htmlFor` trỏ vào `id` của trigger;
 * - cỡ trang ngoài dãy chọn vẫn in chính số ấy: URL nhận mọi `limit` từ 1 tới 100
 *   (`table-query.ts`), nên `?limit=37` phải hiện "37" chứ không hiện ô trống;
 * - ô cao 32px, bằng các nút nhảy trang đứng cạnh;
 * - danh sách mở lên trên và không đè lên ô (ô nằm sát đáy trang), chọn một mức thì điều
 *   hướng tới đúng href của mức ấy.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const PROPS = {
  page: 1,
  totalPages: 3,
  total: 120,
  pageSizeOptions: [10, 20, 30, 40, 50],
  hrefForPage: (page: number) => `/x?page=${page}`,
  hrefForPageSize: (size: number) => `/x?limit=${size}`,
};

beforeEach(() => push.mockReset());

describe('TablePagination — Rows per page', () => {
  it('ô mang tên "Rows per page", hiện cỡ trang đang dùng', () => {
    render(<TablePagination {...PROPS} pageSize={20} />);
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveTextContent('20');
  });

  it('?limit=37 (ngoài dãy) vẫn in "37"', () => {
    render(<TablePagination {...PROPS} pageSize={37} />);
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveTextContent('37');
  });

  it('cao 32px (data-size=default) như nút phân trang', () => {
    render(<TablePagination {...PROPS} pageSize={20} />);
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveAttribute(
      'data-size',
      'default',
    );
  });

  it('danh sách không đè lên ô, mở lên trên; chọn 30 → push href của 30', async () => {
    const user = userEvent.setup();
    render(<TablePagination {...PROPS} pageSize={20} />);
    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
    await screen.findAllByRole('option');
    const popup = document.querySelector('[data-slot="select-content"]');
    expect(popup).toHaveAttribute('data-align-trigger', 'false');
    expect(popup).toHaveAttribute('data-side', 'top');
    await user.click(screen.getByRole('option', { name: '30' }));
    expect(push).toHaveBeenCalledWith('/x?limit=30');
  });
});
