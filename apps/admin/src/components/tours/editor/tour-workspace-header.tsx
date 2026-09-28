import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { PublishToggle } from '@/components/tours/publish-toggle';
import { TOURS_LIST_HREF } from '@/lib/departures-query';
import type { SetPublishedAction } from '@/lib/tours-publish';

/**
 * Phần đầu dùng chung của khu làm việc tour (spec F17 §2g): link về Tours, tên
 * tour, công tắc On sale.
 *
 * Công tắc dùng lại `PublishToggle` của F11 với `blocked` khi tour còn thiếu
 * (ADR-0047 §4) — chỉ khoá CHIỀU BẬT. `placement="workspace"`: bị chặn ở đây
 * nghĩa là trang đã cũ (refresh cho khung readiness nói thiếu gì), tour mất thì
 * về `/tours` (vòng review F17). Không truyền `notReadyHref`: khung readiness đã
 * nằm ngay dưới, không cần nút mở tour trong toast.
 */
const t = messages.admin.tours.editor;
const BLOCKED_NOTE_ID = 'tour-sale-blocked-note';

export function TourWorkspaceHeader({
  detail,
  setPublished,
}: {
  detail: AdminTourDetail;
  setPublished: SetPublishedAction;
}) {
  const blocked = !detail.readiness.ready;
  const showBlockedNote = blocked && !detail.isPublished;

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={TOURS_LIST_HREF}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {t.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{detail.title}</h2>
        <div className="grid justify-items-end gap-1">
          <div className="flex items-center gap-2">
            {/* Nhãn cho mắt; tên đọc-màn-hình của công tắc đã có "On sale — <tên>". */}
            <span aria-hidden="true" className="text-sm font-medium">
              {t.onSale}
            </span>
            <PublishToggle
              tour={detail}
              setPublished={setPublished}
              blocked={blocked}
              describedBy={showBlockedNote ? BLOCKED_NOTE_ID : undefined}
              placement="workspace"
            />
          </div>
          {showBlockedNote ? (
            <p id={BLOCKED_NOTE_ID} className="text-xs text-muted-foreground">
              {t.toggleBlocked}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
