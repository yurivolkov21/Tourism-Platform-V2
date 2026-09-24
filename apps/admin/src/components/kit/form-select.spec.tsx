import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormSelect } from './form-select';

/**
 * Ô chọn của form admin (lượt thử tay F15, 24/09) — cùng dáng dropdown với ô chọn
 * ở thanh công cụ và phân trang, thay cho `<select>` gốc của trình duyệt.
 */
const OPTIONS = [
  { value: 'Northern Vietnam', label: 'Northern Vietnam' },
  { value: 'Central Vietnam', label: 'Central Vietnam' },
  { value: 'Southern Vietnam', label: 'Southern Vietnam' },
];

function renderSelect(props: Partial<React.ComponentProps<typeof FormSelect>> = {}) {
  const onValueChange = vi.fn();
  render(
    <>
      <label htmlFor="region">Region</label>
      <FormSelect
        id="region"
        value=""
        options={OPTIONS}
        placeholder="Choose a region"
        onValueChange={onValueChange}
        {...props}
      />
    </>,
  );
  return { onValueChange, trigger: screen.getByRole('combobox', { name: 'Region' }) };
}

describe('FormSelect', () => {
  it('chưa chọn thì hiện câu giữ chỗ (giọng mờ), và nhãn của form gọi đúng tên ô', () => {
    const { trigger } = renderSelect();
    expect(trigger).toHaveTextContent('Choose a region');
    // Kit tô chữ mờ qua `data-placeholder` — Base UI chỉ gắn nó khi CHƯA có giá trị,
    // nên chuỗi rỗng phải được đổi thành null trước khi đưa xuống.
    expect(trigger).toHaveAttribute('data-placeholder');
  });

  it('có giá trị thì hiện NHÃN của mục đang chọn', () => {
    const { trigger } = renderSelect({
      value: 'southern',
      options: [
        { value: 'northern', label: 'Northern Vietnam' },
        { value: 'southern', label: 'Southern Vietnam' },
      ],
    });
    expect(trigger).toHaveTextContent('Southern Vietnam');
    expect(trigger).not.toHaveTextContent('southern');
  });

  it('mở ra đủ các mục theo đúng thứ tự, chọn một mục thì trả CHUỖI giá trị', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderSelect();

    await user.click(trigger);
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(OPTIONS.map((o) => o.label));
    await user.click(screen.getByRole('option', { name: 'Central Vietnam' }));

    expect(onValueChange).toHaveBeenCalledWith('Central Vietnam');
  });

  it('mang trạng thái lỗi và câu mô tả của FormField', () => {
    const { trigger } = renderSelect({ invalid: true, describedBy: 'region-error' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'region-error');
  });

  it('không lỗi thì KHÔNG mang aria-invalid', () => {
    const { trigger } = renderSelect({ invalid: false });
    expect(trigger).not.toHaveAttribute('aria-invalid');
  });

  it('disabled thì trigger khoá và bấm không mở được', async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect({ disabled: true });

    await user.click(trigger);

    expect(trigger).toHaveAttribute('data-disabled');
    // Chờ đủ một nhịp mở popup — kiểm ngay sau cú bấm là xanh giả (đo 24/09).
    await expect(screen.findByRole('option', {}, { timeout: 300 })).rejects.toThrow();
  });
});
