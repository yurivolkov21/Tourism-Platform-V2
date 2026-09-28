'use client';

import {
  type AdminTourDetail,
  TOUR_DESTINATIONS_MAX,
  TOUR_FACT_NOTE_MAX,
  TOUR_LIST_ITEMS_MAX,
  TOUR_SUMMARY_MAX,
  TourBadgeSchema,
  type TourDifficulty,
  TourDifficultySchema,
  TravellerTypeSchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { Input } from '@tourism/ui/components/input';
import { RadioGroup, RadioGroupItem } from '@tourism/ui/components/radio-group';
import { Textarea } from '@tourism/ui/components/textarea';
import { LockIcon } from 'lucide-react';
import { useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { FormSelect } from '@/components/kit/form-select';
import { ListEditor } from '@/components/kit/list-editor';
import { DeleteTourZone } from '@/components/tours/editor/delete-tour-zone';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { usePublishSavedDetail } from '@/components/tours/editor/tour-detail-context';
import type { TourEditorOptions } from '@/lib/api/tours';
import { newItemKey } from '@/lib/list-editor';
import {
  formatDayList,
  optionLabel,
  projectedReadiness,
  removedItineraryDays,
} from '@/lib/tour-editor-view';
import {
  type DeleteTourAction,
  type DestinationDraft,
  type DetailsContractCode,
  detailsErrorCopy,
  detailsFormValues,
  type LineDraft,
  parseWholeNumber,
  type TourDetailsFormErrors,
  type TourDetailsFormValues,
  tourDetailsPayload,
  type UpdateDetailsAction,
  validateTourDetailsForm,
} from '@/lib/tour-editor-write';
import { useSectionSave } from '@/lib/use-section-save';
import { useTourFormState } from '@/lib/use-tour-form-state';

/**
 * Tab Details (spec F17 §2h): ba khung — Basics, Destinations, Selling points —
 * một nút Save, và vùng xoá ở cuối.
 *
 * `detail` đọc từ PROPS cho mọi luật phụ thuộc trạng thái server (đang bán? có
 * chuyến? sàn ghế?) — sau khi admin bấm On sale ở phần đầu, `router.refresh()`
 * đưa props mới xuống. Giá trị các ô, bản gốc để so "có thay đổi" và `version`
 * nằm trong `useTourFormState`: form KHÔNG bị dựng lại khi phiên bản đổi (vòng
 * review F17) — bản mới được đón khi form sạch, hoặc báo bằng dải stale khi
 * đang sửa.
 */
const e = messages.admin.tours.editor;
const t = e.details;
const fe = e.form.errors;

/**
 * Giá trị canh của mục "Not set" trong ô độ khó: Base UI coi chuỗi rỗng là CHƯA
 * CHỌN nên một mục không mang được `''` — đổi qua lại với `''` của form.
 */
const NOT_SET = 'NOT_SET';

export function TourDetailsForm({
  detail,
  options,
  save: saveAction,
  remove,
}: {
  detail: AdminTourDetail;
  options: TourEditorOptions;
  save: UpdateDetailsAction;
  remove: DeleteTourAction;
}) {
  const publishSaved = usePublishSavedDetail();
  const form = useTourFormState<TourDetailsFormValues>(detail, detailsFormValues);
  const { values, version, dirty, showValidation } = form;
  /**
   * Lỗi server thuộc về một ô (DURATION_LOCKED, GROUP_SIZE_BELOW_SEATS), gắn với
   * phiên bản lúc bấm Save — form nạp bản mới thì lỗi cũ tự tắt.
   */
  const [fieldError, setFieldError] = useState<{
    field: 'durationDays' | 'maxGroupSize';
    message: string;
    version: string;
  } | null>(null);
  const shownFieldError = fieldError?.version === version ? fieldError : null;

  const errors: TourDetailsFormErrors = showValidation
    ? validateTourDetailsForm(values, detail)
    : {};
  const days = parseWholeNumber(values.durationDays);
  const removed = removedItineraryDays(detail.itinerary, days);
  const locked = detail.departureCount > 0;

  const { pending, banner, save } = useSectionSave<DetailsContractCode>({
    copy: detailsErrorCopy,
    slug: detail.slug,
    version,
    projected: () =>
      projectedReadiness(detail, {
        summary: values.summary,
        destinations: values.destinations,
        durationDays: days,
      }),
    onSaved: (next) => {
      form.adopt(next);
      // Phần đầu (readiness, công tắc) theo kịp ngay, không chờ lượt refresh.
      publishSaved(next);
    },
    onFieldError: (code) => {
      if (code === 'DURATION_LOCKED') {
        setFieldError({ field: 'durationDays', message: detailsErrorCopy(code), version });
      } else if (code === 'GROUP_SIZE_BELOW_SEATS') {
        setFieldError({ field: 'maxGroupSize', message: detailsErrorCopy(code), version });
      } else return false;
      return true;
    },
  });

  function patch(next: Partial<TourDetailsFormValues>) {
    form.setValues((current) => ({ ...current, ...next }));
    setFieldError(null);
  }

  function submit() {
    form.setShowValidation(true);
    if (Object.keys(validateTourDetailsForm(values, detail)).length > 0) return;
    void save(() => saveAction(tourDetailsPayload(detail.id, version, values)));
  }

  /** Danh sách điểm đến luôn có đúng một điểm chính khi còn dòng nào. */
  function setDestinations(next: DestinationDraft[]) {
    const hasPrimary = next.some((line) => line.isPrimary);
    patch({
      destinations:
        hasPrimary || next.length === 0
          ? next
          : next.map((line, index) => ({ ...line, isPrimary: index === 0 })),
    });
  }

  const categoryOptions = options.categories.map((option) => ({
    value: option.id,
    label: optionLabel(option),
  }));
  const destinationOptions = options.destinations.map((option) => ({
    value: option.id,
    label: optionLabel(option),
  }));
  const difficultyOptions = [
    { value: NOT_SET, label: t.difficultyNotSet },
    ...TourDifficultySchema.options.map((level) => ({
      value: level,
      label: messages.toursPage.difficultyLabels[level],
    })),
  ];
  const primaryKey = values.destinations.find((line) => line.isPrimary)?.key;
  const lineError = (key: string) => errors.lines?.[key];
  const durationError =
    errors.durationDays ??
    (shownFieldError?.field === 'durationDays' ? shownFieldError.message : undefined);
  const groupError =
    errors.maxGroupSize ??
    (shownFieldError?.field === 'maxGroupSize' ? shownFieldError.message : undefined);

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={banner}
        serverChanged={form.serverChanged}
        note={t.basePriceNote}
        onSubmit={submit}
        onReload={form.reload}
      >
        <fieldset className="grid gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t.sections.basics}</legend>

          <FormField id="tour-title" label={t.title} error={errors.title}>
            {(describedBy) => (
              <Input
                id="tour-title"
                value={values.title}
                disabled={pending}
                aria-invalid={errors.title !== undefined}
                aria-describedby={describedBy}
                onChange={(event) => patch({ title: event.target.value })}
              />
            )}
          </FormField>

          <FormField
            id="tour-summary"
            label={t.summary}
            hint={t.summaryHint(TOUR_SUMMARY_MAX)}
            error={errors.summary}
          >
            {(describedBy) => (
              <Textarea
                id="tour-summary"
                rows={3}
                value={values.summary}
                disabled={pending}
                aria-invalid={errors.summary !== undefined}
                aria-describedby={describedBy}
                onChange={(event) => patch({ summary: event.target.value })}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="tour-category" label={t.category} error={errors.categoryId}>
              {(describedBy) => (
                <FormSelect
                  id="tour-category"
                  value={values.categoryId}
                  options={categoryOptions}
                  placeholder={t.categoryPlaceholder}
                  disabled={pending}
                  invalid={errors.categoryId !== undefined}
                  describedBy={describedBy}
                  onValueChange={(categoryId) => patch({ categoryId })}
                />
              )}
            </FormField>
            <FormField id="tour-difficulty" label={t.difficulty}>
              {(describedBy) => (
                <FormSelect
                  id="tour-difficulty"
                  value={values.difficulty === '' ? NOT_SET : values.difficulty}
                  options={difficultyOptions}
                  placeholder={t.difficultyNotSet}
                  disabled={pending}
                  describedBy={describedBy}
                  onValueChange={(value) =>
                    patch({ difficulty: value === NOT_SET ? '' : (value as TourDifficulty) })
                  }
                />
              )}
            </FormField>
          </div>

          <CheckboxRow
            id="tour-featured"
            label={t.featured}
            checked={values.isFeatured}
            disabled={pending}
            onChange={(isFeatured) => patch({ isFeatured })}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="tour-duration"
              label={t.durationDays}
              hint={locked ? fe.durationLocked : undefined}
              error={durationError}
            >
              {(describedBy) => (
                <div className="relative">
                  <Input
                    id="tour-duration"
                    inputMode="numeric"
                    value={values.durationDays}
                    // Tour đã có chuyến thì số ngày khoá hẳn (ADR-0047 §6).
                    disabled={pending || locked}
                    aria-invalid={durationError !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => patch({ durationDays: event.target.value })}
                  />
                  {locked ? (
                    <LockIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                  ) : null}
                </div>
              )}
            </FormField>
            <FormField
              id="tour-group"
              label={t.maxGroupSize}
              hint={detail.liveSeatsMax !== null ? fe.groupFloor(detail.liveSeatsMax) : undefined}
              error={groupError}
            >
              {(describedBy) => (
                <Input
                  id="tour-group"
                  inputMode="numeric"
                  value={values.maxGroupSize}
                  disabled={pending}
                  aria-invalid={groupError !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patch({ maxGroupSize: event.target.value })}
                />
              )}
            </FormField>
            <FormField id="tour-price" label={t.basePrice} error={errors.basePrice}>
              {(describedBy) => (
                <Input
                  id="tour-price"
                  inputMode="decimal"
                  value={values.basePrice}
                  disabled={pending}
                  aria-invalid={errors.basePrice !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patch({ basePrice: event.target.value })}
                />
              )}
            </FormField>
          </div>

          {removed.length > 0 ? (
            // Giọng CẢNH BÁO, không phải lỗi: lưu được, chỉ là ngày thừa sẽ mất.
            <p aria-live="polite" className="text-sm">
              {t.daysRemoved(formatDayList(removed), removed.length)}
            </p>
          ) : null}
        </fieldset>

        <fieldset id="tour-destinations" className="grid gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t.sections.destinations}</legend>
          <p className="text-xs text-muted-foreground">{t.destinationsHint}</p>
          {errors.destinations ? (
            <p role="alert" className="text-sm text-destructive-emphasis">
              {errors.destinations}
            </p>
          ) : null}
          <RadioGroup
            value={primaryKey ?? ''}
            disabled={pending}
            onValueChange={(key) =>
              patch({
                destinations: values.destinations.map((line) => ({
                  ...line,
                  isPrimary: line.key === key,
                })),
              })
            }
          >
            <ListEditor<DestinationDraft>
              items={values.destinations}
              onChange={setDestinations}
              max={TOUR_DESTINATIONS_MAX}
              newItem={() => ({
                key: newItemKey(),
                destinationId: '',
                isPrimary: values.destinations.length === 0,
              })}
              addLabel={t.addDestination}
              itemName={(index) => t.destinationName(index + 1)}
              disabled={pending}
              renderItem={(line) => (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <FormField
                    id={`tour-destination-${line.key}`}
                    label={t.destination}
                    error={lineError(line.key)}
                  >
                    {(describedBy) => (
                      <FormSelect
                        id={`tour-destination-${line.key}`}
                        value={line.destinationId}
                        options={destinationOptions}
                        placeholder={t.destinationPlaceholder}
                        disabled={pending}
                        invalid={lineError(line.key) !== undefined}
                        describedBy={describedBy}
                        onValueChange={(destinationId) =>
                          patch({
                            destinations: values.destinations.map((item) =>
                              item.key === line.key ? { ...item, destinationId } : item,
                            ),
                          })
                        }
                      />
                    )}
                  </FormField>
                  <span className="flex items-center gap-2 pb-2 text-sm">
                    <RadioGroupItem value={line.key} aria-label={t.primary} />
                    <span aria-hidden="true">{t.primary}</span>
                  </span>
                </div>
              )}
            />
          </RadioGroup>
        </fieldset>

        <fieldset className="grid gap-5 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t.sections.selling}</legend>

          <CheckboxGroup
            id="tour-suitable-for"
            label={t.suitableFor}
            options={TravellerTypeSchema.options.map((type) => ({
              value: type,
              label: messages.travellerTypes[type],
            }))}
            selected={values.suitableFor}
            disabled={pending}
            onChange={(suitableFor) => patch({ suitableFor })}
          />
          <CheckboxGroup
            id="tour-badges"
            label={t.badges}
            options={TourBadgeSchema.options.map((badge) => ({
              value: badge,
              label: messages.tourDetail.badges[badge],
            }))}
            selected={values.badges}
            disabled={pending}
            onChange={(badges) => patch({ badges })}
          />

          <LineList
            id="tour-highlights"
            label={t.highlights}
            addLabel={t.addHighlight}
            itemName={t.highlightName}
            lines={values.highlights}
            errors={errors.lines}
            disabled={pending}
            onChange={(highlights) => patch({ highlights })}
          />
          <LineList
            id="tour-included"
            label={t.included}
            addLabel={t.addIncluded}
            itemName={t.includedName}
            lines={values.included}
            errors={errors.lines}
            disabled={pending}
            onChange={(included) => patch({ included })}
          />
          <LineList
            id="tour-excluded"
            label={t.excluded}
            addLabel={t.addExcluded}
            itemName={t.excludedName}
            lines={values.excluded}
            errors={errors.lines}
            disabled={pending}
            onChange={(excluded) => patch({ excluded })}
          />

          <FormField id="tour-meeting-point" label={t.meetingPoint} error={errors.meetingPoint}>
            {(describedBy) => (
              <Input
                id="tour-meeting-point"
                value={values.meetingPoint}
                disabled={pending}
                aria-invalid={errors.meetingPoint !== undefined}
                aria-describedby={describedBy}
                onChange={(event) => patch({ meetingPoint: event.target.value })}
              />
            )}
          </FormField>

          <div className="grid gap-3">
            <p className="text-sm font-medium">{t.factsTitle}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['factDurationNote', messages.tourDetail.facts.duration],
                  ['factGroupSizeNote', messages.tourDetail.facts.groupSize],
                  ['factDifficultyNote', messages.tourDetail.facts.difficulty],
                  ['factGoodForNote', messages.tourDetail.facts.goodFor],
                ] as const
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  id={`tour-${name}`}
                  label={label}
                  hint={t.factHint(TOUR_FACT_NOTE_MAX)}
                  error={errors[name]}
                >
                  {(describedBy) => (
                    <Input
                      id={`tour-${name}`}
                      value={values[name]}
                      disabled={pending}
                      aria-invalid={errors[name] !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patch({ [name]: event.target.value })}
                    />
                  )}
                </FormField>
              ))}
            </div>
          </div>
        </fieldset>
      </EditorFormFrame>
      {detail.bookingCount === 0 ? <DeleteTourZone detail={detail} remove={remove} /> : null}
    </div>
  );
}

