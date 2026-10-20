'use client';

import { messages } from '@tourism/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@tourism/ui/components/alert-dialog';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { clearCreateRequest } from '@/lib/quick-create';
import { blocksTraverse, leaveTarget } from '@/lib/unsaved-changes';

/**
 * Hỏi lại trước khi rời một bước còn thay đổi chưa lưu (spec F17 §2i).
 *
 * Bọc CẢ khu làm việc (đầu trang, thanh bước, nội dung), không chỉ form: link rời
 * trang nằm ở thanh bước, ở nút Departures, ở link Next và Fix, ở nút Back và ở
 * sidebar — nên provider nghe cú bấm ở `document`, pha CAPTURE, tức TRƯỚC pha bubble
 * nơi React chạy mọi `onClick` (gốc React của App Router chính là `document`).
 *
 * Ở đó nó CHỈ `preventDefault`: `next/link` thấy `defaultPrevented` thì không điều
 * hướng (`next/dist/client/app-dir/link.js`), thẻ `<a>` trần thì mất hành vi mặc định.
 * Đừng `stopPropagation` (review AL5): nó nuốt luôn mọi `onClick` khác của cú bấm, kể
 * cả lượt đóng menu của mục Quick Create — menu còn mở, nổi trên hộp hỏi và vẫn bấm
 * được. "Discard changes" thì tự `router.push` tới đúng đường.
 *
 * Rời hẳn trang (đóng tab, gõ địa chỉ, link ra ngoài) là việc của
 * `beforeunload`.
 *
 * Nút Back, Forward và menu giữ chuột của trình duyệt (G7) không bấm vào link nào và, giữa
 * các trang của app, cũng không rời tài liệu nên `beforeunload` không bắn. Provider nghe sự
 * kiện `navigate` của Navigation API và HUỶ lượt đi trong lịch sử, rồi hỏi; "Discard changes"
 * đi tiếp đúng mục ấy bằng `navigation.traverseTo`. Huỷ trước khi trình duyệt kịp đổi mục nên
 * không có `popstate`: router của Next (nghe `popstate`, không nghe `navigate`) không biết gì,
 * trang không nhảy cuộn, lịch sử không thêm mục nào. Đo trên Chromium 141 (13/10): trình duyệt
 * chỉ cho huỷ khi trang có tương tác từ lần huỷ trước — luật chống bẫy nút Back — nên bấm Back
 * hai lần liền mà không chạm trang thì lần sau đi luôn. Trình duyệt chưa có Navigation API hay
 * không cho huỷ thì Back đi như trước G7.
 *
 * Không dùng cách đẩy thêm một mục lịch sử cùng URL làm "lưới" rồi bắt `popstate`: đo trên
 * Chromium, listener `popstate` ở `window` chạy theo thứ tự gắn kể cả khi gắn ở pha capture,
 * nên router của Next (gắn từ lúc app khởi động) luôn chạy trước; còn trình duyệt khôi phục vị
 * trí cuộn của mục cũ khiến trang nhảy.
 *
 * Thao tác rời trang không phải link, như Sign out, thì tự hỏi qua `requestLeave`.
 */
const t = messages.admin.unsavedChanges;

const UnsavedContext = React.createContext<{ setDirty: (dirty: boolean) => void } | null>(null);

/**
 * Sự kiện huỷ được mà `requestLeave` phát ở `window`. Sự kiện chứ không context: nơi gọi nằm
 * NGOÀI provider (Sign out ở sidebar của shell, còn provider bọc khu làm việc bên trong trang).
 */
const LEAVE_REQUEST = 'admin:request-leave';

/**
 * Hỏi trước một thao tác rời trang không đi qua link (review A2-17: Sign out). Không provider nào
 * còn thay đổi chưa lưu thì `proceed` chạy ngay; còn thì hộp hỏi mở, và chỉ "Discard changes"
 * mới chạy nó.
 */
export function requestLeave(proceed: () => void): void {
  const request = new CustomEvent<() => void>(LEAVE_REQUEST, { cancelable: true, detail: proceed });
  if (window.dispatchEvent(request)) proceed();
}

