import { act, render, screen } from '@testing-library/react';
import { PrintedAt } from '@tourism/ui/components/print-doc/printed-at';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PrintedAt — giờ in đóng dấu ở client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('đóng dấu giờ Việt Nam lúc mount và đóng lại lúc beforeprint', () => {
    vi.useFakeTimers({ now: new Date('2026-10-10T02:31:00Z'), toFake: ['Date'] });
    render(<PrintedAt prefix="Printed" timeZone="Asia/Ho_Chi_Minh" />);
    expect(screen.getByText('Printed 10 Oct 2026, 09:31')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-10-10T03:05:00Z'));
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.getByText('Printed 10 Oct 2026, 10:05')).toBeInTheDocument();
  });
});
