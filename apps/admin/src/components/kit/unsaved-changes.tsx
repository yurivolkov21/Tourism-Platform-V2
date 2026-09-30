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
import { leaveTarget } from '@/lib/unsaved-changes';

/**
 * Hỏi lại trước khi rời một bước còn thay đổi chưa lưu (spec F17 §2i).
 *
 * Bọc CẢ khu làm việc (đầu trang, thanh bước, nội dung), không chỉ form: link rời
 * trang nằm ở thanh bước, ở nút Departures, ở link Next và Fix, ở nút Back và ở
 * sidebar — nên
 * provider nghe cú bấm ở `document`, pha CAPTURE, tức TRƯỚC `onClick` của
 * `next/link` (React gắn listener ở root, nằm dưới `document`). Chặn ở đó là
 * link không điều hướng; "Discard changes" thì tự `router.push` tới đúng đường.
 *
 * Rời hẳn trang (đóng tab, gõ địa chỉ, link ra ngoài) là việc của
 * `beforeunload`. Nút Back của trình duyệt không qua đường nào trong hai đường
 * này — giới hạn đã biết, ghi ở báo cáo bàn giao F17.
 */
const t = messages.admin.unsavedChanges;

const UnsavedContext = React.createContext<{ setDirty: (dirty: boolean) => void } | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dirty, setDirty] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!dirty) return;
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
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const context = React.useMemo(() => ({ setDirty }), []);

  function discard() {
    const href = pendingHref;
    setPendingHref(null);
    setDirty(false);
    if (href !== null) router.push(href);
  }

  return (
    <UnsavedContext.Provider value={context}>
      {children}
      <AlertDialog
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) setPendingHref(null);
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
