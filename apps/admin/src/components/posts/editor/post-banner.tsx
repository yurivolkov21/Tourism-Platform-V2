'use client';

import type { PostReadinessItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { CircleAlertIcon } from 'lucide-react';

/**
 * Dải báo của một lần Save hỏng (spec P4e-4 §4.4) — cùng dáng `FormBanner` của khu sửa tour:
 * giọng cảnh báo cho phiên bản cũ và cho "chưa đủ để đăng", đỏ cho lỗi. Mục thiếu là link
 * tới đúng ô của nó.
 */
const t = messages.admin.posts.editor;

export type PostBannerState =
  | { kind: 'stale' }
  | { kind: 'notReady'; missing: readonly PostReadinessItem[] }
  | { kind: 'error'; message: string; uncertain: boolean };

/** Đích của từng mục thiếu — `id` của ô tương ứng trên trang. */
const FIELD_ANCHOR: Record<PostReadinessItem, string> = {
  content: '#post-content',
  excerpt: '#post-excerpt',
  cover: '#post-cover',
};

export function PostBanner({
  banner,
  onReload,
}: {
  banner: PostBannerState;
  onReload: () => void;
}) {
  const reload = (
    <Button type="button" variant="outline" size="sm" onClick={onReload}>
      {t.banners.reload}
    </Button>
  );

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        banner.kind === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive-emphasis'
          : 'border-warning/50 bg-warning/10',
      )}
    >
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="grid flex-1 gap-2">
        {banner.kind === 'stale' ? (
          <>
            <p>{t.banners.stale}</p>
            <div>{reload}</div>
          </>
        ) : null}
        {banner.kind === 'notReady' ? (
          <>
            <p>{t.banners.notReady}</p>
            <ul className="grid list-disc gap-0.5 pl-4">
              {banner.missing.map((item) => (
                <li key={item}>
                  <a
                    href={FIELD_ANCHOR[item]}
                    className="underline underline-offset-4 hover:no-underline"
                  >
                    {t.publish.readiness[item]}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {banner.kind === 'error' ? (
          <>
            <p>{banner.message}</p>
            {banner.uncertain ? <div>{reload}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
