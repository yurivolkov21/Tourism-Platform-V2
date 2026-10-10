import * as WebBrowser from 'expo-web-browser';
import { openCheckout } from './open-checkout';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const open = WebBrowser.openBrowserAsync as jest.Mock;

describe('openCheckout', () => {
  it('mở được → true', async () => {
    open.mockResolvedValueOnce({ type: 'dismiss' });
    await expect(openCheckout('https://pay.example/s')).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith('https://pay.example/s');
  });

  it('trình duyệt ném lỗi → false (không để lỗi bị nuốt im lặng)', async () => {
    open.mockRejectedValueOnce(new Error('no browser'));
    await expect(openCheckout('https://pay.example/s')).resolves.toBe(false);
  });
});
