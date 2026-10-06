import { QueryClient } from '@tanstack/react-query';
import { signOutAndClearCache } from './sign-out';

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
});
