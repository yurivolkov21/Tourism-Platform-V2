'use client';

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
import { PublishToggle } from '@/components/tours/publish-toggle';
import { type TourStepVM, tourSteps } from '@/lib/tour-editor-view';
import type { DeleteTourAction } from '@/lib/tour-editor-write';
import type { SetPublishedAction } from '@/lib/tours-publish';
import { DeleteTourZone } from './delete-tour-zone';
import { StepColumns } from './editor-form-frame';
import { type ChecklistState, StateMark } from './step-aside';
import { STEP_ICONS } from './step-icons';
import { useWorkspaceDetail } from './tour-detail-context';

/**
 * Bước cuối Review & publish (ADR-0049 §3): danh sách kiểm tra từng bước, công tắc
 * On sale và vùng xoá tour — mọi việc quyết số phận tour ở một chỗ.
 *
 * Đọc bản MỚI NHẤT từ `TourDetailProvider` — đúng bản thanh bước đang đọc — và dựng
 * danh sách bằng CHÍNH `tourSteps` của thanh bước: hai chỗ không thể nói khác nhau.
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
  setPublished,
  remove,
}: {
  setPublished: SetPublishedAction;
  remove: DeleteTourAction;
}) {
  const detail = useWorkspaceDetail();
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
      <Card size="sm">
        <CardHeader>
          <CardTitle>{r.after.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid list-disc gap-1.5 pl-5 text-xs text-muted-foreground">
            {r.after.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
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
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          {r.fix}
                          <ChevronRightIcon aria-hidden="true" />
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Server là trọng tài thật của lệnh xoá (khoá ngoại `Restrict`); ở đây chỉ
              quyết có đưa nút ra hay không — như tab Details của F17. */}
          {detail.bookingCount === 0 ? (
            <DeleteTourZone detail={detail} remove={remove} />
          ) : (
            <section
              aria-labelledby="tour-delete-title"
              className="grid gap-1 rounded-lg border p-4"
            >
              <h3 id="tour-delete-title" className="text-base font-semibold">
                {r.deleteBlocked.title}
              </h3>
              <p className="text-sm text-muted-foreground">{r.deleteBlocked.body}</p>
            </section>
          )}
        </div>
      </StepColumns>
    </div>
  );
}
