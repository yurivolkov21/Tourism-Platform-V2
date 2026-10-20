import * as WebBrowser from 'expo-web-browser';
import { AppState, type AppStateStatus } from 'react-native';
import { openCheckout } from './open-checkout';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserResultType: { OPENED: 'opened', DISMISS: 'dismiss', CANCEL: 'cancel' },
}));

const open = WebBrowser.openBrowserAsync as jest.Mock;

// Bắt listener AppState để test tự phát sự kiện 'change' như khi khách rời/quay lại app.
let listeners: Array<(state: AppStateStatus) => void> = [];
const remove = jest.fn();
let addSpy: jest.SpyInstance;

beforeEach(() => {
  listeners = [];
  remove.mockClear();
  addSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => addSpy.mockRestore());

// Xả hết hàng đợi microtask — đủ để một promise "lẽ ra đã xong" kịp xong.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function emit(state: AppStateStatus) {
  for (const listener of listeners) listener(state);
}

describe('openCheckout', () => {
  it('iOS (trình duyệt đóng mới trả) → true ngay, không đợi AppState', async () => {
    open.mockResolvedValueOnce({ type: 'dismiss' });
    await expect(openCheckout('https://pay.example/s')).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith('https://pay.example/s');
    expect(remove).toHaveBeenCalled();
  });

  it('trình duyệt ném lỗi → false (không để lỗi bị nuốt im lặng)', async () => {
    open.mockRejectedValueOnce(new Error('no browser'));
    await expect(openCheckout('https://pay.example/s')).resolves.toBe(false);
    expect(remove).toHaveBeenCalled();
  });

  it('Android trả "opened" ngay khi Custom Tab bật → chỉ xong khi app quay lại active', async () => {
    open.mockResolvedValueOnce({ type: 'opened' });
    let settled = false;
    const result = openCheckout('https://pay.example/s').then((opened) => {
      settled = true;
      return opened;
    });

    await flush();
    expect(settled).toBe(false);

    // Custom Tab đẩy app xuống nền — chưa phải lúc khách quay về.
    emit('background');
    await flush();
    expect(settled).toBe(false);

    emit('active');
    await expect(result).resolves.toBe(true);
    expect(remove).toHaveBeenCalled();
  });
});
