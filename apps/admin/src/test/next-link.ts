import * as React from 'react';

/**
 * `next/link` giả cho test DOM, giữ ĐÚNG hợp đồng bấm của bản thật (Next 16,
 * `next/dist/client/app-dir/link.js`): gọi `onClick` của nơi dùng trước, `defaultPrevented` thì
 * thôi, còn lại chặn hành vi mặc định của thẻ rồi điều hướng phía client. Bản thật không có router
 * trong jsdom nên để thẻ tự điều hướng, và jsdom báo "Not implemented: navigation". Ca bấm kèm phím
 * (mở tab mới) của bản thật không chép.
 *
 * Dùng: `vi.mock('next/link', async () => (await import('@/test/next-link')).nextLinkMock(navigate))`.
 */
export function nextLinkMock(navigate: (href: string) => void) {
  function Link({ href, onClick, ...rest }: React.ComponentProps<'a'> & { href: string }) {
    return React.createElement('a', {
      ...rest,
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        navigate(href);
      },
    });
  }
  return { default: Link };
}
