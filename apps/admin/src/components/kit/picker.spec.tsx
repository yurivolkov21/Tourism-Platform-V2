import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Picker, type PickerProps } from './picker';

/**
 * Ô chọn chung của admin (spec 2026-10-05 §2.2): vẫn là Select của form — role combobox, gõ
 * chữ để nhảy — nhưng danh sách thả XUỐNG như menu lọc, có nhãn nhóm, vạch ngăn, icon và nhãn
 * phụ mờ. Thay `FormSelect` và `ToolbarSelect`; các ca dưới gom từ spec của hai kit cũ.
 */
const OPTIONS = [
  { value: 'Northern Vietnam', label: 'Northern Vietnam' },
  { value: 'Central Vietnam', label: 'Central Vietnam' },
  { value: 'Southern Vietnam', label: 'Southern Vietnam' },
];

function StubIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg data-testid="option-icon" {...props} />;
}

function renderPicker(props: Partial<PickerProps> = {}) {
  const onValueChange = vi.fn();
  const merged = {
    id: 'region',
    value: '',
    options: OPTIONS,
    placeholder: 'Choose a region',
    onValueChange,
    ...props,
  } as PickerProps;
  render(
    <>
      <label htmlFor="region">Region</label>
      <Picker {...merged} />
    </>,
  );
  return { onValueChange, trigger: screen.getByRole('combobox', { name: 'Region' }) };
}

describe('Picker', () => {
  it('chưa chọn thì hiện câu giữ chỗ, nhãn của form gọi đúng tên ô', () => {
    const { trigger } = renderPicker();
    expect(trigger).toHaveTextContent('Choose a region');
    expect(trigger).toHaveAttribute('data-placeholder');
  });

  it('có giá trị thì hiện NHÃN của mục đang chọn, không hiện giá trị thô', () => {
    const { trigger } = renderPicker({
      value: 'southern',
      options: [
        { value: 'northern', label: 'Northern Vietnam' },
        { value: 'southern', label: 'Southern Vietnam' },
      ],
    });
    expect(trigger).toHaveTextContent('Southern Vietnam');
    expect(trigger).not.toHaveTextContent('southern');
  });

  it('value lạ thì ô in chính value, không im lặng', () => {
    // Cùng luật "nút in chính value" của `ToolbarFilterMenu`: giá trị không khớp mục nào (mục
    // vừa bị gỡ khỏi danh sách, URL gõ tay) vẫn là giá trị form đang giữ. Hiện câu giữ chỗ là
    // nói dối rằng chưa chọn gì; chỉ `''` mới là chưa chọn.
    const { trigger } = renderPicker({ value: 'Western Vietnam' });
    expect(trigger).toHaveTextContent('Western Vietnam');
    expect(trigger).not.toHaveTextContent('Choose a region');
  });

  it('mở ra đủ các mục theo thứ tự; chọn một mục thì trả CHUỖI giá trị', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderPicker();

    await user.click(trigger);
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(OPTIONS.map((o) => o.label));
    await user.click(screen.getByRole('option', { name: 'Central Vietnam' }));

    expect(onValueChange).toHaveBeenCalledWith('Central Vietnam');
  });

  it('danh sách thả xuống dưới ô, không đè lên ô như Select cũ', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker();

    await user.click(trigger);
    await screen.findAllByRole('option');

    expect(document.querySelector('[data-slot="select-content"]')).toHaveAttribute(
      'data-align-trigger',
      'false',
    );
  });

  it('mang trạng thái lỗi và câu mô tả của FormField; không lỗi thì không có aria-invalid', () => {
    const { trigger } = renderPicker({ invalid: true, describedBy: 'region-error' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'region-error');
  });

  it('không lỗi thì KHÔNG mang aria-invalid', () => {
    const { trigger } = renderPicker({ invalid: false });
    expect(trigger).not.toHaveAttribute('aria-invalid');
  });

  it('disabled thì bấm không mở được', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({ disabled: true });

    await user.click(trigger);

    expect(trigger).toHaveAttribute('data-disabled');
    await expect(screen.findByRole('option', {}, { timeout: 300 })).rejects.toThrow();
  });

  it('nhóm: nhãn nhóm đặt tên cho nhóm, vạch ngăn giữa hai nhóm', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({
      options: undefined,
      groups: [
        { key: 'tour', options: [{ value: 'tour', label: 'This tour’s destinations' }] },
        {
          key: 'all',
          label: 'Destinations',
          options: [
            { value: 'd1', label: 'Hội An' },
            { value: 'd2', label: 'Hà Nội' },
          ],
        },
      ],
    } as Partial<PickerProps>);

    await user.click(trigger);
    const group = await screen.findByRole('group', { name: 'Destinations' });

    expect(
      within(group)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Hội An', 'Hà Nội']);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('hint: chữ mờ sau tên, có mặt cả trong danh sách lẫn trên ô', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({
      value: 'c4',
      options: [
        { value: 'c1', label: 'Day Tours' },
        { value: 'c4', label: 'Retired', hint: 'Hidden' },
      ],
    });

    expect(trigger).toHaveTextContent('Retired');
    expect(trigger).toHaveTextContent('Hidden');
    await user.click(trigger);
    expect(await screen.findByRole('option', { name: 'Retired Hidden' })).toBeInTheDocument();
  });

  it('tên dài trên ô: tên cắt "…", hint "Hidden" vẫn nằm trong ô, ô không nở theo chữ', () => {
    // Đo Task 19 ở hộp New tour: tên danh mục dài không cắt mà chạy ra khỏi ô 232px, đè lên ô
    // "Primary destination" bên cạnh. Ô (phần tử lưới của `FormField`) phải co được dưới bề
    // rộng chữ (`min-w-0`) thì `truncate` của tên mới có chỗ cắt; hint không được co theo.
    // jsdom không đo bố cục — canh đúng ba lớp ấy.
    const { trigger } = renderPicker({
      value: 'c4',
      options: [{ value: 'c4', label: 'An exceptionally long category name', hint: 'Hidden' }],
    });

    expect(trigger).toHaveClass('min-w-0');
    expect(within(trigger).getByText('An exceptionally long category name')).toHaveClass(
      'truncate',
    );
    expect(within(trigger).getByText('Hidden')).toHaveClass('shrink-0');
  });

  it('icon: hiện ở mục trong danh sách và trên ô của mục đang chọn', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({
      value: 'NEW',
      options: [
        { value: 'NEW', label: 'New', icon: StubIcon },
        { value: 'WON', label: 'Won', icon: StubIcon },
      ],
    });

    expect(within(trigger).getByTestId('option-icon')).toBeInTheDocument();
    await user.click(trigger);
    const option = await screen.findByRole('option', { name: 'Won' });
    expect(within(option).getByTestId('option-icon')).toBeInTheDocument();
  });

  it('toolbar: nhãn sr-only, cao 36px như nút lọc, popup rộng như menu lọc', async () => {
    const user = userEvent.setup();
    render(
      <Picker
        id="status"
        variant="toolbar"
        label="Filter by status"
        value="ALL"
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'NEW', label: 'New' },
        ]}
        onValueChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(trigger).toHaveClass('data-[size=default]:h-9');

    await user.click(trigger);
    await screen.findAllByRole('option');
    expect(document.querySelector('[data-slot="select-content"]')).toHaveClass('w-66');
  });
});
