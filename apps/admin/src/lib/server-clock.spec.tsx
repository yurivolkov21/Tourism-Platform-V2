import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useServerClock } from './server-clock';

/**
 * Đồng hồ neo giờ server (vòng review P4e-4): mốc server cộng thời gian ĐƠN ĐIỆU đã trôi — đồng
 * hồ máy lệch không lọt vào; trang refresh mang mốc mới thì neo lại.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useServerClock', () => {
  it('mốc server cộng thời gian đơn điệu đã trôi; neo lại khi mốc đổi', () => {
    let mono = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => mono);
    const { result, rerender } = renderHook(({ iso }) => useServerClock(iso), {
      initialProps: { iso: '2026-10-02T12:00:00.000Z' },
    });

    mono += 90_000;
    expect(result.current().toISOString()).toBe('2026-10-02T12:01:30.000Z');

    rerender({ iso: '2026-10-02T15:00:00.000Z' });
    mono += 5_000;
    expect(result.current().toISOString()).toBe('2026-10-02T15:00:05.000Z');
  });
});
