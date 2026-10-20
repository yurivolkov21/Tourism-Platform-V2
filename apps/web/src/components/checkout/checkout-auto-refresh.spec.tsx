import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutAutoRefresh } from './checkout-auto-refresh';

const refresh = vi.fn();
// Cùng MỘT object mỗi lần render, như router thật — object mới mỗi lần sẽ làm
// effect chạy lại và đặt lại hẹn giờ.
const router = { refresh };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

/**
 * Tua đồng hồ giả theo từng giây, mỗi giây một `act`: hẹn giờ kế tiếp chỉ được
 * đặt SAU khi React render lại với `attempts` mới, nên tua một lèo qua nhiều
 * nhịp thì chỉ nhịp đầu nổ.
 */
async function advance(ms: number) {
  for (let left = ms; left > 0; left -= 1_000) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(1_000, left));
    });
  }
}

describe('CheckoutAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('phút đầu làm tươi mỗi 5 giây', async () => {
    render(<CheckoutAutoRefresh />);
    await advance(4_999);
    expect(refresh).not.toHaveBeenCalled();
    await advance(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(55_000);
    expect(refresh).toHaveBeenCalledTimes(12);
  });

  // Review L3 (20/10): trang hứa "This page updates automatically" nhưng bộ hẹn
  // giờ từng tắt hẳn sau 60 giây — webhook PayPal sandbox (hai lượt: APPROVED rồi
  // CAPTURE.COMPLETED) về chậm hơn thế là khách ngồi nhìn một trang đứng im.
  it('sau phút đầu vẫn làm tươi, thưa hơn (30 giây), và dừng hẳn ở mốc 10 phút', async () => {
    render(<CheckoutAutoRefresh />);
    await advance(60_000);
    expect(refresh).toHaveBeenCalledTimes(12);
    await advance(29_999);
    expect(refresh).toHaveBeenCalledTimes(12);
    await advance(1);
    expect(refresh).toHaveBeenCalledTimes(13);
    await advance(9 * 60_000 - 30_000);
    expect(refresh).toHaveBeenCalledTimes(30);
    await advance(30 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(30);
  });

  it('auto={false} không hẹn giờ nào', async () => {
    render(<CheckoutAutoRefresh auto={false} />);
    await advance(10 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
