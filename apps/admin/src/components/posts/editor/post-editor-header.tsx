'use client';

import type { AdminPostDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ChevronLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import type { Ref } from 'react';
import { formatDateTime } from '@/lib/bookings-view';
import { POST_STATUS_VARIANT, POSTS_LIST_HREF, postStatusLabel } from '@/lib/posts-view';
import { postPageUrl } from '@/lib/site';

/**
 * Phần đầu trang sửa bài (spec P4e-4 §4.4) — cùng dáng phần đầu khu sửa tour: Back, tiêu đề,
 * chip trạng thái, View on site, lần lưu cuối. Đọc bản ĐÃ LƯU, không phải bản đang soạn: chip
 * "Published" không được sáng trước khi admin bấm Save.
 *
 * View on site chỉ hiện khi bài ĐÃ đăng — nháp và bài hẹn giờ mở ra là 404.
 */
const t = messages.admin.posts.editor;

export function PostEditorHeader({
  detail,
  headingRef,
}: {
  detail: AdminPostDetail;
  /**
   * Chỗ đáp của tiêu điểm khi dải báo chứa nút Reload tắt đi (vòng review P4e-4) — `tabIndex`
   * -1 để focus được bằng code mà không thành một điểm dừng Tab.
   */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={POSTS_LIST_HREF}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {t.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight focus:outline-none"
          >
            {detail.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            /blog/{detail.slug} · {t.lastSaved(formatDateTime(detail.version))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={POST_STATUS_VARIANT[detail.displayStatus]} className="h-7 px-2.5 text-sm">
            {postStatusLabel(detail.displayStatus)}
          </Badge>
          {detail.displayStatus === 'published' ? (
            <ButtonLink
              variant="outline"
              href={postPageUrl(detail.slug)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
              {t.viewOnSite}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
