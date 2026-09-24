import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_TOUR_FILTERS } from '@/lib/tours';
import { type FacetCounts, ToursFilters } from './tours-filters';

// Vòng review F15: id của ô tích là `facet-<slug>`, không kèm tên facet. Một
// danh mục và một điểm đến cùng slug (seed có danh mục `cruise`; admin tạo được
// điểm đến trùng slug ấy, hoặc gõ `?destinations=cruise`) sinh hai phần tử cùng
// id, và `<label htmlFor>` trỏ vào phần tử ĐẦU trong DOM — bấm dòng điểm đến
// lại bật bộ lọc danh mục.
const COUNTS: FacetCounts = {
  categories: { cruise: 2 },
  destinations: { cruise: 1 },
  durations: {},
  prices: {},
  difficulties: {},
  featured: 0,
};

function renderFilters(onToggle = vi.fn()) {
  render(
    <ToursFilters
      value={EMPTY_TOUR_FILTERS}
      counts={COUNTS}
      onToggle={onToggle}
      onToggleFeatured={vi.fn()}
      categoryOptions={[{ slug: 'cruise', name: 'Cruises' }]}
      destinationOptions={[{ slug: 'cruise', name: 'Cruise Port' }]}
    />,
  );
  return onToggle;
}

describe('ToursFilters — một slug có ở cả hai facet', () => {
  it('bấm vào CHỮ ở dòng điểm đến bật đúng facet điểm đến', async () => {
    const user = userEvent.setup();
    const onToggle = renderFilters();

    await user.click(screen.getByText('Cruise Port'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('destinations', 'cruise');
  });

  it('bấm vào CHỮ ở dòng danh mục bật đúng facet danh mục', async () => {
    const user = userEvent.setup();
    const onToggle = renderFilters();

    await user.click(screen.getByText('Cruises'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('categories', 'cruise');
  });
});
