import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { OnThisPage } from './on-this-page';

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const ITEMS = [
  { id: 'booking', label: 'Booking', index: '01' },
  { id: 'payment', label: 'Payment', index: '02' },
];

describe('OnThisPage — số thứ tự đủ tương phản', () => {
  // Review F3-14 (đo bằng axe): số "01", "02" mang `opacity-60` chồng lên màu `muted-foreground` của link
  // chỉ còn 2.62:1 ở theme sáng và 3.35:1 ở theme tối, dưới mức 4.5:1 mà chữ 12px cần. Số phải
  // đi theo đúng màu của link (đo lại trên trình duyệt: 6.22:1 và 6.66:1 khi chưa chọn, 5.55:1
  // và 7.09:1 khi đang đọc), nên không được tự làm mờ thêm bằng opacity hay bằng màu pha alpha.
  it('số của mục đang đọc và của mục chưa chọn không bị làm mờ thêm', () => {
    render(<OnThisPage items={ITEMS} />);
    // Mục đầu là mục đang đọc lúc mở trang, mục sau là mục chưa chọn.
    for (const index of ['01', '02']) {
      expect(screen.getByText(index).className).not.toMatch(/(^|\s)opacity-|\/\d+(\s|$)/);
    }
  });
});
