import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type DropdownOption, optionName } from './option-content';
import { Picker } from './picker';
import { ToolbarFilterMenu } from './toolbar-filter-menu';

/**
 * MỘT cách vẽ và MỘT cách đọc cho lựa chọn của mọi dropdown admin (review RU3/SI4). Trước đây
 * ô `Picker` và menu lọc `ToolbarFilterMenu` mỗi nơi tự vẽ dòng lựa chọn và đã trôi khỏi nhau:
 * Picker cắt "…" còn menu xuống dòng; trình đọc màn hình nghe "Retired Hidden" ở danh sách
 * nhưng "Retired (Hidden)" ở nút menu.
 */
const RETIRED: DropdownOption = { value: 'v:retired', label: 'Retired', hint: 'Hidden' };
const DAY: DropdownOption = { value: 'v:day', label: 'Day Tours' };
const SPOKEN = 'Retired (Hidden)';
const LONG_NAME = 'Mekong Delta and the Southern Floating Market Tours by Boat';

function renderPicker(value: string, options: DropdownOption[]) {
  render(
    <>
      <label htmlFor="category">Category</label>
      <Picker id="category" value={value} options={options} onValueChange={vi.fn()} />
    </>,
  );
  return screen.getByRole('combobox', { name: 'Category' });
}

function renderMenu(value: string, items: DropdownOption[]) {
  render(
    <ToolbarFilterMenu
      label="Filter by category"
      value={value}
      groups={[{ key: 'categories', items }]}
      onSelect={vi.fn()}
    />,
  );
  return screen.getByRole('button', { name: /Filter by category/ });
}

describe('dòng lựa chọn dùng chung', () => {
  it('tên đọc-màn-hình: kèm chữ phụ trong ngoặc; không có chữ phụ thì đúng tên', () => {
    expect(optionName(RETIRED)).toBe(SPOKEN);
    expect(optionName(DAY)).toBe('Day Tours');
  });

  it('Picker: mục có chữ phụ đọc "Retired (Hidden)" — trong danh sách lẫn trên ô', async () => {
    const user = userEvent.setup();
    const trigger = renderPicker(RETIRED.value, [DAY, RETIRED]);

    expect(within(trigger).getByText(SPOKEN)).toBeInTheDocument();
    await user.click(trigger);
    expect(await screen.findByRole('option', { name: SPOKEN })).toBeInTheDocument();
  });

  it('menu lọc: CÙNG tên ấy cho mục trong menu và cho nút đang lọc theo nó', async () => {
    const user = userEvent.setup();
    const button = renderMenu(RETIRED.value, [DAY, RETIRED]);

    expect(button).toHaveAccessibleName(`Filter by category: ${SPOKEN}`);
    await user.click(button);
    expect(await screen.findByRole('menuitemradio', { name: SPOKEN })).toBeInTheDocument();
  });

  it('mục không có chữ phụ đọc đúng tên, không thêm gì', async () => {
    const user = userEvent.setup();
    const trigger = renderPicker(DAY.value, [DAY, RETIRED]);

    await user.click(trigger);
    expect(await screen.findByRole('option', { name: 'Day Tours' })).toBeInTheDocument();
  });

  it('tên dài: menu lọc cắt "…" như Picker, không xuống dòng; chữ phụ không bị cắt', async () => {
    const user = userEvent.setup();
    const long: DropdownOption = { value: 'v:long', label: LONG_NAME, hint: 'Hidden' };
    const button = renderMenu(DAY.value, [DAY, long]);

    await user.click(button);
    const item = await screen.findByRole('menuitemradio', { name: optionName(long) });
    expect(within(item).getByText(LONG_NAME)).toHaveClass('truncate');
    expect(within(item).getByText('Hidden')).toHaveClass('shrink-0');
  });
});
