import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolbarSelect } from './toolbar-select';

/** Select của hàng điều khiển (kit, vòng vá review F7) — nhãn ẩn + chọn ra chuỗi. */
const ITEMS = [
  { label: 'All types', value: 'ALL' },
  { label: 'Booking confirmation', value: 'BOOKING_CONFIRMATION' },
];

describe('ToolbarSelect', () => {
  it('có nhãn cho trình đọc màn hình và hiện giá trị đang chọn', () => {
    render(
      <ToolbarSelect id="t" label="Filter by type" value="ALL" items={ITEMS} onSelect={vi.fn()} />,
    );
    expect(screen.getByLabelText('Filter by type')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('All types');
  });

  it('chọn một mục → onSelect nhận CHUỖI value', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ToolbarSelect id="t" label="Filter by type" value="ALL" items={ITEMS} onSelect={onSelect} />,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Booking confirmation' }));
    expect(onSelect).toHaveBeenCalledWith('BOOKING_CONFIRMATION');
  });
});
