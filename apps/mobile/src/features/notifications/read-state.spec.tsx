import { act, renderHook, waitFor } from '@testing-library/react-native';
import { resetReadState, useReadState } from './read-state';

jest.mock('./read-store', () => ({
  loadReadIds: jest.fn(async () => new Set<string>(['saved-before'])),
  saveReadIds: jest.fn(async () => {}),
}));

const store = require('./read-store') as {
  loadReadIds: jest.Mock;
  saveReadIds: jest.Mock;
};

beforeEach(() => {
  resetReadState();
  store.saveReadIds.mockClear();
});

describe('useReadState — dùng chung giữa các nơi gọi', () => {
  it('đọc ở một nơi thì nơi khác (Home) thấy ngay, không giữ bản cũ', async () => {
    const home = await renderHook(() => useReadState('user-1'));
    const screen = await renderHook(() => useReadState('user-1'));
    await waitFor(() => expect(home.result.current.readIds.has('saved-before')).toBe(true));

    await act(async () => screen.result.current.markRead('payment_due:BK-1'));

    expect(home.result.current.readIds.has('payment_due:BK-1')).toBe(true);
    expect(screen.result.current.readIds.has('payment_due:BK-1')).toBe(true);
  });

  it('markAllRead đánh dấu cả danh sách ở mọi nơi và ghi xuống kho một lần', async () => {
    const a = await renderHook(() => useReadState('user-1'));
    const b = await renderHook(() => useReadState('user-1'));
    await waitFor(() => expect(a.result.current.readIds.has('saved-before')).toBe(true));
    store.saveReadIds.mockClear();

    await act(async () => a.result.current.markAllRead(['x', 'y']));

    expect(b.result.current.readIds).toEqual(new Set(['saved-before', 'x', 'y']));
    expect(store.saveReadIds).toHaveBeenCalledTimes(1);
  });

  it('đánh dấu lại id đã đọc thì không ghi thêm', async () => {
    const a = await renderHook(() => useReadState('user-1'));
    await waitFor(() => expect(a.result.current.readIds.has('saved-before')).toBe(true));
    store.saveReadIds.mockClear();

    await act(async () => a.result.current.markRead('saved-before'));

    expect(store.saveReadIds).not.toHaveBeenCalled();
  });

  it('chưa đăng nhập (userId null) → tập rỗng và markRead không làm gì', async () => {
    const guest = await renderHook(() => useReadState(null));
    await act(async () => guest.result.current.markRead('x'));

    expect(guest.result.current.readIds.size).toBe(0);
    expect(store.saveReadIds).not.toHaveBeenCalled();
  });

  it('đổi tài khoản thì không dính trạng thái đã đọc của tài khoản trước', async () => {
    const first = await renderHook(() => useReadState('user-1'));
    await waitFor(() => expect(first.result.current.readIds.has('saved-before')).toBe(true));
    await act(async () => first.result.current.markRead('only-user-1'));

    const second = await renderHook(() => useReadState('user-2'));
    await waitFor(() => expect(second.result.current.readIds.has('saved-before')).toBe(true));

    expect(second.result.current.readIds.has('only-user-1')).toBe(false);
  });
});
