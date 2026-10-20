import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import AdminRouteError from './error';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// Review L1: `reset()` của Next 16 không tải lại dữ liệu server, nên lỗi từ layout gác (API
// không với tới) bấm "Try again" là hiện lại đúng lỗi cũ; `retry()` tải lại rồi mới dựng.
describe('error boundary của admin', () => {
  it('nút thử lại gọi retry, không gọi reset', async () => {
    const retry = vi.fn();
    const reset = vi.fn();
    render(<AdminRouteError error={new Error('x')} retry={retry} reset={reset} />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: messages.admin.errors.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  // Review A2: `buttonVariants` trần trên `Link` để `border-transparent` gốc thắng viền outline.
  it('link Sign in giữ viền nút outline', () => {
    render(<AdminRouteError error={new Error('x')} retry={vi.fn()} reset={vi.fn()} />);
    const signIn = screen.getByRole('link', { name: messages.admin.errors.signIn });
    expect(signIn).toHaveClass('border-border');
    expect(signIn).not.toHaveClass('border-transparent');
  });
});
