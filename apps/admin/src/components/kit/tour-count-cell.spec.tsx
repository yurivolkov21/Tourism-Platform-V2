import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TourCountCell } from './tour-count-cell';

/** Ô Tours của bảng danh mục và điểm đến (spec 2026-10-05 §3.3). */
describe('TourCountCell', () => {
  it('có tour: tổng là dòng chính, số đang bán là dòng mờ', () => {
    render(<TourCountCell total={5} totalLabel="5 tours" publishedLabel="3 published" />);
    expect(screen.getByText('5 tours')).toBeInTheDocument();
    expect(screen.getByText('3 published')).toHaveClass('text-muted-foreground');
  });

  it('0 tour: một chữ mờ, không có dòng thứ hai', () => {
    render(<TourCountCell total={0} totalLabel="No tours" publishedLabel={null} />);
    expect(screen.getByText('No tours')).toHaveClass('text-muted-foreground');
  });
});
