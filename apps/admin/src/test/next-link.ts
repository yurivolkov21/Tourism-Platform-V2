import * as React from 'react';

/**
 * `next/link` giả cho test DOM, giữ ĐÚNG hợp đồng bấm của bản thật (Next 16,
 * `next/dist/client/app-dir/link.js`): gọi `onClick` của nơi dùng trước, `defaultPrevented` thì
 * thôi; bấm kèm phím (Ctrl/Cmd/Shift/Alt — `isModifiedEvent` của bản thật) thì nhường hẳn cho
 * trình duyệt mở tab/cửa sổ mới: không chặn, không điều hướng phía client; còn lại chặn hành vi
 * mặc định của thẻ, gọi `onNavigate` (chỉ chạy khi điều hướng phía client THẬT SỰ bắt đầu —
 * `preventDefault` trong đó là huỷ điều hướng) rồi điều hướng phía client. Bản thật không có
 * router trong jsdom nên để thẻ tự điều hướng, và jsdom báo "Not implemented: navigation".
 *
 * Ca bấm kèm phím vì thế để hành vi mặc định của thẻ lại cho jsdom: test nào bấm kiểu ấy tự chặn
 * nó ở `document` (đứng thay việc trình duyệt mở tab mới mà không đổi trang đang xem).
 *
 * Dùng: `vi.mock('next/link', async () => (await import('@/test/next-link')).nextLinkMock(navigate))`.
 */
export function nextLinkMock(navigate: (href: string) => void) {
  function Link({
    href,
    onClick,
    onNavigate,
    ...rest
  }: React.ComponentProps<'a'> & {
    href: string;
    onNavigate?: (event: { preventDefault: () => void }) => void;
  }) {
    return React.createElement('a', {
      ...rest,
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        let cancelled = false;
        onNavigate?.({
          preventDefault: () => {
            cancelled = true;
          },
        });
        if (cancelled) return;
        navigate(href);
      },
    });
  }
  return { default: Link };
}
