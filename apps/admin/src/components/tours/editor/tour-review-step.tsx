'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { buttonVariants } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PublishToggle } from '@/components/tours/publish-toggle';
import { type TourStepVM, tourSteps } from '@/lib/tour-editor-view';
import type { DeleteTourAction } from '@/lib/tour-editor-write';
import type { SetPublishedAction } from '@/lib/tours-publish';
import { DeleteTourZone } from './delete-tour-zone';
import { StepColumns } from './editor-form-frame';
import { type ChecklistState, NoteCard, StateMark } from './step-aside';
import { STEP_ICONS } from './step-icons';
import { usePublishSavedDetail } from './tour-detail-context';

/**
 * Bước cuối Review & publish (ADR-0049 §3): danh sách kiểm tra từng bước, công tắc
 * On sale và vùng xoá tour — mọi việc quyết số phận tour ở một chỗ. Danh sách dựng bằng
 * CHÍNH `tourSteps` của thanh bước: hai chỗ không thể nói khác nhau.
 *
 * Đọc bản TRANG vừa đọc (`detail`), không phải bản layout đang giữ: chuyển bước phía
 * client thì layout không render lại, nên bản ấy có thể cũ — hộp xoá từng đếm sai số
 * chuyến sẽ mất theo (vòng review F19). Bản trang được đẩy lên `TourDetailProvider` để
 * phần đầu và thanh bước theo kịp; bật/tắt bán thành công cũng đẩy lên ngay. Ngoài
 * provider (layout không đọc được tour) việc đẩy là no-op, bước vẫn dựng được.
 *
 * Công tắc là `PublishToggle` của F11 với `placement="workspace"`: khoá CHIỀU BẬT khi
 * tour còn thiếu, gỡ bán không bao giờ khoá (ADR-0047 §4). Không truyền
 * `notReadyHref`: danh sách thiếu gì nằm ngay cạnh công tắc.
 */
const e = messages.admin.tours.editor;
const r = e.review;
const BLOCKED_NOTE_ID = 'tour-sale-blocked-note';

type ReviewRow = TourStepVM & { status: ChecklistState };

export function TourReviewStep({
  detail: loaded,
  setPublished,
  remove,
}: {
  detail: AdminTourDetail;
  setPublished: SetPublishedAction;
  remove: DeleteTourAction;
}) {
  const publish = usePublishSavedDetail();
  const [detail, setDetail] = useState(loaded);
  const [seen, setSeen] = useState(loaded);
  // Trang đọc lại (refresh sau một lệnh) → nhận bản mới, chỉnh state ngay trong render.
  if (loaded !== seen) {
    setSeen(loaded);
    setDetail(loaded);
  }
  useEffect(() => {
    publish(detail);
  }, [detail, publish]);

  const rows = tourSteps(detail).filter((step): step is ReviewRow => step.status !== 'final');
  const blocked = !detail.readiness.ready;
  const showBlockedNote = blocked && !detail.isPublished;

  const aside = (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{r.visibility.title}</CardTitle>
          <CardDescription>
            {detail.isPublished ? r.visibility.onSale : r.visibility.offSale}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="flex items-center gap-2">
            <PublishToggle
              tour={detail}
              setPublished={setPublished}
              blocked={blocked}
              describedBy={showBlockedNote ? BLOCKED_NOTE_ID : undefined}
              placement="workspace"
              onChanged={(isPublished) => setDetail((current) => ({ ...current, isPublished }))}
            />
            {/* Nhãn cho mắt; tên đọc-màn-hình của công tắc đã có "On sale — <tên>". */}
            <span aria-hidden="true" className="text-sm font-medium">
              {e.onSale}
            </span>
          </div>
          {showBlockedNote ? (
            <p id={BLOCKED_NOTE_ID} className="text-xs text-muted-foreground">
              {e.toggleBlocked}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{r.visibility.always}</p>
        </CardContent>
      </Card>
      <NoteCard title={r.after.title} items={r.after.items} />
    </>
  );

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <StepColumns aside={aside}>
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle id="tour-review-title">{r.title}</CardTitle>
              <CardDescription>{r.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul aria-labelledby="tour-review-title" className="grid">
                {rows.map((step) => {
                  const Icon = STEP_ICONS[step.step];
                  return (
                    <li
                      key={step.step}
                      className="flex flex-wrap items-center gap-3 border-t py-3 text-sm first:border-t-0 first:pt-0 last:pb-0"
                    >
                      <StateMark state={step.status} className="size-5" />
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="w-36 shrink-0 font-medium">{step.title}</span>
                      <span
                        className={cn(
                          'min-w-0 flex-1',
                          step.status === 'warn' ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {step.summary}
                      </span>
                      {step.fixHref ? (
                        <Link
                          href={step.fixHref}
                          aria-label={r.fixLabel(step.title)}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          {r.fix}
                          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Vùng xoá tự lo tour đã có booking (không nút, nói vì sao); server vẫn là
              trọng tài thật của lệnh xoá (khoá ngoại `Restrict`). */}
          <DeleteTourZone detail={detail} remove={remove} />
        </div>
      </StepColumns>
    </div>
  );
}
