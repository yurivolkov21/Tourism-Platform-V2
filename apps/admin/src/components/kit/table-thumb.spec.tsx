import { fireEvent, render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { TableThumb } from './table-thumb';

/**
 * Ô ảnh bìa 40px của hàng bảng (review RU5 — một khuôn cho bảng Tours và bảng Posts). Hai bảng
 * chỉ khác chữ của ô trống, nên chữ ấy do nơi dùng truyền vào.
 */
const URL = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_160/v1/tourism/x';

describe('TableThumb', () => {
  it('chưa có ảnh: ô giữ chỗ mang chữ của nơi dùng cho trình đọc màn hình, không có <img>', () => {
    const { container } = render(<TableThumb src={null} emptyLabel="No cover photo yet" />);

    expect(screen.getByText('No cover photo yet')).toHaveClass('sr-only');
    expect(container.querySelector('img')).toBeNull();
  });

  it('có ảnh: <img> 40px đúng URL đã thu nhỏ, alt rỗng — tên bản ghi nằm ngay cạnh', () => {
    const { container } = render(<TableThumb src={URL} emptyLabel="No image yet" />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', URL);
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('width', '40');
    expect(img).toHaveClass('size-10');
    expect(screen.queryByText('No image yet')).toBeNull();
  });

  it('ảnh hỏng: ô cùng cỡ có tên "Photo unavailable" thay cho ô trống câm', () => {
    const { container } = render(<TableThumb src={URL} emptyLabel="No image yet" />);

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(screen.getByRole('img', { name: messages.admin.table.photoUnavailable })).toHaveClass(
      'size-10',
    );
  });
});
