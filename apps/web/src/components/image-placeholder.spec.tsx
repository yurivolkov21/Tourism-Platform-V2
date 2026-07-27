import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImagePlaceholder } from './image-placeholder';

describe('ImagePlaceholder', () => {
  it('hiện nhãn mô tả khi được truyền', () => {
    render(<ImagePlaceholder label="Hạ Long bay at dawn" />);
    expect(screen.getByText('Hạ Long bay at dawn')).toBeInTheDocument();
  });

  it('không render nhãn nào khi không truyền label', () => {
    const { container } = render(<ImagePlaceholder />);
    expect(container.querySelector('span.text-xs')).toBeNull();
  });

  it('icon là trang trí — phải ẩn khỏi trình đọc màn hình', () => {
    const { container } = render(<ImagePlaceholder label="Sa Pa" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
