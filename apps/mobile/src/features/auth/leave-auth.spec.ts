import { type LeaveAuthNavigator, leaveAuthTo } from './leave-auth';

function fakeNav(canDismiss: boolean): jest.Mocked<LeaveAuthNavigator> {
  return {
    canDismiss: jest.fn(() => canDismiss),
    dismissTo: jest.fn(),
    navigate: jest.fn(),
  };
}

describe('leaveAuthTo', () => {
  it('modal còn trên stack: gỡ modal về đúng tour đang nằm dưới, không dựng tour mới', () => {
    const nav = fakeNav(true);
    leaveAuthTo(nav, '/tours/hoi-an');
    expect(nav.dismissTo).toHaveBeenCalledWith('/tours/hoi-an');
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('không ai ghi đường về: gỡ modal về Home', () => {
    const nav = fakeNav(true);
    leaveAuthTo(nav, null);
    expect(nav.dismissTo).toHaveBeenCalledWith('/');
  });

  // R2: callback OAuth trên Android đưa stack về (tabs) — không còn gì để gỡ.
  it('stack đã bị reset về tabs: đẩy đích lên trên tabs thay vì thay chỗ tabs', () => {
    const nav = fakeNav(false);
    leaveAuthTo(nav, '/tours/hoi-an');
    expect(nav.navigate).toHaveBeenCalledWith('/tours/hoi-an');
    expect(nav.dismissTo).not.toHaveBeenCalled();
  });
});
