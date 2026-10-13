import { QueryClient } from '@tanstack/react-query';
import { loadGoogleSdk, signOutOfGoogle } from './google-native';
import { signOutAndClearCache } from './sign-out';

// ADR-0056 §2 bước 7: seam SDK Google gốc — test không chạm module native.
jest.mock('./google-native', () => ({
  loadGoogleSdk: jest.fn(() => null),
  signOutOfGoogle: jest.fn(async () => {}),
}));

function seededClient(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(['wishlist', 'list'], { items: [{ tourId: 't1' }] });
  return client;
}

describe('signOutAndClearCache', () => {
  // F8 (review 06/10): máy dùng chung — người đăng nhập SAU không được thấy
  // dù chỉ thoáng qua wishlist/booking của người trước.
  it('đăng xuất xong thì cache query rỗng', async () => {
    const client = seededClient();
    const signOut = jest.fn().mockResolvedValue(undefined);

    await signOutAndClearCache(signOut, client);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['wishlist', 'list'])).toBeUndefined();
  });

  it('signOut ném (mất mạng) vẫn xoá cache và không ném ra ngoài', async () => {
    const client = seededClient();
    const signOut = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(signOutAndClearCache(signOut, client)).resolves.toBeUndefined();
    expect(client.getQueryData(['wishlist', 'list'])).toBeUndefined();
  });

  it('query refetch về trong lúc signOut còn chạy cũng bị xoá', async () => {
    const client = new QueryClient();
    const signOut = jest.fn(async () => {
      // Mô phỏng một query đang bay về đúng lúc đăng xuất.
      client.setQueryData(['bookings', 'mine'], { items: ['NX-1'] });
    });

    await signOutAndClearCache(signOut, client);

    expect(client.getQueryData(['bookings', 'mine'])).toBeUndefined();
  });

  it('đăng xuất khỏi Google trên máy khi có module, để lần sau chọn được tài khoản khác', async () => {
    const sdk = { GoogleSignin: {}, statusCodes: {} };
    (loadGoogleSdk as jest.Mock).mockReturnValueOnce(sdk);

    await signOutAndClearCache(jest.fn().mockResolvedValue(undefined), new QueryClient());

    expect(signOutOfGoogle).toHaveBeenCalledWith(sdk);
  });

  it('nạp SDK Google hỏng cũng không chặn đăng xuất', async () => {
    (loadGoogleSdk as jest.Mock).mockImplementationOnce(() => {
      throw new Error('env missing');
    });
    const client = seededClient();
    const signOut = jest.fn().mockResolvedValue(undefined);

    await expect(signOutAndClearCache(signOut, client)).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['wishlist', 'list'])).toBeUndefined();
  });
});