/** Một ô tích có nhãn thấy được — tên đọc-màn-hình trỏ vào chính nhãn ấy. */
function CheckboxRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span id={`${id}-label`}>{label}</span>
    </span>
  );
}

/** Nhóm ô tích cho một mảng enum (đối tượng khách, huy hiệu) — không bao giờ gửi trùng. */
function CheckboxGroup<Value extends string>({
  id,
  label,
  options,
  selected,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  options: readonly { value: Value; label: string }[];
  selected: readonly Value[];
  disabled: boolean;
  onChange: (next: Value[]) => void;
}) {
  return (
    // `fieldset` + `legend` là nhóm có tên sẵn của HTML — không cần `role="group"`.
    // `min-w-0`: fieldset mặc định `min-width: min-content`, làm hàng ô tích tràn ngang.
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <CheckboxRow
            key={option.value}
            id={`${id}-${option.value}`}
            label={option.label}
            checked={selected.includes(option.value)}
            disabled={disabled}
            onChange={(checked) =>
              onChange(
                checked
                  ? // Giữ thứ tự của danh sách chọn, không phải thứ tự bấm.
                    options
                      .map((item) => item.value)
                      .filter((value) => value === option.value || selected.includes(value))
                  : selected.filter((value) => value !== option.value),
              )
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Một danh sách dòng chữ (điểm nổi bật, bao gồm, không bao gồm) trên khung dùng chung. */
function LineList({
  id,
  label,
  addLabel,
  itemName,
  lines,
  errors,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  addLabel: string;
  itemName: (n: number) => string;
  lines: LineDraft[];
  errors: Record<string, string> | undefined;
  disabled: boolean;
  onChange: (next: LineDraft[]) => void;
}) {
  return (
    <div className="grid gap-2">
      <p id={`${id}-label`} className="text-sm font-medium">
        {label}
      </p>
      <ListEditor<LineDraft>
        items={lines}
        onChange={onChange}
        max={TOUR_LIST_ITEMS_MAX}
        newItem={() => ({ key: newItemKey(), text: '' })}
        addLabel={addLabel}
        itemName={(index) => itemName(index + 1)}
        disabled={disabled}
        renderItem={(line, index) => {
          const error = errors?.[line.key];
          const errorId = `${id}-${line.key}-error`;
          return (
            <div className="grid gap-1.5">
              <Input
                aria-label={itemName(index + 1)}
                value={line.text}
                disabled={disabled}
                aria-invalid={error !== undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) =>
                  onChange(
                    lines.map((item) =>
                      item.key === line.key ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
              />
              {error ? (
                <p id={errorId} role="alert" className="text-sm text-destructive-emphasis">
                  {error}
                </p>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}
