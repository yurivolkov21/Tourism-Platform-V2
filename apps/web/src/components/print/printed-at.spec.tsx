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

  // Trình duyệt dựng bản in NGAY sau `beforeprint`: giờ phải lên DOM trong lúc phát sự kiện. Không
  // bọc `act` — act tự xả mọi cập nhật nên che mất đúng lỗi này (cập nhật hẹn sang task sau thì giấy
  // in giờ tải trang, ADR-0057 §3).
  it('beforeprint ghi giờ lên DOM ngay trong lúc phát sự kiện', () => {
    vi.useFakeTimers({ now: new Date('2026-10-10T02:31:00Z'), toFake: ['Date'] });
    render(<PrintedAt prefix="Printed" timeZone="Asia/Ho_Chi_Minh" />);
    vi.setSystemTime(new Date('2026-10-10T03:05:00Z'));
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      window.dispatchEvent(new Event('beforeprint'));
      expect(screen.getByText('Printed 10 Oct 2026, 10:05')).toBeInTheDocument();
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });
});
