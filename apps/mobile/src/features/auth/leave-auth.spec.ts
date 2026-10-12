import { renderHook } from '@testing-library/react-native';
import { type LeaveAuthNavigator, leaveAuthTo, useStillMounted } from './leave-auth';

function fakeNav(): jest.Mocked<LeaveAuthNavigator> {
  return {
    dismissTo: jest.fn(),
    navigate: jest.fn(),
  };
}

describe('leaveAuthTo', () => {
  it('màn auth còn trên stack: gỡ modal về đúng tour đang nằm dưới, không dựng tour mới', () => {
    const nav = fakeNav();
    leaveAuthTo(nav, '/tours/hoi-an', true);
    expect(nav.dismissTo).toHaveBeenCalledWith('/tours/hoi-an');
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  // Sign in mở từ onboarding là màn gốc duy nhất — vẫn phải `dismissTo` (tự
  // thay chỗ khi đích không có trong stack), KHÔNG được đẩy Home lên trên nó.
  it('không ai ghi đường về: gỡ modal về Home', () => {
    const nav = fakeNav();
    leaveAuthTo(nav, null, true);
    expect(nav.dismissTo).toHaveBeenCalledWith('/');
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  // R2: callback OAuth trên Android đưa stack về (tabs) — màn auth đã bị gỡ.
  it('màn auth đã bị gỡ trong lúc chờ: đẩy đích lên trên tabs thay vì thay chỗ tabs', () => {
    const nav = fakeNav();
    leaveAuthTo(nav, '/tours/hoi-an', false);
    expect(nav.navigate).toHaveBeenCalledWith('/tours/hoi-an');
    expect(nav.dismissTo).not.toHaveBeenCalled();
  });
});

describe('useStillMounted', () => {
  it('true khi màn còn mount, false sau khi unmount', async () => {
    const { result, unmount } = await renderHook(() => useStillMounted());
    const mounted = result.current;
    expect(mounted.current).toBe(true);
    await unmount();
    expect(mounted.current).toBe(false);
  });
});
