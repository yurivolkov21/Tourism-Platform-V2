import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyCodeButton } from './copy-code-button';

describe('CopyCodeButton', () => {
  beforeEach(() => {
    // jsdom không có Clipboard API thật — mock writeText để đo lệnh gọi.
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ghi mã vào clipboard và đổi nhãn sang Copied trong 2 giây', async () => {
    render(<CopyCodeButton code="TRV-ABC123" />);

    const button = screen.getByRole('button', { name: /copy code/i });
    // fireEvent, không dùng userEvent: userEvent.click kết hợp fake timers dễ
    // treo (đợi real-timer polling nội bộ) — cùng lý do otp-form.spec.tsx.
    // act() bọc quanh: setState chạy sau `await` bên trong handler (sau khi
    // promise writeText resolve) nằm ngoài act ngầm của fireEvent, cần bọc
    // tay để React flush trước khi assert.
    await act(async () => {
      fireEvent.click(button);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TRV-ABC123');
    expect(screen.getByRole('button', { name: /^copied$/i })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
  });
});
