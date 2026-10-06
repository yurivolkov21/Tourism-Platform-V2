import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './form-field';

/**
 * Ô đứng cạnh một ô CAO hơn trong hàng nhiều cột (thử tay F17: "Base price" cạnh
 * hai ô có dòng gợi ý). Hàng lưới kéo ô thấp cao bằng ô cao; nếu lưới bên trong
 * chia phần dư cho các dòng của nó thì nhãn và ô nhập tụt xuống, lệch khỏi hai ô
 * bên cạnh. jsdom không đo bố cục, nên test canh đúng lớp giữ luật ấy.
 */
describe('FormField', () => {
  it('các dòng của ô xếp sát mép trên, không giãn theo ô bên cạnh', () => {
    render(
      <FormField id="price" label="Base price">
        {(describedBy) => <input id="price" aria-describedby={describedBy} />}
      </FormField>,
    );

    expect(screen.getByText('Base price').parentElement).toHaveClass('content-start');
  });

  it('ô co được hẹp hơn chữ bên trong, không đẩy cột lưới của form rộng ra', () => {
    // Đo Task 19 ở hộp New tour: một `Picker` mang tên danh mục dài làm ô nở theo chữ và đè
    // lên ô bên cạnh. Phần tử lưới mặc định không co dưới bề rộng nội dung (`min-width: auto`).
    render(
      <FormField id="category" label="Category">
        {(describedBy) => <input id="category" aria-describedby={describedBy} />}
      </FormField>,
    );

    expect(screen.getByText('Category').parentElement).toHaveClass('min-w-0');
  });
});
