import { act, renderHook } from '@testing-library/react-native';
import { formatCountdown, useCountdown } from './use-countdown';

// Đồng hồ giả cho CẢ file: đếm ngược thật thì mỗi test phải đợi đủ số giây.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useCountdown', () => {
  it('đếm ngược từng giây rồi dừng hẳn ở 0', async () => {
    const { result } = await renderHook(() => useCountdown(3));

    expect(result.current.remaining).toBe(3);

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.remaining).toBe(0);

    // Chạy tiếp cũng không âm — và không còn hẹn giờ nào treo lại.
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.remaining).toBe(0);
  });

  it('restart đưa về mốc đầu để bấm "gửi lại mã" đếm lại từ đầu', async () => {
    const { result } = await renderHook(() => useCountdown(60));

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.remaining).toBe(50);

    await act(async () => {
      result.current.restart();
    });
    expect(result.current.remaining).toBe(60);
  });
});

describe('formatCountdown', () => {
  it('giây luôn hai chữ số, phút không đệm', () => {
    expect(formatCountdown(42)).toBe('0:42');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('không bao giờ in số âm', () => {
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
