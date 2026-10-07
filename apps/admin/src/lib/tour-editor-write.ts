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
  TourBadgeSchema,
  TourBasePriceSchema,
  type TourCostBasis,
  type TourCostCategory,
  type TourDifficulty,
  type TravellerType,
  TravellerTypeSchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { TourEditorOptions } from './api/tours';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import type { Keyed } from './list-editor';
import { onSaleShortfalls, projectedReadiness } from './tour-editor-view';

/**
 * Logic THUẦN của sáu hành vi ghi của khu làm việc tour (spec F17) — cùng khuôn
 * `destinations-write.ts`: codec lỗi derive từ khối i18n, hợp đồng vận chuyển của
 * server action, giá trị thô của form, validator soi gương contract, payload.
 *
 * Validator KHÔNG tự chế trần: mọi con số là hằng của contract (bài học 12).
 * Luật "tour đang bán thì luôn đủ" (ADR-0047 §4) suy từ `onSaleShortfalls` trên
 * readiness dự tính (G11, ADR-0048 §8) — không viết tay từng luật — để admin thấy
 * lỗi dưới đúng ô trước khi bấm Save; server vẫn là trọng tài cuối.
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

/** Khuôn tiền của contract: tối đa 2 chữ số lẻ — để tách "sai khuôn" khỏi "quá trần". */
const AMOUNT = /^\d+(\.\d{1,2})?$/;

/** Ô tiền đúng khuôn mà vẫn hỏng thì chỉ có thể là quá trần 999,999.99 (vòng review F17). */
function amountError(value: string): string | undefined {
  if (DeparturePriceSchema.safeParse(value).success) return undefined;
  return AMOUNT.test(value) ? fe.priceMax : fe.price;
}

function basePriceError(text: string): string | undefined {
  const value = text.trim();
  const error = amountError(value);
  if (error !== undefined) return error;
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

/**
 * `id` còn trong danh sách chọn thì giữ, không thì `''` (chưa chọn).
 *
 * Danh sách chọn vừa làm mới — `router.refresh()` sau `LINK_NOT_FOUND`, review S1 — đã bỏ danh mục
 * hay điểm đến bị xoá ở tab khác, mà form còn giữ id của nó. `Picker` in thẳng giá trị không khớp
 * mục nào (luật E3 của nó: không tự quay về), nên ô hiện UUID thô. Về `''` thì ô hiện câu giữ chỗ
 * và luật bắt buộc của form báo chọn lại (review G6-F4).
 *
 * Form gọi hai hàm dưới MỖI lượt render trên giá trị đang giữ, không ghi kết quả vào state: danh
 * sách là nguồn sự thật, và một mục đã xoá không bao giờ quay lại danh sách. Ghi vào state thì
 * phải canh lượt làm mới bằng state riêng, và ở tab Details còn tắt luôn cờ "đang chờ Reload"
 * của form.
 */
function listedId(list: readonly { id: string }[], id: string): string {
  return list.some((item) => item.id === id) ? id : '';
}

/**
 * Hộp New tour: danh mục và điểm đến chính đã rời danh sách chọn về `''` (xem `listedId`). Không
 * có gì phải bỏ thì trả CHÍNH `values` — lượt render thường không sinh object mới.
 */
export function clearDeletedCreateChoices(
  values: TourCreateFormValues,
  options: TourEditorOptions,
): TourCreateFormValues {
  const categoryId = listedId(options.categories, values.categoryId);
  const primaryDestinationId = listedId(options.destinations, values.primaryDestinationId);
  return categoryId === values.categoryId && primaryDestinationId === values.primaryDestinationId
    ? values
    : { ...values, categoryId, primaryDestinationId };
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

/**
 * Key của dòng dựng từ dữ liệu SERVER: tất định, tiền tố riêng cho từng danh sách
 * (vòng review F17). Form dựng lần đầu trên server (SSR) rồi dựng lại lúc
 * hydrate; key UUID ngẫu nhiên ra hai giá trị khác nhau, và id/htmlFor ghép từ
 * key lệch nhau giữa hai lần. Tiền tố riêng vì lỗi của tab Details khoá theo key
 * chung cho mọi danh sách. Dòng thêm MỚI trên trình duyệt vẫn dùng `newItemKey()`.
 */
const serverKey = (list: string, index: number) => `${list}-${index}`;

const toLines = (list: string, texts: readonly string[]): LineDraft[] =>
  texts.map((text, index) => ({ key: serverKey(list, index), text }));

/**
 * Mảng enum xếp theo thứ tự danh sách chọn (vòng review F17): ô tích dựng mảng
 * mới theo thứ tự danh sách, nên bản gốc lệch thứ tự (bốn tour seed) thì tích
 * rồi bỏ tích cũng thành "có thay đổi".
 */
function inOptionOrder<Value extends string>(
  options: readonly Value[],
  selected: readonly Value[],
): Value[] {
  return options.filter((value) => selected.includes(value));
}

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
    destinations: detail.destinations.map((link, index) => ({
      key: serverKey('dest', index),
      destinationId: link.destinationId,
      isPrimary: link.isPrimary,
    })),
    suitableFor: inOptionOrder(TravellerTypeSchema.options, detail.suitableFor),
    badges: inOptionOrder(TourBadgeSchema.options, detail.badges),
    highlights: toLines('hl', detail.highlights),
    included: toLines('inc', detail.included),
    excluded: toLines('exc', detail.excluded),
    meetingPoint: detail.meetingPoint ?? '',
    factDurationNote: detail.factDurationNote ?? '',
    factGroupSizeNote: detail.factGroupSizeNote ?? '',
    factDifficultyNote: detail.factDifficultyNote ?? '',
    factGoodForNote: detail.factGoodForNote ?? '',
  };
}

