import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditButton, SettingsCard, SettingsRow } from './settings-card';

/**
 * Khung thẻ và dòng của Settings (spec 09/10 §2). jsdom không có bố cục: ở đây canh thứ tự DOM và
 * class đặt chỗ; bố cục thật đo bằng CSS build ở bước soi bố cục sau thi công.
 */
describe('SettingsCard', () => {
  it('tiêu đề h2 chữ serif kèm một dòng mô tả; thân là danh sách dòng', () => {
    render(
      <SettingsCard title="Password" description="Change the password you sign in with.">
        <SettingsRow label="Password" value="••••••••••" />
      </SettingsCard>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Password' })).toHaveClass('font-heading');
    expect(screen.getByText('Change the password you sign in with.')).toBeInTheDocument();
    expect(screen.getByRole('list')).toContainElement(screen.getByRole('listitem'));
  });
});

describe('SettingsRow', () => {
  const row = (editing = false) =>
    render(
      <ul>
        <SettingsRow
          label="Phone"
          hint="So the guide can reach you on the day."
          value="0901234567"
          action={<button type="button">Edit</button>}
          editing={editing}
        >
          <form aria-label="Edit phone" />
        </SettingsRow>
      </ul>,
    );

  it('đang xem: DOM theo thứ tự nhãn → giá trị → hành động; gợi ý nằm trong ô nhãn', () => {
    row();
    const cells = [...screen.getByRole('listitem').children];
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'PhoneSo the guide can reach you on the day.',
      '0901234567',
      'Edit',
    ]);
    expect(
      within(cells[0] as HTMLElement).getByText('So the guide can reach you on the day.'),
    ).toBeInTheDocument();
  });

  it('từ lg ba cột một hàng; dưới lg giá trị xuống hàng dưới, hành động lên cạnh nhãn', () => {
    row();
    const item = screen.getByRole('listitem');
    const [, value, action] = [...item.children];
    expect(item).toHaveClass(
      'grid-cols-[minmax(0,1fr)_auto]',
      'lg:grid-cols-[10rem_minmax(0,1fr)_auto]',
      'items-center',
    );
    expect(value).toHaveClass('col-span-full', 'row-2', 'lg:col-2', 'lg:row-1');
    expect(action).toHaveClass('col-2', 'row-1', 'lg:col-3');
    expect(item).not.toHaveClass('bg-primary/5');
  });

  it('đang sửa: nền nhạt, form THAY giá trị và hành động, nhãn chỉ hiện một lần', () => {
    row(true);
    const item = screen.getByRole('listitem');
    expect(item).toHaveClass('bg-primary/5', 'items-start');
    expect(screen.queryByText('0901234567')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Phone')).toHaveLength(1);
    expect(screen.getByRole('form', { name: 'Edit phone' }).parentElement).toHaveClass(
      'col-span-full',
      'lg:col-[2/-1]',
    );
  });
});

describe('EditButton', () => {
  it('chữ "Edit", tên đọc mang tên trường; bấm thì gọi onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EditButton field="Full name" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Edit Full name' });
    expect(button).toHaveTextContent('Edit');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
