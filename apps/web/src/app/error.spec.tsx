import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resilience } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import RouteError from './error';
import GlobalError from './global-error';

// Review L1 (kèm L3-19): `reset()` của Next 16 chỉ dựng lại cây con, KHÔNG tải lại dữ liệu
// server, nên lỗi phát từ Server Component (API ngủ, deploy) bấm "Try again" là hiện lại đúng
// lỗi cũ. `retry()` tải lại rồi mới dựng (docs `error.md` của next 16.3).
describe('error boundary của web', () => {
  it('error.tsx: nút thử lại gọi retry, không gọi reset', async () => {
    const retry = vi.fn();
    const reset = vi.fn();
    render(<RouteError error={new Error('x')} retry={retry} reset={reset} />);
    await userEvent.setup().click(screen.getByRole('button', { name: resilience.error.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it('global-error.tsx: nút thử lại gọi retry, không gọi reset', async () => {
    const retry = vi.fn();
    const reset = vi.fn();
    // Boundary này tự dựng <html>/<body>; React cảnh báo lồng trong <div> của RTL, không sao.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GlobalError error={new Error('x')} retry={retry} reset={reset} />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: resilience.globalError.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
