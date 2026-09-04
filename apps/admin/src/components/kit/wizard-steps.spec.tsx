import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WizardSteps } from './wizard-steps';

/**
 * Thanh bước là KIT, nên test ở đây chỉ phủ luật của kit — cổng chặn nhảy cóc,
 * tên của tab, điều hướng bàn phím, và hình học suy từ số bước. Phần domain
 * (bốn bước của approve) có test riêng ở `decide-actions.spec.tsx`.
 */

const STEPS = [
  { id: 'one', title: 'One', icon: <span data-testid="icon-one" /> },
  { id: 'two', title: 'Two', icon: <span data-testid="icon-two" /> },
  { id: 'three', title: 'Three', icon: <span data-testid="icon-three" /> },
];

function renderBar(overrides: Partial<Parameters<typeof WizardSteps>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <WizardSteps
      steps={STEPS}
      active="one"
      reached={0}
      onSelect={onSelect}
      panelId="panel"
      {...overrides}
    />,
  );
  return { onSelect };
}

describe('WizardSteps', () => {
  it('mỗi tab mang TÊN là nhãn đang hiện, không phải một chuỗi khác', () => {
    // Nhãn nằm NGOÀI nút (chữ dưới vòng tròn), nên thiếu `aria-labelledby` là
    // thanh bước gồm toàn nút không tên với trình đọc màn hình.
    renderBar();

    expect(screen.getByRole('tab', { name: 'One' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Three' })).toBeInTheDocument();
  });

  it('bước xa hơn `reached` KHÔNG bấm được; bước đã tới thì bấm được', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderBar({ active: 'two', reached: 1 });

    expect(screen.getByRole('tab', { name: 'Three' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'One' }));
    expect(onSelect).toHaveBeenCalledWith('one');
  });

  it('`disabled` khoá cả thanh, kể cả bước đã đi qua', () => {
    // Dùng khi đang bắn lệnh: đổi bước giữa chừng là câu trả lời sắp về ghi
    // vào một ngữ cảnh không còn nữa.
    renderBar({ active: 'three', reached: 2, disabled: true });

    for (const name of ['One', 'Two', 'Three']) {
      expect(screen.getByRole('tab', { name })).toBeDisabled();
    }
  });

  it('roving tabindex: chỉ bước đang mở là điểm dừng Tab', () => {
    renderBar({ active: 'two', reached: 2 });

    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '-1');
  });

  it('mũi tên chạy focus giữa các bước CÒN MỞ, bỏ qua bước bị khoá', async () => {
    const user = userEvent.setup();
    renderBar({ active: 'one', reached: 1 });

    screen.getByRole('tab', { name: 'One' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();

    // 'Three' đang khoá nên vòng lại đầu chứ không dừng ở nó.
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();
  });

  it('hình học đường ray SUY TỪ số bước, không ghim cứng cho bốn bước', () => {
    // Bản gốc stepper-03 ghim 12.5% (= 50/4). Ba bước thì mép phải là 50/3.
    const { container } = render(
      <WizardSteps steps={STEPS} active="one" reached={0} onSelect={vi.fn()} panelId="panel" />,
    );
    const rail = container.querySelector('.bg-border');

    expect(rail).toHaveStyle({ left: `${50 / 3}%` });
  });

  it('mọi tab trỏ `aria-controls` về đúng vùng nội dung', () => {
    renderBar();

    for (const name of ['One', 'Two', 'Three']) {
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-controls', 'panel');
    }
  });
});
