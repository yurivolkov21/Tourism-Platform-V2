import { render, screen } from '@testing-library/react';
import { aboutPage } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AboutNumbers } from './about-numbers';

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

/** Alpha (%) của màu chữ chính trong class; không có `text-foreground` thì tính là 0. */
function foregroundAlpha(className: string): number {
  const match = className.match(/(?:^|\s)text-foreground(?:\/(\d+))?(?:\s|$)/);
  return match ? Number(match[1] ?? 100) : 0;
}

describe('AboutNumbers — mô tả dưới số đủ tương phản', () => {
  // Review F3-14 (đo bằng axe): mô tả 12px dưới sáu con số dùng `text-foreground/40` trên nền tối
  // cố định của khối chỉ đạt 3.06:1, dưới mức 4.5:1. Đo lại trên trình duyệt theo cách của axe
  // (cùng cách đo ra 3.06:1 cho bản cũ), lúc thường rồi lúc rê chuột lên ô (`bg-muted/60`):
  // `text-muted-foreground` 6.23:1 nhưng chỉ 4.43:1 khi rê; `text-foreground/75` 6.87:1 và 5.20:1;
  // `text-foreground/80` (đang dùng) 7.61:1 và 5.67:1. Nên test chặn mọi màu dưới mức 75%.
  it('cả sáu mô tả dùng màu chữ chính với alpha không dưới 75%', () => {
    render(<AboutNumbers tours={[]} destinations={[]} failed={false} />);
    for (const stat of Object.values(aboutPage.numbers.stats)) {
      const description = screen.getByText(stat.description);
      expect(foregroundAlpha(description.className), description.className).toBeGreaterThanOrEqual(
        75,
      );
    }
  });
});