/**
 * Lượt rời trang đang chờ người dùng quyết: một link vừa bị chặn, một lượt Back/Forward vừa bị
 * huỷ (G7), hoặc một thao tác xin qua `requestLeave`.
 */
type PendingLeave =
  | { kind: 'link'; href: string }
  | { kind: 'traverse'; key: string }
  | { kind: 'action'; proceed: () => void };

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dirty, setDirty] = React.useState(false);
  const [pending, setPending] = React.useState<PendingLeave | null>(null);
  /**
   * Khoá của mục lịch sử mà "Discard changes" đang đi tới. `navigate` của chính lượt đó có thể
   * bắn khi listener còn gắn — huỷ nó là hộp hỏi mở lại mãi, Discard không bao giờ đi được.
   */
  const leavingTo = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!dirty) return;
    leavingTo.current = null;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Trình duyệt cũ chỉ hỏi khi `returnValue` được đặt.
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      const href = leaveTarget({
        dirty: true,
        defaultPrevented: event.defaultPrevented,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        anchor: anchor
          ? {
              href: anchor.href,
              target: anchor.target,
              hasDownload: anchor.hasAttribute('download'),
            }
          : null,
        current: window.location.href,
      });
      if (href === null) return;
      // CHỈ `preventDefault`, không `stopPropagation` (review AL5) — lý do ở JSDoc đầu file.
      event.preventDefault();
      setPending({ kind: 'link', href });
    };
    const onNavigate = (event: NavigateEvent) => {
      if (event.navigationType === 'traverse' && event.destination.key === leavingTo.current) {
        leavingTo.current = null;
        return;
      }
      const blocked = blocksTraverse({
        dirty: true,
        navigationType: event.navigationType,
        cancelable: event.cancelable,
        destination: event.destination.url,
        current: window.location.href,
      });
      if (!blocked) return;
      event.preventDefault();
      setPending({ kind: 'traverse', key: event.destination.key });
    };
    const onLeaveRequest = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      event.preventDefault();
      setPending({ kind: 'action', proceed: event.detail });
    };
    // jsdom và trình duyệt chưa có Navigation API: không có `window.navigation` — Back đi như cũ.
    const navigation = 'navigation' in window ? window.navigation : null;
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener(LEAVE_REQUEST, onLeaveRequest);
    document.addEventListener('click', onClick, true);
    navigation?.addEventListener('navigate', onNavigate);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener(LEAVE_REQUEST, onLeaveRequest);
      document.removeEventListener('click', onClick, true);
      navigation?.removeEventListener('navigate', onNavigate);
    };
  }, [dirty]);

  const context = React.useMemo(() => ({ setDirty }), []);

  function discard() {
    const leave = pending;
    setPending(null);
    setDirty(false);
    if (leave === null) return;
    if (leave.kind === 'link') {
      router.push(leave.href);
      return;
    }
    if (leave.kind === 'action') {
      leave.proceed();
      return;
    }
    leavingTo.current = leave.key;
    const { committed, finished } = window.navigation.traverseTo(leave.key);
    // Mục đích có thể đã rời lịch sử trong lúc hộp mở (hiếm): ở lại, đừng để lời hứa bị từ chối
    // trôi thành lỗi không ai bắt.
    committed?.catch(() => {});
    finished?.catch(() => {});
  }

  return (
    <UnsavedContext.Provider value={context}>
      {children}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          // Đóng mà không qua "Discard changes" (nút đó là Button thường, đóng hộp bằng prop chứ
          // không qua đây) là ở lại: bỏ luôn yêu cầu tạo của cú bấm Quick Create vừa bị chặn.
          // Lượt Back đã bị huỷ từ đầu nên ở lại không cần trả gì về lịch sử.
          if (!open) {
            setPending(null);
            clearCreateRequest();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.keep}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              {t.discard}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedContext.Provider>
  );
}

/** Form báo "đang có thay đổi chưa lưu"; gỡ khỏi trang thì tự rút. Ngoài provider thì không làm gì. */
export function useReportUnsaved(dirty: boolean): void {
  const context = React.useContext(UnsavedContext);
  React.useEffect(() => {
    context?.setDirty(dirty);
    return () => context?.setDirty(false);
  }, [context, dirty]);
}
