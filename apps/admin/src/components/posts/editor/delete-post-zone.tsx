'use client';

import type { AdminPostDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { isUncertainOutcome } from '@/lib/api/write-error';
import { POSTS_LIST_HREF, postStatusLabel } from '@/lib/posts-view';
import {
  type DeletePostAction,
  type DeletePostContractCode,
  deletePostErrorCopy,
  isDeletePostStale,
} from '@/lib/posts-write';

/**
 * Vùng xoá bài ở cuối cột trái trang sửa (spec P4e-4 §2.7, §4.6). Xoá được mọi bài, qua kit
 * `ConfirmWriteDialog` giọng đỏ; câu thân hộp kể đúng từng thứ mất theo (đo trên
 * `admin-posts.service.ts` và `schema.prisma` — xem JSDoc của copy).
 *
 * Nằm NGOÀI `<form>` của trang (Quyết định 14). Lệnh mang phiên bản form ĐANG cầm: người
 * khác vừa lưu thì `STALE_POST` — ở lại và làm mới; bài đã rời DB (xoá xong, hay người khác
 * xoá trước) hoặc không rõ lệnh đã đi tới đâu thì về danh sách.
 */
const t = messages.admin.posts.delete;

export function DeletePostZone({
  detail,
  version,
  remove,
}: {
  detail: AdminPostDetail;
  /** Phiên bản form đang cầm — không phải `detail.version` của lần đọc đầu. */
  version: string;
  remove: DeletePostAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** Bài đã rời DB — về danh sách thay vì làm mới một trang sẽ 404. */
  const leave = useRef(false);

  return (
    <section
      aria-labelledby="post-delete-title"
      className="grid gap-3 rounded-lg border border-destructive/40 p-4"
    >
      <div className="grid gap-1">
        <h3 id="post-delete-title" className="text-base font-semibold">
          {t.title}
        </h3>
        <p className="text-sm text-muted-foreground">{t.body}</p>
      </div>
      <div>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          {t.action}
        </Button>
      </div>

      {open ? (
        <ConfirmWriteDialog<DeletePostContractCode>
          copy={{
            title: t.dialog.title,
            body: t.dialog.body,
            warning: t.dialog.warning,
            submit: t.dialog.submit,
            submitting: t.dialog.submitting,
            cancel: t.dialog.cancel,
          }}
          rows={[
            { label: t.rows.post, value: detail.title },
            { label: t.rows.status, value: postStatusLabel(detail.displayStatus) },
          ]}
          submitVariant="destructive"
          warningTone="destructive"
          isStale={isDeletePostStale}
          errorCopy={deletePostErrorCopy}
          onSubmit={async () => {
            // Lần bấm trước (lỗi thử-lại-được, hộp vẫn mở) không được quyết thay lần này.
            leave.current = false;
            const result = await remove({ id: detail.id, version });
            if (!result.ok) {
              // Bài đã rời DB — hoặc không rõ lệnh đã đi tới đâu (vòng review P4e-4): làm mới
              // trang này thì 404 nếu bài thật ra đã bị xoá, còn danh sách cho biết bài còn hay
              // mất. Chỉ `STALE_POST` là chắc bài còn đó.
              if (result.code === 'NOT_FOUND' || isUncertainOutcome(result.code)) {
                leave.current = true;
              }
              return { ok: false, code: result.code };
            }
            leave.current = true;
            return {
              ok: true,
              toast: { title: t.toast.title, description: t.toast.body(detail.title) },
            };
          }}
          onClose={() => setOpen(false)}
          onSettled={() => {
            if (leave.current) router.push(POSTS_LIST_HREF);
            else router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
