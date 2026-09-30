'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import { FormField } from '@/components/kit/form-field';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { AsideJumpLink, StateMark } from '@/components/tours/editor/step-aside';
import { usePublishSavedDetail } from '@/components/tours/editor/tour-detail-context';
import { nextTourStep, projectedReadiness } from '@/lib/tour-editor-view';
import {
  hasNestedErrors,
  type ItineraryContractCode,
  type ItineraryDayDraft,
  type ItineraryFormErrors,
  type ItineraryFormValues,
  itineraryErrorCopy,
  itineraryFormValues,
  itineraryPayload,
  type SetItineraryAction,
  validateItineraryForm,
} from '@/lib/tour-editor-write';
import { useSectionSave } from '@/lib/use-section-save';
import { useTourFormState } from '@/lib/use-tour-form-state';

/**
 * Bước Itinerary (spec F17 §2h, F19 §2d.3): đủ N thẻ ngày (Day 1…N), mỗi thẻ một tiêu đề và
 * một mô tả. Cùng khuôn `TourDetailsForm`: `detail` đọc từ PROPS cho luật phụ
 * thuộc trạng thái server (đang bán?), state chỉ giữ giá trị các ô, bản gốc để so
 * "có thay đổi", và `version`.
 *
 * - Mỗi thẻ mang `id="day-N"` — đích của link "An itinerary for day N" ở bước
 *   Review và danh mục Days.
 * - Ngày chưa có tiêu đề thì không có hàng (spec §2b.3): tour tắt bán lưu dở
 *   được; tour đang bán thì ô tiêu đề nào cũng bắt buộc.
 * - Số thẻ theo `detail.durationDays`; đổi số ngày là việc của tab Details.
 */
const e = messages.admin.tours.editor;
const a = e.aside;
const t = e.itinerary;

export function TourItineraryForm({
  detail,
  save: saveAction,
}: {
  detail: AdminTourDetail;
  save: SetItineraryAction;
}) {
  const publishSaved = usePublishSavedDetail();
  const form = useTourFormState<ItineraryFormValues>(detail, itineraryFormValues);
  const { values, version, dirty, showValidation } = form;

  const errors: ItineraryFormErrors = showValidation ? validateItineraryForm(values, detail) : {};

  const { pending, banner, save } = useSectionSave<ItineraryContractCode>({
    copy: itineraryErrorCopy,
    slug: detail.slug,
    version,
    // Readiness NẾU lệnh này đi qua: chỉ ngày có tiêu đề mới thành hàng.
    projected: () =>
      projectedReadiness(detail, {
        itineraryDays: itineraryPayload(detail.id, version, values).days.map(
          (day) => day.dayNumber,
        ),
      }),
    onSaved: (next) => {
      form.adopt(next);
      // Phần đầu và thanh bước theo kịp ngay, không chờ lượt refresh.
      publishSaved(next);
    },
  });

  function patchDay(index: number, next: Partial<ItineraryDayDraft>) {
    form.setValues((current) => ({
      days: current.days.map((day, position) => (position === index ? { ...day, ...next } : day)),
    }));
  }

  function submit() {
    form.setShowValidation(true);
    if (hasNestedErrors(validateItineraryForm(values, detail))) return;
    void save(() => saveAction(itineraryPayload(detail.id, version, values)));
  }

  // Danh mục ngày đọc giá trị ĐANG SOẠN (ADR-0049 §6): ngày không tiêu đề thì không
  // thành hàng khi lưu (spec F17 §2b.3), nên nó là ngày còn thiếu.
  const aside = (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.itinerary.daysTitle}</CardTitle>
        <CardDescription>{a.itinerary.daysBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1">
          {values.days.map((day, index) => {
            const n = index + 1;
            const title = day.title.trim();
            return (
              <li key={n}>
                <AsideJumpLink
                  targetId={`day-${n}`}
                  label={
                    <span className="truncate">
                      {title === '' ? t.day(n) : `${t.day(n)} · ${title}`}
                    </span>
                  }
                  meta={<StateMark state={title === '' ? 'warn' : 'ok'} />}
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      {/* Câu giới thiệu trải hết bề ngang, trên hai cột. */}
      <p className="text-sm text-muted-foreground">{t.intro(detail.durationDays)}</p>
      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={banner}
        serverChanged={form.serverChanged}
        aside={aside}
        next={nextTourStep(detail.slug, 'itinerary')}
        onSubmit={submit}
        onReload={form.reload}
      >
        {values.days.map((day, index) => {
          const n = index + 1;
          const dayErrors = errors[n];
          const missing = day.title.trim() === '';
          return (
            // Thẻ ngày cố định theo vị trí (ngày thứ n) — không thêm/xoá/dời, nên
            // số ngày làm key là đúng. `role="group"` + tên "Day N": thẻ gom hai ô của
            // một ngày (Card của kit là <div>); `id="day-N"` là đích link readiness và
            // link nhảy ở cột phải — `tabIndex={-1}` để link ấy dời được tiêu điểm vào.
            <Card
              key={n}
              id={`day-${n}`}
              tabIndex={-1}
              role="group"
              aria-labelledby={`day-${n}-heading`}
              className={cn(missing && 'ring-warning/60')}
            >
              <CardHeader>
                <CardTitle id={`day-${n}-heading`}>{t.day(n)}</CardTitle>
                {missing ? (
                  <CardAction>
                    <Badge
                      variant="outline"
                      className="border-warning/60 bg-warning/10 text-foreground"
                    >
                      {a.itinerary.needed}
                    </Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-4">
                <FormField id={`day-${n}-title`} label={t.dayTitle} error={dayErrors?.title}>
                  {(describedBy) => (
                    <Input
                      id={`day-${n}-title`}
                      value={day.title}
                      disabled={pending}
                      aria-invalid={dayErrors?.title !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patchDay(index, { title: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField
                  id={`day-${n}-description`}
                  label={t.description}
                  hint={t.descriptionHint}
                  error={dayErrors?.description}
                >
                  {(describedBy) => (
                    <Textarea
                      id={`day-${n}-description`}
                      rows={4}
                      value={day.description}
                      placeholder={t.descriptionPlaceholder}
                      disabled={pending}
                      aria-invalid={dayErrors?.description !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patchDay(index, { description: event.target.value })}
                    />
                  )}
                </FormField>
              </CardContent>
            </Card>
          );
        })}
      </EditorFormFrame>
    </div>
  );
}
