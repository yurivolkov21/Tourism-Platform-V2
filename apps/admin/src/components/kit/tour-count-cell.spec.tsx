import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TourCountCell } from './tour-count-cell';

/** Ô Tours của bảng danh mục và điểm đến (spec 2026-10-05 §3.3). */
describe('TourCountCell', () => {
  it('có tour: tổng là dòng chính, số đang bán là dòng mờ', () => {
    render(<TourCountCell totalLabel="5 tours" publishedLabel="3 published" />);
    expect(screen.getByText('5 tours')).not.toHaveClass('text-muted-foreground');
    expect(screen.getByText('3 published')).toHaveClass('text-muted-foreground');
  });

  it('không có dòng đang bán (0 tour): một chữ mờ — quyết theo `publishedLabel`, không prop đếm nào khác (review SI7)', () => {
    render(<TourCountCell totalLabel="No tours" publishedLabel={null} />);
    expect(screen.getByText('No tours')).toHaveClass('text-muted-foreground');
  });
});
