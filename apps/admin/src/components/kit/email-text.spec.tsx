import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmailText } from './email-text';

/** Email xuống dòng ở chỗ hợp lý (spec 2026-10-05 §4 #7). */
describe('EmailText', () => {
  it('chữ giữ nguyên, có một cơ hội xuống dòng ngay sau @', () => {
    const { container } = render(<EmailText email="linh.nguyen@gmail.com" />);
    expect(container.textContent).toBe('linh.nguyen@gmail.com');
    expect(container.innerHTML).toBe('linh.nguyen@<wbr>gmail.com');
  });

  it('chuỗi không có @ ở giữa thì in nguyên', () => {
    const { container } = render(<EmailText email="@nowhere" />);
    expect(container.innerHTML).toBe('@nowhere');
  });
});
