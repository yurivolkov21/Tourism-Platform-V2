import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { describe, expect, it } from 'vitest';
import { LabelValueRow } from './label-value-row';

/**
 * Hợp đồng của một dòng `dt/dd` dùng chung (tách 04/09 từ SÁU bản chép).
 * Không có logic nào ở đây ngoài hai trục biến thể, nên spec khoá đúng hai
 * trục đó cộng cái bất biến đã trả giá: cột giá trị phải ngắt được chuỗi dài.
 */

/** `<dl>` bọc ngoài — `dt`/`dd` chỉ hợp lệ bên trong một danh sách mô tả. */
function renderRow(ui: React.ReactElement) {
  return render(<dl>{ui}</dl>);
}

describe('LabelValueRow', () => {
  it('in nhãn và giá trị vào đúng dt/dd', () => {
    renderRow(<LabelValueRow label="Status" value="Paid" />);
    expect(screen.getByText('Status').tagName).toBe('DT');
    expect(screen.getByText('Paid').tagName).toBe('DD');
  });

  it('mặc định cột nhãn 8rem', () => {
    const { container } = renderRow(<LabelValueRow label="Status" value="Paid" />);
    expect(container.querySelector('.grid-cols-\\[8rem_minmax\\(0\\,1fr\\)\\]')).not.toBeNull();
  });

  it('đổi bề rộng cột nhãn qua biến thể khai sẵn, không phải chuỗi lúc chạy', () => {
    // Class phải TĨNH thì Tailwind mới quét thấy — một `grid-cols-[${w}]`
    // dựng lúc chạy sẽ không có CSS nào cả.
    const { container } = renderRow(<LabelValueRow label="Status" value="Paid" width="lg" />);
    expect(container.querySelector('.grid-cols-\\[10rem_minmax\\(0\\,1fr\\)\\]')).not.toBeNull();
  });

  it('cột giá trị LUÔN ngắt được chuỗi dài — bài học tràn chữ 03/09', () => {
    // `wrap-anywhere` trên `dd` VÀ `minmax(0,1fr)` cho cột: thiếu vế nào thì
    // một token không dấu cách cũng đẩy chữ ra ngoài mép panel.
    const { container } = renderRow(<LabelValueRow label="Payload" value={'a'.repeat(200)} />);
    expect(container.querySelector('dd')?.className).toContain('wrap-anywhere');
    expect(container.querySelector('.grid-cols-\\[8rem_minmax\\(0\\,1fr\\)\\]')).not.toBeNull();
  });

  it('nhãn chỉ ngắt dòng khi được bảo', () => {
    const plain = renderRow(<LabelValueRow label="Status" value="Paid" />);
    expect(plain.container.querySelector('dt')?.className).not.toContain('wrap-anywhere');

    const wrapped = renderRow(<LabelValueRow label="Data › Object › Id" value="evt_1" wrapLabel />);
    expect(wrapped.container.querySelector('dt')?.className).toContain('wrap-anywhere');
  });

  it('giá trị nhận ReactNode — consumer treo thêm phần của mình mà kit không mọc prop', () => {
    renderRow(
      <LabelValueRow
        label="Amount"
        value={
          <>
            {'$117.00'}
            <span data-testid="raw">11700</span>
          </>
        }
      />,
    );
    expect(screen.getByTestId('raw')).toBeInTheDocument();
    expect(screen.getByText(/117\.00/)).toBeInTheDocument();
  });
});
