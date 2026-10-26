import { act, renderHook } from '@testing-library/react-native';
import { usePullToRefresh } from './use-pull-to-refresh';

describe('usePullToRefresh', () => {
  it('bật refreshing trong lúc chờ, gọi MỌI hàm refetch, tắt khi xong', async () => {
    let finishA: () => void = () => {};
    const a = jest.fn(() => new Promise<void>((resolve) => (finishA = resolve)));
    const b = jest.fn(() => Promise.resolve());
    const { result } = await renderHook(() => usePullToRefresh([a, b]));

    expect(result.current.refreshing).toBe(false);
    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current.onRefresh();
    });
    expect(result.current.refreshing).toBe(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishA();
      await done;
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('một refetch lỗi vẫn tắt vòng quay, không ném ra ngoài', async () => {
    const failing = jest.fn(() => Promise.reject(new Error('mạng rớt')));
    const { result } = await renderHook(() => usePullToRefresh([failing]));

    await act(async () => {
      await result.current.onRefresh();
    });

    expect(result.current.refreshing).toBe(false);
  });
});