/**
 * Soi gương contract cộng ba luật phụ thuộc trạng thái server của `detail`:
 * tour đang bán (tóm tắt, thêm ngày — suy từ `onSaleShortfalls`, G11), tour có
 * chuyến (số ngày khoá), sàn ghế.
 */
export function validateTourDetailsForm(
  values: TourDetailsFormValues,
  detail: AdminTourDetail,
): TourDetailsFormErrors {
  const errors: TourDetailsFormErrors = {};
  const lines: Record<string, string> = {};

  const days = parseWholeNumber(values.durationDays);
  const daysError = wholeNumberError(values.durationDays, 1, TOUR_DURATION_MAX);
  // G11: luật "tour đang bán" suy từ readiness dự tính, không viết tay từng luật.
  // Chỉ chiếu với số ngày ĐÃ qua kiểm khoảng (vòng review F18): `tourReadiness` lặp
  // 1..N ngày, nên một số gõ tay như "1000000000" làm treo cả tab.
  const shortfalls = onSaleShortfalls(
    detail,
    projectedReadiness(detail, {
      summary: orNull(values.summary),
      destinations: values.destinations,
      durationDays: daysError === undefined ? days : detail.durationDays,
    }),
  );

  setError(errors, 'title', textError(values.title, TOUR_TITLE_MAX, true));
  if (shortfalls.summary) errors.summary = fe.summaryOnSale;
  else setError(errors, 'summary', textError(values.summary, TOUR_SUMMARY_MAX, false));
  if (values.categoryId === '') errors.categoryId = fe.chooseCategory;

  if (daysError !== undefined) errors.durationDays = daysError;
  else if (days !== detail.durationDays && detail.departureCount > 0) {
    errors.durationDays = fe.durationLocked;
  } else if (shortfalls.days.length > 0) {
    errors.durationDays = fe.addDaysOnSale;
  }

  const group = parseWholeNumber(values.maxGroupSize);
  const groupError = wholeNumberError(values.maxGroupSize, 1, TOUR_GROUP_MAX);
  if (groupError !== undefined) errors.maxGroupSize = groupError;
  else if (
    detail.liveSeatsMax !== null &&
    group < detail.liveSeatsMax &&
    // Chỉ chặn khi HẠ — cùng luật server (vòng review F17, spec §2b.2).
    group < detail.maxGroupSize
  ) {
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

/**
 * Tab Details: danh mục và từng dòng điểm đến đã rời danh sách chọn về `''` (xem `listedId`); dòng
 * giữ nguyên chỗ và cờ điểm chính. Không có gì phải bỏ thì trả CHÍNH `values` — lượt render
 * thường không sinh object mới.
 */
export function clearDeletedDetailsChoices(
  values: TourDetailsFormValues,
  options: TourEditorOptions,
): TourDetailsFormValues {
  const categoryId = listedId(options.categories, values.categoryId);
  let changed = categoryId !== values.categoryId;
  const destinations = values.destinations.map((line) => {
    const destinationId = listedId(options.destinations, line.destinationId);
    if (destinationId === line.destinationId) return line;
    changed = true;
    return { ...line, destinationId };
  });
  return changed ? { ...values, categoryId, destinations } : values;
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
  const titled = values.days.flatMap((day, index) => (day.title.trim() === '' ? [] : [index + 1]));
  const newlyMissing = new Set(
    onSaleShortfalls(detail, projectedReadiness(detail, { itineraryDays: titled })).days,
  );
  values.days.forEach((day, index) => {
    const entry: { title?: string; description?: string } = {};
    const title = day.title.trim();
    const description = day.description.trim();
    if (title === '') {
      if (newlyMissing.has(index + 1)) entry.title = fe.dayTitleOnSale;
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
    faqs: detail.faqs.map((faq, index) => ({
      key: serverKey('faq', index),
      question: faq.question,
      answer: faq.answer,
    })),
    policies: detail.policies.flatMap((policy, index) =>
      policy.kind === 'CANCELLATION'
        ? []
        : [
            {
              key: serverKey('pol', index),
              kind: policy.kind,
              title: policy.title,
              body: policy.body,
            },
          ],
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
    items: detail.costItems.map((item, index) => ({
      key: serverKey('cost', index),
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
    setError(entry, 'amount', amountError(item.amount.trim()));
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
