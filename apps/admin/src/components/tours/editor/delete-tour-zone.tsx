'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { TOURS_LIST_HREF } from '@/lib/departures-query';
import {
  type DeleteTourAction,
  type DeleteTourContractCode,
  deleteTourErrorCopy,
  isDeleteTourStale,
} from '@/lib/tour-editor-write';

/**
 * Vùng xoá tour ở cuối tab Details (spec F17 §2d) — chỉ render khi tour chưa
 * từng có booking (nơi dùng quyết). Server là trọng tài thật: khoá ngoại
 * `Restrict` của booking chặn thì mã `TOUR_HAS_BOOKINGS` hiện NGAY TRONG hộp.
 *
 * Hộp là kit `ConfirmWriteDialog`, giọng đỏ: lệnh lấy đi hẳn thứ đang hiện ra
 * ngoài, và câu thân hộp kể đúng từng thứ mất theo (đo trên `schema.prisma`).
 * Nút mở hộp KHÔNG khoá — không có lượt làm mới nào chạy nền ở đây.
 */
const t = messages.admin.tours.editor.delete;

export function DeleteTourZone({
  detail,
  remove,
}: {
  detail: AdminTourDetail;
  remove: DeleteTourAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-labelledby="tour-delete-title"
      className="grid gap-3 rounded-lg border border-destructive/40 p-4"
    >
      <div className="grid gap-1">
        <h3 id="tour-delete-title" className="text-base font-semibold">
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
        <ConfirmWriteDialog<DeleteTourContractCode>
          copy={{
            title: t.dialog.title,
            body: t.dialog.body(detail.departureCount),
            warning: t.dialog.warning,
            submit: t.dialog.submit,
            submitting: t.dialog.submitting,
            cancel: t.dialog.cancel,
          }}
          rows={[
            { label: t.rows.tour, value: detail.title },
            { label: t.rows.departures, value: String(detail.departureCount) },
          ]}
          submitVariant="destructive"
          warningTone="destructive"
          isStale={isDeleteTourStale}
          errorCopy={deleteTourErrorCopy}
          onSubmit={async () => {
            const result = await remove({ id: detail.id });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: t.toast.title, description: t.toast.body(detail.title) },
            };
          }}
          onClose={() => setOpen(false)}
          onSettled={() => router.push(TOURS_LIST_HREF)}
        />
      ) : null}
    </section>
  );
}
