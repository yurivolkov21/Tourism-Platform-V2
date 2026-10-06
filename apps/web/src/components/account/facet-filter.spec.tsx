import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FacetFilter, type FacetFilterOption } from './facet-filter';

/**
 * Nút lọc chọn nhiều của My bookings (spec P7 §7.2). Bố cục (cỡ cố định 176×36, viền gạch
 * đứt) không đo được bằng jsdom — Task A11 đo bằng CSS build thật.
 */
type When = 'ON_TOUR' | 'UPCOMING' | 'PAST';

const OPTIONS: FacetFilterOption<When>[] = [
  { value: 'ON_TOUR', label: 'On tour now', count: 0 },
  { value: 'UPCOMING', label: 'Upcoming', count: 1 },
  { value: 'PAST', label: 'Past trips', count: 12 },
];

function renderFilter(selected: When[] = []) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  render(
    <FacetFilter
      label="When"
      options={OPTIONS}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
    />,
  );
  return { onToggle, onClear };
}

describe('FacetFilter — nút', () => {
  it('chưa chọn gì: tên nút là nhãn trần', () => {
    renderFilter();
    expect(screen.getByRole('button', { name: 'When' })).toBeInTheDocument();
  });

  it('chọn một giá trị: nút bày nhãn giá trị, tên đọc "When: Upcoming"', () => {
    renderFilter(['UPCOMING']);
    const button = screen.getByRole('button', { name: 'When: Upcoming' });
    expect(within(button).getByText('Upcoming')).toBeInTheDocument();
  });

  it('chọn từ hai giá trị: "{n} selected"', () => {
    renderFilter(['UPCOMING', 'PAST']);
    const button = screen.getByRole('button', { name: 'When: 2 selected' });
    expect(within(button).getByText('2 selected')).toBeInTheDocument();
  });
});

describe('FacetFilter — menu', () => {
  it('mỗi dòng: ô tích, nhãn, số đếm — tên đọc kèm số đơn, số ít đúng', async () => {
    const user = userEvent.setup();
    renderFilter(['PAST']);
    await user.click(screen.getByRole('button', { name: 'When: Past trips' }));

    expect(await screen.findByRole('checkbox', { name: 'On tour now, 0 trips' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Upcoming, 1 trip' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Past trips, 12 trips' })).toBeChecked();
  });

  it('bấm ô tích gọi onToggle với giá trị của dòng, đúng một lần', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderFilter();
    await user.click(screen.getByRole('button', { name: 'When' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Upcoming, 1 trip' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('UPCOMING');
  });

  it('bấm vào CHỮ của dòng cũng tích được — cả hàng là vùng bấm', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderFilter();
    await user.click(screen.getByRole('button', { name: 'When' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByText('Past trips'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('PAST');
  });

  it('chưa chọn gì thì không có "Clear filters"', async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByRole('button', { name: 'When' }));
    await screen.findByRole('dialog');

    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('"Clear filters" gọi onClear rồi đóng menu', async () => {
    const user = userEvent.setup();
    const { onClear } = renderFilter(['PAST']);
    await user.click(screen.getByRole('button', { name: 'When: Past trips' }));
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
