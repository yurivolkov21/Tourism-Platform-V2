import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StableLabel } from './stable-label';

/**
 * Nhãn giữ chỗ cho biến thể RỘNG NHẤT của nó (lượt thử tay F14, 23/09).
 *
 * Bối cảnh: nút đổi trạng thái của một hàng bảng mang hai nhãn luân phiên
 * ("Hide"/"Show", "Close"/"Reopen"), mỗi nhãn một bề rộng. Cụm nút canh phải,
 * nên hàng nào đang mang nhãn hẹp hơn thì mọi nút bên trái nó bị kéo lệch.
 * Chừa sẵn chỗ cho nhãn rộng nhất là cách để mọi hàng có cùng bề rộng mà không
 * phải đoán con số pixel.
 *
 * Phần phải ghim là trình đọc màn hình: nhãn giữ chỗ vô hình phải VẮNG MẶT với
 * nó, không thì một nút "Hide" bị đọc thành "Hide Show".
 */

describe('StableLabel', () => {
  it('hiện đúng nhãn hiện tại', () => {
    render(<StableLabel label="Hide" reserve={['Hide', 'Show']} />);

    const visible = screen.getByText('Hide');
    expect(visible).not.toHaveAttribute('aria-hidden');
  });

  it('nhãn giữ chỗ VẮNG MẶT với trình đọc màn hình', () => {
    render(<StableLabel label="Hide" reserve={['Hide', 'Show']} />);

    // Không `aria-hidden` thì nút "Hide" bị đọc thành "Hide Show".
    expect(screen.getByText('Show')).toHaveAttribute('aria-hidden', 'true');
  });

  it('không lặp lại chính nhãn hiện tại trong phần giữ chỗ', () => {
    const { container } = render(<StableLabel label="Show" reserve={['Hide', 'Show']} />);

    // Một nhãn thấy được và đúng MỘT nhãn giữ chỗ — không phải hai.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(screen.getAllByText('Show')).toHaveLength(1);
  });

  it('nhãn hiện tại không nằm trong danh sách giữ chỗ vẫn hiện bình thường', () => {
    // Phòng khi vùng quên liệt kê: nhãn vẫn hiện, chỉ là mất phần giữ chỗ cho nó.
    render(<StableLabel label="Archive" reserve={['Hide', 'Show']} />);

    expect(screen.getByText('Archive')).not.toHaveAttribute('aria-hidden');
  });
});
