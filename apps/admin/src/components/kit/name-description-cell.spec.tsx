import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NameDescriptionCell } from './name-description-cell';

/**
 * Ô "tên + mô tả" của bảng danh mục và bảng điểm đến (lượt thử tay F15, 24/09):
 * một mô tả dài từng kéo cột rộng gần 900px vì khối `truncate` không có trần bề
 * rộng. Ô này PHẢI giữ trần, gói mô tả tối đa hai dòng, và để nguyên văn trong
 * `title` cho người rê chuột.
 */
const LONG =
  'A working fishing port turned quiet beach town on the south-central coast, its Chăm towers and empty stretches of sand still ahead of the tourist trail.';

describe('NameDescriptionCell', () => {
  it('khung có trần bề rộng, tên một dòng', () => {
    render(<NameDescriptionCell name="Quy Nhơn" description={LONG} />);
    const name = screen.getByText('Quy Nhơn');
    expect(name).toHaveClass('truncate');
    expect(name.parentElement).toHaveClass('max-w-md');
  });

  it('mô tả gói tối đa hai dòng và giữ nguyên văn trong title', () => {
    render(<NameDescriptionCell name="Quy Nhơn" description={LONG} />);
    const description = screen.getByText(LONG);
    // Ô bảng của kit UI mặc `whitespace-nowrap` — thiếu `whitespace-normal` thì
    // `line-clamp-2` không bao giờ xuống dòng được.
    expect(description).toHaveClass('line-clamp-2', 'whitespace-normal');
    expect(description).toHaveAttribute('title', LONG);
  });
});
