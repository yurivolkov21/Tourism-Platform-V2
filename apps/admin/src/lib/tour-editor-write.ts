import {
  type AdminTourCostsInput,
  type AdminTourCreateInput,
  type AdminTourCreateResult,
  type AdminTourDeleteInput,
  type AdminTourDeleteResult,
  type AdminTourDetail,
  type AdminTourDetailsInput,
  type AdminTourFaqsPoliciesInput,
  type AdminTourItineraryInput,
  type CostItemLike,
  DeparturePriceSchema,
  SLUG_PATTERN,
  TOUR_COST_LABEL_MAX,
  TOUR_DAY_DESCRIPTION_MAX,
  TOUR_DAY_TITLE_MAX,
  TOUR_DURATION_MAX,
  TOUR_FACT_NOTE_MAX,
  TOUR_FAQ_ANSWER_MAX,
  TOUR_FAQ_QUESTION_MAX,
  TOUR_GROUP_MAX,
  TOUR_LIST_ITEM_MAX,
  TOUR_MEETING_POINT_MAX,
  TOUR_POLICY_BODY_MAX,
  TOUR_POLICY_TITLE_MAX,
  TOUR_SLUG_MAX,
  TOUR_SUMMARY_MAX,
  TOUR_TITLE_MAX,
  type TourBadge,
  TourBasePriceSchema,
  type TourCostBasis,
  type TourCostCategory,
  type TourDifficulty,
  type TravellerType,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import { type Keyed, newItemKey } from './list-editor';

/**
 * Logic THUẦN của sáu hành vi ghi của khu làm việc tour (spec F17) — cùng khuôn
 * `destinations-write.ts`: codec lỗi derive từ khối i18n, hợp đồng vận chuyển của
 * server action, giá trị thô của form, validator soi gương contract, payload.
 *
 * Validator KHÔNG tự chế trần: mọi con số là hằng của contract (bài học 12).
 * Luật "tour đang bán" (ADR-0047 §4) cũng soi gương ở đây để admin thấy lỗi dưới
 * đúng ô trước khi bấm Save; server vẫn là trọng tài cuối.
 */
const e = messages.admin.tours.editor;
const fe = e.form.errors;

// ── Codec ───────────────────────────────────────────────────────────────────

const createCodec = createWriteErrorCodec(e.create.errors);
const detailsCodec = createWriteErrorCodec(e.details.errors);
const itineraryCodec = createWriteErrorCodec(e.itinerary.errors);
const contentCodec = createWriteErrorCodec(e.content.errors);
const costsCodec = createWriteErrorCodec(e.costs.errors);
/** Xoá đi qua `ConfirmWriteDialog`: `NOT_FOUND` là trạng-thái-cũ (đóng + toast + về /tours). */
const deleteCodec = createWriteErrorCodec(e.delete.errors, { stale: ['NOT_FOUND'] });

export type CreateTourContractCode = keyof typeof e.create.errors;
export type DetailsContractCode = keyof typeof e.details.errors;
export type ItineraryContractCode = keyof typeof e.itinerary.errors;
export type ContentContractCode = keyof typeof e.content.errors;
export type CostsContractCode = keyof typeof e.costs.errors;
export type DeleteTourContractCode = keyof typeof e.delete.errors;

export const CREATE_TOUR_CONTRACT_CODES = createCodec.codes;
export const DETAILS_CONTRACT_CODES = detailsCodec.codes;
export const ITINERARY_CONTRACT_CODES = itineraryCodec.codes;
export const CONTENT_CONTRACT_CODES = contentCodec.codes;
export const COSTS_CONTRACT_CODES = costsCodec.codes;
export const DELETE_TOUR_CONTRACT_CODES = deleteCodec.codes;

export const classifyCreateTourError = createCodec.classify;
export const createTourErrorCopy = createCodec.copy;
export const classifyDetailsError = detailsCodec.classify;
export const detailsErrorCopy = detailsCodec.copy;
export const classifyItineraryError = itineraryCodec.classify;
export const itineraryErrorCopy = itineraryCodec.copy;
export const classifyContentError = contentCodec.classify;
export const contentErrorCopy = contentCodec.copy;
export const classifyCostsError = costsCodec.classify;
export const costsErrorCopy = costsCodec.copy;
export const classifyDeleteTourError = deleteCodec.classify;
export const deleteTourErrorCopy = deleteCodec.copy;
export const isDeleteTourStale = deleteCodec.isStale;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

/** Bốn lệnh sửa trả NGUYÊN tour server vừa ghi — form lấy `version` mới từ đây. */
export type EditorWriteResult<Code extends string> =
  | { ok: true; detail: AdminTourDetail }
  | { ok: false; code: Code | TransportFailureCode };

export type CreateTourResult =
  | { ok: true; created: AdminTourCreateResult }
  | { ok: false; code: CreateTourContractCode | TransportFailureCode };

export type DeleteTourResult =
  | { ok: true; deleted: AdminTourDeleteResult }
  | { ok: false; code: DeleteTourContractCode | TransportFailureCode };

export type CreateTourAction = (input: AdminTourCreateInput) => Promise<CreateTourResult>;
export type UpdateDetailsAction = (
  input: AdminTourDetailsInput,
) => Promise<EditorWriteResult<DetailsContractCode>>;
export type SetItineraryAction = (
  input: AdminTourItineraryInput,
) => Promise<EditorWriteResult<ItineraryContractCode>>;
export type SetContentAction = (
  input: AdminTourFaqsPoliciesInput,
) => Promise<EditorWriteResult<ContentContractCode>>;
export type SetCostsAction = (
  input: AdminTourCostsInput,
) => Promise<EditorWriteResult<CostsContractCode>>;
export type DeleteTourAction = (input: AdminTourDeleteInput) => Promise<DeleteTourResult>;

// ── Ô số và ô tiền ──────────────────────────────────────────────────────────

/** Chuỗi chữ số trần → số; mọi thứ khác (rỗng, "2.5", "abc", "1e2") → NaN. */
export function parseWholeNumber(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

function wholeNumberError(text: string, min: number, max: number): string | undefined {
  const value = parseWholeNumber(text);
  return Number.isInteger(value) && value >= min && value <= max
    ? undefined
    : fe.wholeNumber(min, max);
}

function basePriceError(text: string): string | undefined {
  const value = text.trim();
  if (!DeparturePriceSchema.safeParse(value).success) return fe.price;
  return TourBasePriceSchema.safeParse(value).success ? undefined : fe.priceAboveZero;
}

function textError(text: string, max: number, required: boolean): string | undefined {
  const value = text.trim();
  if (required && value === '') return fe.required;
  return value.length > max ? fe.tooLong(max) : undefined;
}

/** Ô chữ tuỳ chọn: trống thành `null` — cột nullable, "chưa viết" khác chuỗi rỗng. */
function orNull(text: string): string | null {
  const value = text.trim();
  return value === '' ? null : value;
}

/** Chỉ ghi khoá khi ô ấy thật sự hỏng — `hasFormErrors` đếm khoá. */
function setError<T extends object>(errors: T, field: keyof T, error: string | undefined): void {
  if (error !== undefined) (errors as Record<keyof T, string>)[field] = error;
}

/**
 * Lỗi dạng `Record` lồng (mỗi dòng một object lỗi) có khoá nào mang giá trị
 * không — bản lồng của `hasFormErrors`.
 */
export function hasNestedErrors(errors: Record<string | number, object>): boolean {
  return Object.values(errors).some((entry) => Object.keys(entry).length > 0);
}

/**
 * Hai giá trị form có như nhau không, BỎ QUA `key` của dòng — nuôi cờ "có thay
 * đổi" của cả bốn tab. Key sinh mới mỗi lần dựng form nên không được tính.
 */
export function sameValues(a: unknown, b: unknown): boolean {
  const withoutKeys = (field: string, value: unknown) => (field === 'key' ? undefined : value);
  return JSON.stringify(a, withoutKeys) === JSON.stringify(b, withoutKeys);
}

// ── Hộp New tour ────────────────────────────────────────────────────────────

/** Bảy ô thô như người gõ (spec §2a); ô chọn giữ id, chuỗi rỗng = chưa chọn. */
export interface TourCreateFormValues {
  title: string;
  slug: string;
  categoryId: string;
  primaryDestinationId: string;
  durationDays: string;
  maxGroupSize: string;
  basePrice: string;
}

export type TourCreateFormErrors = Partial<Record<keyof TourCreateFormValues, string>>;

export function newTourFormValues(): TourCreateFormValues {
  return {
    title: '',
    slug: '',
    categoryId: '',
    primaryDestinationId: '',
    durationDays: '',
    maxGroupSize: '',
    basePrice: '',
  };
}

function slugError(text: string): string | undefined {
  const slug = text.trim();
  if (slug === '') return fe.required;
  if (!SLUG_PATTERN.test(slug)) return fe.slugShape;
  return slug.length > TOUR_SLUG_MAX ? fe.tooLong(TOUR_SLUG_MAX) : undefined;
}

export function validateTourCreateForm(values: TourCreateFormValues): TourCreateFormErrors {
  const errors: TourCreateFormErrors = {};
  setError(errors, 'title', textError(values.title, TOUR_TITLE_MAX, true));
  setError(errors, 'slug', slugError(values.slug));
  if (values.categoryId === '') errors.categoryId = fe.chooseCategory;
  if (values.primaryDestinationId === '') errors.primaryDestinationId = fe.chooseDestination;
  setError(errors, 'durationDays', wholeNumberError(values.durationDays, 1, TOUR_DURATION_MAX));
  setError(errors, 'maxGroupSize', wholeNumberError(values.maxGroupSize, 1, TOUR_GROUP_MAX));
  setError(errors, 'basePrice', basePriceError(values.basePrice));
  return errors;
}

/** Bảy ô thô → hình dạng contract của `create`. Gọi SAU khi validate đã sạch. */
export function tourCreatePayload(values: TourCreateFormValues): AdminTourCreateInput {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    categoryId: values.categoryId,
    primaryDestinationId: values.primaryDestinationId,
    durationDays: parseWholeNumber(values.durationDays),
    maxGroupSize: parseWholeNumber(values.maxGroupSize),
    basePrice: values.basePrice.trim(),
  };
}

// ── Tab Details ─────────────────────────────────────────────────────────────

export interface LineDraft extends Keyed {
  text: string;
}

export interface DestinationDraft extends Keyed {
  destinationId: string;
  isPrimary: boolean;
}

export interface TourDetailsFormValues {
  title: string;
  summary: string;
  categoryId: string;
  /** `''` = "Not set". */
  difficulty: TourDifficulty | '';
  isFeatured: boolean;
  durationDays: string;
  maxGroupSize: string;
  basePrice: string;
  destinations: DestinationDraft[];
  suitableFor: TravellerType[];
  badges: TourBadge[];
  highlights: LineDraft[];
  included: LineDraft[];
  excluded: LineDraft[];
  meetingPoint: string;
  factDurationNote: string;
  factGroupSizeNote: string;
  factDifficultyNote: string;
  factGoodForNote: string;
}

export interface TourDetailsFormErrors {
  title?: string;
  summary?: string;
  categoryId?: string;
  durationDays?: string;
  maxGroupSize?: string;
  basePrice?: string;
  /** Lỗi của CẢ khung điểm đến (không còn dòng nào). */
  destinations?: string;
  meetingPoint?: string;
  factDurationNote?: string;
  factGroupSizeNote?: string;
  factDifficultyNote?: string;
  factGoodForNote?: string;
  /** Lỗi của từng dòng, khoá bằng `key` — dòng điểm đến lẫn dòng chữ. */
  lines?: Record<string, string>;
}

const toLines = (texts: readonly string[]): LineDraft[] =>
  texts.map((text) => ({ key: newItemKey(), text }));

export function detailsFormValues(detail: AdminTourDetail): TourDetailsFormValues {
  return {
    title: detail.title,
    summary: detail.summary ?? '',
    categoryId: detail.categoryId,
    difficulty: detail.difficulty ?? '',
    isFeatured: detail.isFeatured,
    durationDays: String(detail.durationDays),
    maxGroupSize: String(detail.maxGroupSize),
    basePrice: detail.basePrice,
    destinations: detail.destinations.map((link) => ({
      key: newItemKey(),
      destinationId: link.destinationId,
      isPrimary: link.isPrimary,
    })),
    suitableFor: [...detail.suitableFor],
    badges: [...detail.badges],
    highlights: toLines(detail.highlights),
    included: toLines(detail.included),
    excluded: toLines(detail.excluded),
    meetingPoint: detail.meetingPoint ?? '',
    factDurationNote: detail.factDurationNote ?? '',
    factGroupSizeNote: detail.factGroupSizeNote ?? '',
    factDifficultyNote: detail.factDifficultyNote ?? '',
    factGoodForNote: detail.factGoodForNote ?? '',
  };
}

/**
 * Soi gương contract cộng ba luật phụ thuộc trạng thái server của `detail`:
 * tour đang bán (tóm tắt, thêm ngày), tour có chuyến (số ngày khoá), sàn ghế.
 */
export function validateTourDetailsForm(
  values: TourDetailsFormValues,
  detail: AdminTourDetail,
): TourDetailsFormErrors {
  const errors: TourDetailsFormErrors = {};
  const lines: Record<string, string> = {};

  setError(errors, 'title', textError(values.title, TOUR_TITLE_MAX, true));
  if (detail.isPublished && values.summary.trim() === '') errors.summary = fe.summaryOnSale;
  else setError(errors, 'summary', textError(values.summary, TOUR_SUMMARY_MAX, false));
  if (values.categoryId === '') errors.categoryId = fe.chooseCategory;

  const days = parseWholeNumber(values.durationDays);
  const daysError = wholeNumberError(values.durationDays, 1, TOUR_DURATION_MAX);
  if (daysError !== undefined) errors.durationDays = daysError;
  else if (days !== detail.durationDays && detail.departureCount > 0) {
    errors.durationDays = fe.durationLocked;
  } else if (days > detail.durationDays && detail.isPublished) {
    errors.durationDays = fe.addDaysOnSale;
  }

  const group = parseWholeNumber(values.maxGroupSize);
  const groupError = wholeNumberError(values.maxGroupSize, 1, TOUR_GROUP_MAX);
  if (groupError !== undefined) errors.maxGroupSize = groupError;
  else if (detail.liveSeatsMax !== null && group < detail.liveSeatsMax) {
    errors.maxGroupSize = fe.groupFloor(detail.liveSeatsMax);
  }

  setError(errors, 'basePrice', basePriceError(values.basePrice));

  if (values.destinations.length === 0) errors.destinations = fe.chooseDestination;
  const seen = new Set<string>();
  for (const line of values.destinations) {
    if (line.destinationId === '') lines[line.key] = fe.chooseDestination;
    else if (seen.has(line.destinationId)) lines[line.key] = fe.duplicateDestination;
    seen.add(line.destinationId);
  }

  for (const line of [...values.highlights, ...values.included, ...values.excluded]) {
    const value = line.text.trim();
    if (value === '') lines[line.key] = fe.emptyLine;
    else if (value.length > TOUR_LIST_ITEM_MAX) lines[line.key] = fe.tooLong(TOUR_LIST_ITEM_MAX);
  }

  setError(errors, 'meetingPoint', textError(values.meetingPoint, TOUR_MEETING_POINT_MAX, false));
  for (const field of [
    'factDurationNote',
    'factGroupSizeNote',
    'factDifficultyNote',
    'factGoodForNote',
  ] as const) {
    setError(errors, field, textError(values[field], TOUR_FACT_NOTE_MAX, false));
  }

  if (Object.keys(lines).length > 0) errors.lines = lines;
  return errors;
}

export function tourDetailsPayload(
  id: string,
  version: string,
  values: TourDetailsFormValues,
): AdminTourDetailsInput {
  const texts = (lines: readonly LineDraft[]) => lines.map((line) => line.text.trim());
  return {
    id,
    version,
    title: values.title.trim(),
    summary: orNull(values.summary),
    categoryId: values.categoryId,
    difficulty: values.difficulty === '' ? null : values.difficulty,
    isFeatured: values.isFeatured,
    durationDays: parseWholeNumber(values.durationDays),
    maxGroupSize: parseWholeNumber(values.maxGroupSize),
    basePrice: values.basePrice.trim(),
    destinations: values.destinations.map((line) => ({
      destinationId: line.destinationId,
      isPrimary: line.isPrimary,
    })),
    suitableFor: [...values.suitableFor],
    badges: [...values.badges],
    highlights: texts(values.highlights),
    included: texts(values.included),
    excluded: texts(values.excluded),
    meetingPoint: orNull(values.meetingPoint),
    factDurationNote: orNull(values.factDurationNote),
    factGroupSizeNote: orNull(values.factGroupSizeNote),
    factDifficultyNote: orNull(values.factDifficultyNote),
    factGoodForNote: orNull(values.factGoodForNote),
  };
}

// ── Tab Itinerary ───────────────────────────────────────────────────────────

export interface ItineraryDayDraft {
  title: string;
  description: string;
}

/** Vị trí `i` là ngày `i + 1` — đủ N ô, kể cả ngày chưa có hàng. */
export interface ItineraryFormValues {
  days: ItineraryDayDraft[];
}

/** Khoá là `dayNumber`. */
export type ItineraryFormErrors = Record<number, { title?: string; description?: string }>;

export function itineraryFormValues(detail: AdminTourDetail): ItineraryFormValues {
  const byDay = new Map(detail.itinerary.map((day) => [day.dayNumber, day]));
  return {
    days: Array.from({ length: detail.durationDays }, (_, index) => {
      const day = byDay.get(index + 1);
      return { title: day?.title ?? '', description: day?.description ?? '' };
    }),
  };
}

export function validateItineraryForm(
  values: ItineraryFormValues,
  detail: AdminTourDetail,
): ItineraryFormErrors {
  const errors: ItineraryFormErrors = {};
  values.days.forEach((day, index) => {
    const entry: { title?: string; description?: string } = {};
    const title = day.title.trim();
    const description = day.description.trim();
    if (title === '') {
      if (detail.isPublished) entry.title = fe.dayTitleOnSale;
      if (description !== '') entry.description = fe.descriptionWithoutTitle;
    } else if (title.length > TOUR_DAY_TITLE_MAX) {
      entry.title = fe.tooLong(TOUR_DAY_TITLE_MAX);
    }
    if (entry.description === undefined && description.length > TOUR_DAY_DESCRIPTION_MAX) {
      entry.description = fe.tooLong(TOUR_DAY_DESCRIPTION_MAX);
    }
    if (Object.keys(entry).length > 0) errors[index + 1] = entry;
  });
  return errors;
}

/** Chỉ gửi ngày ĐÃ có tiêu đề (spec §2b.3): ngày không tiêu đề không có hàng. */
export function itineraryPayload(
  id: string,
  version: string,
  values: ItineraryFormValues,
): AdminTourItineraryInput {
  return {
    id,
    version,
    days: values.days.flatMap((day, index) => {
      const title = day.title.trim();
      return title === ''
        ? []
        : [{ dayNumber: index + 1, title, description: orNull(day.description) }];
    }),
  };
}

// ── Tab FAQ & policies ──────────────────────────────────────────────────────

export interface FaqDraft extends Keyed {
  question: string;
  answer: string;
}

export interface PolicyDraft extends Keyed {
  kind: 'BOOKING' | 'GENERAL';
  title: string;
  body: string;
}

export interface ContentFormValues {
  faqs: FaqDraft[];
  policies: PolicyDraft[];
}

/** Khoá là `key` của dòng. */
export type ContentFormErrors = Record<
  string,
  Partial<Record<'question' | 'answer' | 'title' | 'body', string>>
>;

/**
 * Chính sách loại `CANCELLATION` (dữ liệu cũ trước ADR-0041) KHÔNG vào form: ghi
 * chỉ nhận hai loại, nên lưu tab này sẽ xoá nó. Đo 24/09: không còn dòng nào —
 * nhưng nếu có thì không được im lặng, component báo bằng số đếm này.
 */
export function droppedCancellationCount(detail: AdminTourDetail): number {
  return detail.policies.filter((policy) => policy.kind === 'CANCELLATION').length;
}

export function contentFormValues(detail: AdminTourDetail): ContentFormValues {
  return {
    faqs: detail.faqs.map((faq) => ({
      key: newItemKey(),
      question: faq.question,
      answer: faq.answer,
    })),
    policies: detail.policies.flatMap((policy) =>
      policy.kind === 'CANCELLATION'
        ? []
        : [{ key: newItemKey(), kind: policy.kind, title: policy.title, body: policy.body }],
    ),
  };
}

export function validateContentForm(values: ContentFormValues): ContentFormErrors {
  const errors: ContentFormErrors = {};
  for (const faq of values.faqs) {
    const entry: ContentFormErrors[string] = {};
    setError(entry, 'question', textError(faq.question, TOUR_FAQ_QUESTION_MAX, true));
    setError(entry, 'answer', textError(faq.answer, TOUR_FAQ_ANSWER_MAX, true));
    if (Object.keys(entry).length > 0) errors[faq.key] = entry;
  }
  for (const policy of values.policies) {
    const entry: ContentFormErrors[string] = {};
    setError(entry, 'title', textError(policy.title, TOUR_POLICY_TITLE_MAX, true));
    setError(entry, 'body', textError(policy.body, TOUR_POLICY_BODY_MAX, true));
    if (Object.keys(entry).length > 0) errors[policy.key] = entry;
  }
  return errors;
}

export function contentPayload(
  id: string,
  version: string,
  values: ContentFormValues,
): AdminTourFaqsPoliciesInput {
  return {
    id,
    version,
    faqs: values.faqs.map((faq) => ({ question: faq.question.trim(), answer: faq.answer.trim() })),
    policies: values.policies.map((policy) => ({
      kind: policy.kind,
      title: policy.title.trim(),
      body: policy.body.trim(),
    })),
  };
}

// ── Tab Costs ───────────────────────────────────────────────────────────────

export interface CostDraft extends Keyed {
  category: TourCostCategory;
  label: string;
  amount: string;
  basis: TourCostBasis;
}

export interface CostsFormValues {
  items: CostDraft[];
}

/** Khoá là `key` của dòng. */
export type CostsFormErrors = Record<string, Partial<Record<'label' | 'amount', string>>>;

export function costsFormValues(detail: AdminTourDetail): CostsFormValues {
  return {
    items: detail.costItems.map((item) => ({
      key: newItemKey(),
      category: item.category,
      label: item.label,
      amount: item.amount,
      basis: item.basis,
    })),
  };
}

export function validateCostsForm(values: CostsFormValues): CostsFormErrors {
  const errors: CostsFormErrors = {};
  for (const item of values.items) {
    const entry: CostsFormErrors[string] = {};
    setError(entry, 'label', textError(item.label, TOUR_COST_LABEL_MAX, true));
    // Chi phí 0 là có thật (vé miễn phí) — khuôn giá chuyến, cho phép 0.
    if (!DeparturePriceSchema.safeParse(item.amount.trim()).success) entry.amount = fe.price;
    if (Object.keys(entry).length > 0) errors[item.key] = entry;
  }
  return errors;
}

export function costsPayload(
  id: string,
  version: string,
  values: CostsFormValues,
): AdminTourCostsInput {
  return {
    id,
    version,
    items: values.items.map((item) => ({
      category: item.category,
      label: item.label.trim(),
      amount: item.amount.trim(),
      basis: item.basis,
    })),
  };
}

/**
 * Dòng chi phí đủ để cộng — CHỈ dòng có số tiền hợp lệ, để khung tổng ở màn Costs
 * không nhảy `NaN` khi admin đang gõ dở ("12.").
 */
export function costDraftItems(values: CostsFormValues): CostItemLike[] {
  return values.items.flatMap((item) => {
    const amount = item.amount.trim();
    return DeparturePriceSchema.safeParse(amount).success ? [{ amount, basis: item.basis }] : [];
  });
}
