import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableSearchForm } from './table-search-form';

/**
 * Ô tìm kiếm DÙNG CHUNG của bảng admin (kit P4b — nâng từ cặp bản chép
 * verbatim `BookingsSearch`/`ReviewsSearch`, sổ nợ F4 31/08). Nó chỉ làm một
 * việc: báo cho vùng biết admin muốn tìm gì hoặc muốn bỏ lọc — vùng tự dựng
 * URL. Chuỗi đi ra NGUYÊN VĂN: trim/cắt trần là luật của `*Href` (một bản
 * duy nhất), không phải của ô nhập.
 */

const onSearch = vi.fn();
const onClear = vi.fn();

const PROPS = {
  inputId: 'test-search',
  label: 'Search bookings',
  placeholder: 'Code, name or email',
  clearLabel: 'Clear',
  onSearch,
  onClear,
};

beforeEach(() => {
  onSearch.mockReset();
  onClear.mockReset();
});

describe('TableSearchForm', () => {
  it('ô nhập có nhãn riêng cho trình đọc màn hình và mang giá trị đang lọc', () => {
    render(<TableSearchForm {...PROPS} value="ada" />);

    expect(screen.getByLabelText('Search bookings')).toHaveValue('ada');
  });

  it('điều hướng (đổi value) đặt lại cả trạng thái focus — placeholder không đè lên nhãn nổi', async () => {
    // Vòng vá review 02/09: remount ô qua `key` gỡ node đang focus mà KHÔNG
    // bắn blur; `focused` từng nằm ở cha nên kẹt true, và ô mới (chưa focus,
    // nhãn ở vị trí nghỉ) lại hiện placeholder đè lên nhãn. Nay key bọc cả
    // cụm ô + state của nó.
    const user = userEvent.setup();
    const { rerender } = render(<TableSearchForm {...PROPS} value={undefined} />);

    await user.click(screen.getByLabelText('Search bookings'));
    expect(screen.getByLabelText('Search bookings')).toHaveAttribute(
      'placeholder',
      'Code, name or email',
    );

    rerender(<TableSearchForm {...PROPS} value="ada" />);
    rerender(<TableSearchForm {...PROPS} value={undefined} />);

    expect(screen.getByLabelText('Search bookings')).toHaveAttribute('placeholder', ' ');
  });

  it('submit gửi NGUYÊN VĂN chuỗi đang gõ — trim là việc của *Href', async () => {
    const user = userEvent.setup();
    render(<TableSearchForm {...PROPS} value={undefined} />);
    await user.type(screen.getByLabelText('Search bookings'), '  BK-ABCD  {Enter}');

    expect(onSearch).toHaveBeenCalledWith('  BK-ABCD  ');
  });

  it('chưa lọc gì thì KHÔNG có nút Clear — không mời bỏ một bộ lọc không tồn tại', () => {
    render(<TableSearchForm {...PROPS} value={undefined} />);

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('đang lọc thì nút Clear gọi onClear', async () => {
    const user = userEvent.setup();
    render(<TableSearchForm {...PROPS} value="ada" />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalled();
  });

  /**
   * Nhãn nổi (`input-24`) và placeholder tranh nhau ĐÚNG MỘT chỗ trong ô, nên
   * ô phải nhường qua nhường lại: lúc nghỉ chỗ đó là của nhãn, lúc focus nhãn
   * trôi lên viền và trả chỗ cho gợi ý.
   */
  it('lúc nghỉ ô KHÔNG khoe gợi ý — chỗ đó đang là của nhãn nổi', () => {
    render(<TableSearchForm {...PROPS} value={undefined} />);

    // Một dấu CÁCH chứ không phải rỗng: mẹo nhãn nổi đứng trên
    // `:placeholder-shown`, không có placeholder là nhãn kẹt trên viền.
    expect(screen.getByLabelText('Search bookings')).toHaveAttribute('placeholder', ' ');
  });

  it('focus vào ô thì gợi ý hiện ra, rời ô thì trả chỗ lại cho nhãn', async () => {
    const user = userEvent.setup();
    render(<TableSearchForm {...PROPS} value={undefined} />);
    const field = screen.getByLabelText('Search bookings');

    await user.click(field);
    expect(field).toHaveAttribute('placeholder', 'Code, name or email');

    await user.tab();
    expect(field).toHaveAttribute('placeholder', ' ');
  });

  it('điều hướng sang bộ lọc khác thì ô nhập theo URL, không giữ chữ cũ', () => {
    // Ô KHÔNG kiểm soát bằng state: `key` ép React dựng lại sau mỗi lần đổi
    // giá trị, nên ô luôn khớp URL mà không cần effect đồng bộ.
    const view = render(<TableSearchForm {...PROPS} value="ada" />);
    view.rerender(<TableSearchForm {...PROPS} value="grace" />);

    expect(screen.getByLabelText('Search bookings')).toHaveValue('grace');
  });
});
