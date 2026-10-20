'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useCanAccess } from '@/components/admin-access-provider';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { TOURS_LIST_HREF } from '@/lib/departures-query';
import {
  type DeleteTourAction,
  type DeleteTourContractCode,
  deleteTourErrorCopy,
  isDeleteTourStale,
} from '@/lib/tour-editor-write';

/**
 * Vùng xoá tour ở bước Review & publish (spec F17 §2d, F19 §2d.6). Tour đã có booking thì
 * vùng vẫn hiện — cùng tiêu đề, không nút — kèm câu vì sao, và chỉ khuyên gỡ bán khi tour
 * còn đang bán (vòng review F19: trước đây bước Review chép lại khung này ở chỗ khác và
 * khuyên gỡ bán cả tour đã gỡ). Server là trọng tài thật: khoá ngoại `Restrict` của booking
 * chặn thì mã `TOUR_HAS_BOOKINGS` hiện NGAY TRONG hộp.
 *
 * Hộp là kit `ConfirmWriteDialog`, giọng đỏ: lệnh lấy đi hẳn thứ đang hiện ra
 * ngoài, và câu thân hộp kể đúng từng thứ mất theo (đo trên `schema.prisma`).
 * Nút mở hộp KHÔNG khoá — lượt làm mới duy nhất ở đây chạy SAU khi hộp đóng vì
 * `TOUR_HAS_BOOKINGS`, và kết cục của nó là gỡ luôn chính nút ấy.
 */
const t = messages.admin.tours.editor.delete;

export function DeleteTourZone({
  detail,
  remove,
}: {
  detail: AdminTourDetail;
  remove: DeleteTourAction;
}) {
  // Xoá tour là thủ tục chỉ Owner (ADR-0052): Staff không thấy vùng này.
  const mayDelete = useCanAccess('tours.delete');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /**
   * Hộp vừa nhận `TOUR_HAS_BOOKINGS` (review A2): booking tới sau lúc trang tải nên
   * `bookingCount` trong tay còn 0. Đóng hộp thì làm mới để vùng thành dạng "đã có booking",
   * không còn mời bấm lại để nhận đúng lỗi ấy. Không làm mới ngay lúc lỗi về: bản mới gỡ luôn
   * cái hộp đang hiện câu lỗi.
   */
  const bookedMeanwhile = useRef(false);

  if (!mayDelete) return null;

  if (detail.bookingCount > 0) {
    return (
      <section aria-labelledby="tour-delete-title" className="grid gap-1 rounded-lg border p-4">
        <h3 id="tour-delete-title" className="text-base font-semibold">
          {t.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {detail.isPublished ? `${t.blocked} ${t.blockedOnSale}` : t.blocked}
        </p>
      </section>
    );
  }

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
            { label: t.rows.photos, value: String(detail.photos.length) },
          ]}
          submitVariant="destructive"
          warningTone="destructive"
          isStale={isDeleteTourStale}
          errorCopy={deleteTourErrorCopy}
          onSubmit={async () => {
            const result = await remove({ id: detail.id });
            if (!result.ok) {
              if (result.code === 'TOUR_HAS_BOOKINGS') bookedMeanwhile.current = true;
              return { ok: false, code: result.code };
            }
            return {
              ok: true,
              toast: { title: t.toast.title, description: t.toast.body(detail.title) },
            };
          }}
          onClose={() => {
            setOpen(false);
            if (bookedMeanwhile.current) router.refresh();
          }}
          onSettled={() => router.push(TOURS_LIST_HREF)}
        />
      ) : null}
    </section>
  );
}
