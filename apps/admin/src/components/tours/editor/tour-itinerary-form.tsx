'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { FormField } from '@/components/kit/form-field';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { projectedReadiness } from '@/lib/tour-editor-view';
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
 * Tab Itinerary (spec F17 §2h): đủ N thẻ ngày (Day 1…N), mỗi thẻ một tiêu đề và
 * một mô tả. Cùng khuôn `TourDetailsForm`: `detail` đọc từ PROPS cho luật phụ
 * thuộc trạng thái server (đang bán?), state chỉ giữ giá trị các ô, bản gốc để so
 * "có thay đổi", và `version`.
 *
 * - Mỗi thẻ mang `id="day-N"` — đích của link "An itinerary for day N" trong
 *   khung readiness.
 * - Ngày chưa có tiêu đề thì không có hàng (spec §2b.3): tour tắt bán lưu dở
 *   được; tour đang bán thì ô tiêu đề nào cũng bắt buộc.
 * - Số thẻ theo `detail.durationDays`; đổi số ngày là việc của tab Details.
 */
const t = messages.admin.tours.editor.itinerary;

export function TourItineraryForm({
  detail,
  save: saveAction,
}: {
  detail: AdminTourDetail;
  save: SetItineraryAction;
}) {
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
    onSaved: form.adopt,
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

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={banner}
        serverChanged={form.serverChanged}
        onSubmit={submit}
        onReload={form.reload}
      >
        <p className="text-sm text-muted-foreground">{t.intro(detail.durationDays)}</p>
        {values.days.map((day, index) => {
          const n = index + 1;
          const dayErrors = errors[n];
          return (
            // Thẻ ngày cố định theo vị trí (ngày thứ n) — không thêm/xoá/dời, nên
            // số ngày làm key là đúng.
            <fieldset key={n} id={`day-${n}`} className="grid gap-4 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">{t.day(n)}</legend>
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
            </fieldset>
          );
        })}
      </EditorFormFrame>
    </div>
  );
}
