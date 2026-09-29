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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import { LockIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { FormSelect } from '@/components/kit/form-select';
import { ListEditor } from '@/components/kit/list-editor';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import {
  type ChecklistItem,
  StepChecklist,
  StepTips,
  TourCardPreview,
} from '@/components/tours/editor/step-aside';
import { usePublishSavedDetail } from '@/components/tours/editor/tour-detail-context';
import type { TourEditorOptions } from '@/lib/api/tours';
import { newItemKey } from '@/lib/list-editor';
import {
  formatDayList,
  optionLabel,
  projectedReadiness,
  removedItineraryDays,
  tourCardPreview,
  tourStepHref,
} from '@/lib/tour-editor-view';
import {
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
 * Bước Details (spec F17 §2h, F19 §2d.1): ba card — Basics, Destinations, Selling
 * points — một nút Save; cột phải là việc cần làm của bước (tính trên giá trị ĐANG
 * SOẠN), thẻ xem trước card /tours và gợi ý. Vùng xoá tour ở bước Review & publish.
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
const a = e.aside;

/**
 * Giá trị canh của mục "Not set" trong ô độ khó: Base UI coi chuỗi rỗng là CHƯA
 * CHỌN nên một mục không mang được `''` — đổi qua lại với `''` của form.
 */
const NOT_SET = 'NOT_SET';

export function TourDetailsForm({
  detail,
  options,
  save: saveAction,
}: {
  detail: AdminTourDetail;
  options: TourEditorOptions;
  save: UpdateDetailsAction;
}) {
  const publishSaved = usePublishSavedDetail();
  const form = useTourFormState<TourDetailsFormValues>(detail, detailsFormValues);
  /** `name` chung của các radio điểm chính — duy nhất cho mỗi form trên trang. */
  const primaryName = `${useId()}-primary`;
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

  function setPrimary(key: string) {
    patch({
      destinations: values.destinations.map((line) => ({ ...line, isPrimary: line.key === key })),
    });
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
  /** Tên điểm đến của một dòng cho radio điểm chính; dòng chưa chọn thì "destination N". */
  const destinationLabel = (line: DestinationDraft, index: number) =>
    destinationOptions.find((option) => option.value === line.destinationId)?.label ??
    t.destinationName(index + 1);
  const lineError = (key: string) => errors.lines?.[key];
  const durationError =
    errors.durationDays ??
    (shownFieldError?.field === 'durationDays' ? shownFieldError.message : undefined);
  const groupError =
    errors.maxGroupSize ??
    (shownFieldError?.field === 'maxGroupSize' ? shownFieldError.message : undefined);

  // Cột phải đọc giá trị ĐANG SOẠN (ADR-0049 §6) — thanh bước mới đọc bản đã lưu. Dòng
  // điểm đến chưa chọn không tính: Save sẽ chặn nó bằng "Choose a destination.".
  const draftReadiness = projectedReadiness(detail, {
    summary: values.summary,
    destinations: values.destinations.filter((line) => line.destinationId !== ''),
  });
  const checklist: ChecklistItem[] = [
    {
      key: 'summary',
      label: e.readiness.summary,
      detail: a.required,
      state: draftReadiness.summary ? 'ok' : 'warn',
    },
    {
      key: 'primaryDestination',
      label: e.readiness.primaryDestination,
      detail: a.required,
      state: draftReadiness.primaryDestination ? 'ok' : 'warn',
    },
    {
      key: 'selling',
      label: a.details.sellingOptional,
      detail: a.details.shownWhenFilled,
      state: 'optional',
    },
  ];
  const primaryId = values.destinations.find((line) => line.isPrimary)?.destinationId;
  const preview = tourCardPreview(detail, {
    title: values.title,
    summary: values.summary,
    isFeatured: values.isFeatured,
    days,
    groupSize: parseWholeNumber(values.maxGroupSize),
    basePrice: values.basePrice,
    primaryDestination:
      options.destinations.find((option) => option.id === primaryId)?.name ?? null,
  });

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
        aside={
          <>
            <StepChecklist items={checklist} />
            <TourCardPreview preview={preview} />
            <StepTips items={a.details.tips} />
          </>
        }
        next={{ href: tourStepHref(detail.slug, 'photos'), label: e.tabs.photos }}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t.sections.basics}</CardTitle>
            <CardDescription>{a.details.basicsBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
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
                // Có lỗi thì lỗi nói một mình (thử tay F17): lỗi sàn cùng chữ với gợi
                // ý nên hai câu trùng nhau liền nhau; lỗi server có thể mang sàn mới
                // hơn con số trong gợi ý đang cầm.
                hint={
                  groupError === undefined && detail.liveSeatsMax !== null
                    ? fe.groupFloor(detail.liveSeatsMax)
                    : undefined
                }
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

            <CheckboxRow
              id="tour-featured"
              label={t.featured}
              description={t.featuredHint}
              checked={values.isFeatured}
              disabled={pending}
              onChange={(isFeatured) => patch({ isFeatured })}
            />
          </CardContent>
        </Card>

        <Card id="tour-destinations">
          <CardHeader>
            <CardTitle>{t.sections.destinations}</CardTitle>
            <CardDescription>{t.destinationsHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {errors.destinations ? (
              <p role="alert" className="text-sm text-destructive-emphasis">
                {errors.destinations}
              </p>
            ) : null}
            {/* Radio GỐC ở từng dòng, không phải RadioGroup của Base UI bọc cả danh
              sách (vòng review F17): gốc composite của RadioGroup bắt MỌI phím mũi
              tên nổi bọt từ nút xoá hay ô chọn bên trong, dời tiêu điểm sang một
              radio và radio tự bấm khi nhận tiêu điểm — điểm chính đổi mà admin
              không chọn. Radio gốc cùng `name` chỉ nghe mũi tên khi chính nó đang
              được focus. Không có nút dời: bảng không có cột thứ tự. */}
            <ListEditor<DestinationDraft>
              items={values.destinations}
              onChange={setDestinations}
              max={TOUR_DESTINATIONS_MAX}
              reorderable={false}
              labelledRows
              newItem={() => ({
                key: newItemKey(),
                destinationId: '',
                isPrimary: values.destinations.length === 0,
              })}
              addLabel={t.addDestination}
              itemName={(index) => t.destinationName(index + 1)}
              disabled={pending}
              renderItem={(line, index) => (
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
                  <label className="flex w-fit items-center gap-2 pb-2 text-sm">
                    <input
                      type="radio"
                      name={primaryName}
                      className="size-4 accent-primary disabled:opacity-50"
                      checked={line.isPrimary}
                      disabled={pending}
                      aria-label={t.primaryFor(destinationLabel(line, index))}
                      onChange={() => setPrimary(line.key)}
                    />
                    {t.primary}
                  </label>
                </div>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.sections.selling}</CardTitle>
            <CardDescription>{a.details.sellingBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {/* Lưới 2 cột × 2 hàng từ lg (spec F19 §2d.1): hàng trên hai nhóm ô tích, hàng
              dưới hai câu gợi ý — hai câu luôn cùng một hàng dù hai nhóm cao khác nhau.
              Thứ tự DOM vẫn là nhóm → câu của nó, nên màn hẹp một cột đọc đúng. */}
            <div className="grid gap-x-8 gap-y-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <CheckboxGroup
                id="tour-suitable-for"
                label={t.suitableFor}
                hint={t.suitableForHint}
                options={TravellerTypeSchema.options.map((type) => ({
                  value: type,
                  label: messages.travellerTypes[type],
                }))}
                selected={values.suitableFor}
                disabled={pending}
                onChange={(suitableFor) => patch({ suitableFor })}
                className="lg:col-start-1 lg:row-start-1"
                hintClassName="mb-4 lg:col-start-1 lg:row-start-2 lg:mb-0"
              />
              <CheckboxGroup
                id="tour-badges"
                label={t.badges}
                hint={t.badgesHint}
                options={TourBadgeSchema.options.map((badge) => ({
                  value: badge,
                  label: messages.tourDetail.badges[badge],
                  description: t.badgeHints[badge],
                }))}
                selected={values.badges}
                disabled={pending}
                onChange={(badges) => patch({ badges })}
                className="lg:col-start-2 lg:row-start-1"
                hintClassName="lg:col-start-2 lg:row-start-2"
              />
            </div>

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
            <div className="grid gap-6 lg:grid-cols-2">
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
            </div>

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
          </CardContent>
        </Card>
      </EditorFormFrame>
    </div>
  );
}

/**
 * Một ô tích có nhãn thấy được. `<label htmlFor>` thật (vòng review F17): bấm vào
 * CHỮ cũng tích được, không chỉ ô vuông nhỏ. `id` của Base UI rơi vào ô input ẩn
 * của nó, và Base UI tự nối tên đọc-màn-hình của ô tích với nhãn trỏ vào input ấy.
 */
function CheckboxRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  /** Câu nhỏ dưới nhãn nói ô ấy nghĩa là gì — trình đọc màn hình đọc cùng ô tích. */
  description?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  const row = (
    <span className="flex w-fit items-center gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <label htmlFor={id}>{label}</label>
    </span>
  );
  if (!description) return row;
  return (
    <div className="grid gap-1">
      {row}
      {/* `pl-6` = ô tích 16px cộng khoảng `gap-2` 8px: câu chú thích thẳng hàng với chữ của nhãn. */}
      <p id={descriptionId} className="pl-6 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/** Nhóm ô tích cho một mảng enum (đối tượng khách, huy hiệu) — không bao giờ gửi trùng. */
function CheckboxGroup<Value extends string>({
  id,
  label,
  hint,
  options,
  selected,
  disabled,
  onChange,
  className,
  hintClassName,
}: {
  id: string;
  label: string;
  /** Câu dưới cả nhóm nói nhóm ấy hiện ở đâu trên web (thử tay F17). */
  hint?: string;
  options: readonly { value: Value; label: string; description?: string }[];
  selected: readonly Value[];
  disabled: boolean;
  onChange: (next: Value[]) => void;
  /** Chỗ của nhóm và của câu gợi ý trong lưới của nơi dùng (bước Details: lưới 2×2). */
  className?: string;
  hintClassName?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  // Ô có chú thích riêng thì cao hai dòng — hai cột cho các cột thẳng nhau; ô chỉ có
  // nhãn thì mỗi ô một hàng (spec F19 §2d.1).
  const described = options.some((option) => option.description !== undefined);
  return (
    <>
      {/* `fieldset` + `legend` là nhóm có tên sẵn của HTML — không cần `role="group"`.
          `min-w-0`: fieldset mặc định `min-width: min-content`, làm hàng ô tích tràn ngang. */}
      <fieldset className={cn('min-w-0', className)} aria-describedby={hintId}>
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        <div className={described ? 'grid gap-x-5 gap-y-3 sm:grid-cols-2' : 'grid gap-2'}>
          {options.map((option) => (
            <CheckboxRow
              key={option.value}
              id={`${id}-${option.value}`}
              label={option.label}
              description={option.description}
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
      {/* Câu gợi ý đứng NGOÀI fieldset để nơi dùng xếp nó vào hàng riêng của lưới; nó vẫn
          là mô tả của nhóm qua `aria-describedby`. */}
      {hint ? (
        <p id={hintId} className={cn('text-xs text-muted-foreground', hintClassName)}>
          {hint}
        </p>
      ) : null}
    </>
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
