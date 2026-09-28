import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ID, DEST_A, DEST_B, detailFixture, TOUR_ID, VERSION } from '@/test/tour-detail';
import {
  CONTENT_CONTRACT_CODES,
  COSTS_CONTRACT_CODES,
  CREATE_TOUR_CONTRACT_CODES,
  contentFormValues,
  contentPayload,
  costDraftItems,
  costsFormValues,
  costsPayload,
  DELETE_TOUR_CONTRACT_CODES,
  DETAILS_CONTRACT_CODES,
  detailsFormValues,
  droppedCancellationCount,
  hasNestedErrors,
  ITINERARY_CONTRACT_CODES,
  isDeleteTourStale,
  itineraryFormValues,
  itineraryPayload,
  newTourFormValues,
  sameValues,
  type TourCreateFormValues,
  type TourDetailsFormValues,
  tourCreatePayload,
  tourDetailsPayload,
  validateContentForm,
  validateCostsForm,
  validateItineraryForm,
  validateTourCreateForm,
  validateTourDetailsForm,
} from './tour-editor-write';

/**
 * Logic ghi THUẦN của khu làm việc tour (spec F17). Luật server (trần, "tour
 * đang bán", sàn ghế) soi gương ở đây để admin thấy lỗi dưới đúng ô trước khi
 * bấm Save; server vẫn là trọng tài cuối.
 */
const fe = messages.admin.tours.editor.form.errors;
const text = (length: number) => 'x'.repeat(length);

describe('tập mã lỗi khớp contract (bài học: codec derive từ i18n, không từ contract)', () => {
  it('sáu codec phủ ĐÚNG các mã mà contract khai', () => {
    const codes = (errorMap: object) => Object.keys(errorMap).sort();
    const t = contract.admin.tours;

    expect([...CREATE_TOUR_CONTRACT_CODES].sort()).toEqual(codes(t.create['~orpc'].errorMap));
    expect([...DETAILS_CONTRACT_CODES].sort()).toEqual(codes(t.updateDetails['~orpc'].errorMap));
    expect([...ITINERARY_CONTRACT_CODES].sort()).toEqual(codes(t.setItinerary['~orpc'].errorMap));
    expect([...CONTENT_CONTRACT_CODES].sort()).toEqual(codes(t.setFaqsPolicies['~orpc'].errorMap));
    expect([...COSTS_CONTRACT_CODES].sort()).toEqual(codes(t.setCosts['~orpc'].errorMap));
    expect([...DELETE_TOUR_CONTRACT_CODES].sort()).toEqual(codes(t.delete['~orpc'].errorMap));
  });

  it('xoá: NOT_FOUND là trạng-thái-cũ, TOUR_HAS_BOOKINGS thì không', () => {
    expect(isDeleteTourStale('NOT_FOUND')).toBe(true);
    expect(isDeleteTourStale('TOUR_HAS_BOOKINGS')).toBe(false);
  });
});

describe('hộp New tour', () => {
  const VALID: TourCreateFormValues = {
    title: 'Hoi An Lantern Walk',
    slug: 'hoi-an-lantern-walk',
    categoryId: CATEGORY_ID,
    primaryDestinationId: DEST_A,
    durationDays: '1',
    maxGroupSize: '10',
    basePrice: '45.00',
  };

  it('giá trị ban đầu toàn chuỗi rỗng', () => {
    expect(newTourFormValues()).toEqual({
      title: '',
      slug: '',
      categoryId: '',
      primaryDestinationId: '',
      durationDays: '',
      maxGroupSize: '',
      basePrice: '',
    });
  });

  it('form hợp lệ thì không có lỗi nào', () => {
    expect(validateTourCreateForm(VALID)).toEqual({});
  });

  it.each<[string, Partial<TourCreateFormValues>, keyof TourCreateFormValues, string | undefined]>([
    ['tên trống', { title: '  ' }, 'title', fe.required],
    ['tên 160', { title: text(160) }, 'title', undefined],
    ['tên 161', { title: text(161) }, 'title', fe.tooLong(160)],
    ['slug trống', { slug: '' }, 'slug', fe.required],
    ['slug sai khuôn', { slug: 'Ha Long' }, 'slug', fe.slugShape],
    ['slug 120', { slug: text(120) }, 'slug', undefined],
    ['slug 121', { slug: text(121) }, 'slug', fe.tooLong(120)],
    ['chưa chọn danh mục', { categoryId: '' }, 'categoryId', fe.chooseCategory],
    [
      'chưa chọn điểm đến',
      { primaryDestinationId: '' },
      'primaryDestinationId',
      fe.chooseDestination,
    ],
    ['số ngày trống', { durationDays: '' }, 'durationDays', fe.wholeNumber(1, 30)],
    ['số ngày 0', { durationDays: '0' }, 'durationDays', fe.wholeNumber(1, 30)],
    ['số ngày 31', { durationDays: '31' }, 'durationDays', fe.wholeNumber(1, 30)],
    ['số ngày 2.5', { durationDays: '2.5' }, 'durationDays', fe.wholeNumber(1, 30)],
    ['số ngày chữ', { durationDays: 'abc' }, 'durationDays', fe.wholeNumber(1, 30)],
    ['số ngày 1', { durationDays: '1' }, 'durationDays', undefined],
    ['số ngày 30', { durationDays: '30' }, 'durationDays', undefined],
    ['số khách 0', { maxGroupSize: '0' }, 'maxGroupSize', fe.wholeNumber(1, 100)],
    ['số khách 101', { maxGroupSize: '101' }, 'maxGroupSize', fe.wholeNumber(1, 100)],
    ['số khách 1', { maxGroupSize: '1' }, 'maxGroupSize', undefined],
    ['số khách 100', { maxGroupSize: '100' }, 'maxGroupSize', undefined],
    ['giá trống', { basePrice: '' }, 'basePrice', fe.price],
    ['giá 0', { basePrice: '0' }, 'basePrice', fe.priceAboveZero],
    ['giá 3 chữ số lẻ', { basePrice: '1.234' }, 'basePrice', fe.price],
    ['giá 0.01', { basePrice: '0.01' }, 'basePrice', undefined],
  ])('%s', (_name, patch, field, error) => {
    expect(validateTourCreateForm({ ...VALID, ...patch })[field]).toBe(error);
  });

  it('payload cắt khoảng trắng và đổi số ngày, số khách ra số', () => {
    expect(
      tourCreatePayload({
        ...VALID,
        title: '  Hoi An Lantern Walk ',
        slug: ' hoi-an-lantern-walk ',
        durationDays: ' 2 ',
        maxGroupSize: '12',
        basePrice: ' 45.50 ',
      }),
    ).toEqual({
      title: 'Hoi An Lantern Walk',
      slug: 'hoi-an-lantern-walk',
      categoryId: CATEGORY_ID,
      primaryDestinationId: DEST_A,
      durationDays: 2,
      maxGroupSize: 12,
      basePrice: '45.50',
    });
  });
});

describe('tab Details', () => {
  const detail = detailFixture();
  const withValues = (patch: Partial<TourDetailsFormValues>): TourDetailsFormValues => ({
    ...detailsFormValues(detail),
    ...patch,
  });

  it('mở ra rồi lưu nguyên: payload tương đương tour, mảng dòng không mang key', () => {
    const payload = tourDetailsPayload(TOUR_ID, VERSION, detailsFormValues(detail));

    expect(payload).toEqual({
      id: TOUR_ID,
      version: VERSION,
      title: detail.title,
      summary: detail.summary,
      categoryId: detail.categoryId,
      difficulty: detail.difficulty,
      isFeatured: detail.isFeatured,
      durationDays: detail.durationDays,
      maxGroupSize: detail.maxGroupSize,
      basePrice: detail.basePrice,
      destinations: detail.destinations,
      suitableFor: detail.suitableFor,
      badges: detail.badges,
      highlights: detail.highlights,
      included: detail.included,
      excluded: detail.excluded,
      meetingPoint: detail.meetingPoint,
      factDurationNote: null,
      factGroupSizeNote: null,
      factDifficultyNote: null,
      factGoodForNote: null,
    });
    expect(payload.destinations[0]).not.toHaveProperty('key');
  });

  it('ô chữ trống thành null, độ khó "Not set" thành null', () => {
    const payload = tourDetailsPayload(
      TOUR_ID,
      VERSION,
      withValues({ meetingPoint: '  ', difficulty: '', factGoodForNote: ' Couples ' }),
    );
    expect(payload.meetingPoint).toBeNull();
    expect(payload.difficulty).toBeNull();
    expect(payload.factGoodForNote).toBe('Couples');
  });

  it('không đổi gì thì không có lỗi nào', () => {
    expect(validateTourDetailsForm(detailsFormValues(detail), detail)).toEqual({});
  });

  it('tóm tắt trống: đang bán thì chặn, tắt bán thì được', () => {
    expect(validateTourDetailsForm(withValues({ summary: ' ' }), detail).summary).toBe(
      fe.summaryOnSale,
    );
    const offSale = detailFixture({ isPublished: false });
    expect(
      validateTourDetailsForm({ ...detailsFormValues(offSale), summary: '' }, offSale).summary,
    ).toBeUndefined();
  });

  it('G11: tour đang bán ĐÃ thiếu tóm tắt từ trước — sửa ô khác không bị đổ lỗi tóm tắt', () => {
    const legacy = detailFixture({ summary: null });
    const values = { ...detailsFormValues(legacy), title: 'Renamed' };
    expect(validateTourDetailsForm(values, legacy).summary).toBeUndefined();
  });

  it('đang bán: tăng số ngày bị chặn, giảm thì được', () => {
    expect(validateTourDetailsForm(withValues({ durationDays: '4' }), detail).durationDays).toBe(
      fe.addDaysOnSale,
    );
    expect(
      validateTourDetailsForm(withValues({ durationDays: '2' }), detail).durationDays,
    ).toBeUndefined();
  });

  it('có chuyến thì số ngày khoá — cả tăng lẫn giảm', () => {
    const locked = detailFixture({ departureCount: 2, isPublished: false });
    // Tour TẮT bán để chiều tăng không vướng luật "đang bán thì không thêm ngày".
    for (const durationDays of ['2', '4']) {
      expect(
        validateTourDetailsForm({ ...detailsFormValues(locked), durationDays }, locked)
          .durationDays,
      ).toBe(fe.durationLocked);
    }
  });

  it('sàn số khách là số ghế lớn nhất của chuyến chưa về', () => {
    const floored = detailFixture({ liveSeatsMax: 12, maxGroupSize: 20 });
    const values = detailsFormValues(floored);
    expect(validateTourDetailsForm({ ...values, maxGroupSize: '11' }, floored).maxGroupSize).toBe(
      fe.groupFloor(12),
    );
    expect(
      validateTourDetailsForm({ ...values, maxGroupSize: '12' }, floored).maxGroupSize,
    ).toBeUndefined();
  });

  it('dữ liệu đã lệch (chuyến nhiều ghế hơn số khách): giữ nguyên hay nâng thì qua, hạ thì chặn', () => {
    // Cùng luật server sau vòng review F17 — "tăng thì luôn được" (spec §2b.2).
    const drifted = detailFixture({ liveSeatsMax: 20, maxGroupSize: 12 });
    const values = detailsFormValues(drifted);
    const groupError = (maxGroupSize: string) =>
      validateTourDetailsForm({ ...values, maxGroupSize }, drifted).maxGroupSize;

    expect(groupError('12')).toBeUndefined();
    expect(groupError('15')).toBeUndefined();
    expect(groupError('11')).toBe(fe.groupFloor(20));
  });

  it('giá gốc có trần 999,999.99 — câu riêng, không phải câu "sai khuôn"', () => {
    const priceError = (basePrice: string) =>
      validateTourDetailsForm(withValues({ basePrice }), detail).basePrice;

    expect(priceError('999999.99')).toBeUndefined();
    expect(priceError('1000000')).toBe(fe.priceMax);
    expect(priceError('12.345')).toBe(fe.price);
  });

  it('payload: bốn ghi chú dữ kiện đi ĐÚNG field của mình', () => {
    const payload = tourDetailsPayload(
      TOUR_ID,
      VERSION,
      withValues({
        factDurationNote: 'duration',
        factGroupSizeNote: 'group',
        factDifficultyNote: 'difficulty',
        factGoodForNote: 'good for',
      }),
    );
    expect(payload).toMatchObject({
      factDurationNote: 'duration',
      factGroupSizeNote: 'group',
      factDifficultyNote: 'difficulty',
      factGoodForNote: 'good for',
    });
  });

  it('dòng dựng từ dữ liệu server mang key TẤT ĐỊNH — SSR và hydrate ra cùng id', () => {
    // Vòng review F17: key là UUID ngẫu nhiên thì server và trình duyệt sinh hai
    // key khác nhau, và id/htmlFor ghép từ key lệch nhau lúc hydrate.
    const rich = detailFixture({
      destinations: [
        { destinationId: DEST_A, isPrimary: true },
        { destinationId: DEST_B, isPrimary: false },
      ],
      highlights: ['A', 'B'],
      included: ['Meals'],
      excluded: ['Tips'],
    });
    const first = detailsFormValues(rich);

    expect(detailsFormValues(rich)).toEqual(first);
    expect(first.destinations.map((line) => line.key)).toEqual(['dest-0', 'dest-1']);
    expect(first.highlights.map((line) => line.key)).toEqual(['hl-0', 'hl-1']);
    expect(first.included[0]?.key).toBe('inc-0');
    expect(first.excluded[0]?.key).toBe('exc-0');
  });

  it('Good for và Badges chuẩn hoá theo thứ tự danh sách ngay khi mở — tích rồi bỏ tích không thành "có thay đổi"', () => {
    // Bốn tour seed lưu suitableFor lệch thứ tự danh sách (vd FRIENDS, SOLO,
    // COUPLE); ô tích dựng lại theo thứ tự danh sách nên bản gốc phải cùng dạng.
    const unordered = detailFixture({
      suitableFor: ['FRIENDS', 'SOLO', 'COUPLE'],
      badges: ['POPULAR', 'BEST_VALUE'],
    });

    expect(detailsFormValues(unordered).suitableFor).toEqual(['COUPLE', 'FRIENDS', 'SOLO']);
    expect(detailsFormValues(unordered).badges).toEqual(['BEST_VALUE', 'POPULAR']);
  });

  it('điểm đến: trùng thì lỗi ở dòng SAU, chưa chọn thì lỗi ở dòng ấy, rỗng thì lỗi cả khung', () => {
    const values = withValues({
      destinations: [
        { key: 'a', destinationId: DEST_A, isPrimary: true },
        { key: 'b', destinationId: '', isPrimary: false },
        { key: 'c', destinationId: DEST_A, isPrimary: false },
      ],
    });
    expect(validateTourDetailsForm(values, detail).lines).toEqual({
      b: fe.chooseDestination,
      c: fe.duplicateDestination,
    });
    expect(validateTourDetailsForm(withValues({ destinations: [] }), detail).destinations).toBe(
      fe.chooseDestination,
    );
    expect(
      validateTourDetailsForm(
        withValues({
          destinations: [
            { key: 'a', destinationId: DEST_A, isPrimary: true },
            { key: 'b', destinationId: DEST_B, isPrimary: false },
          ],
        }),
        detail,
      ).lines,
    ).toBeUndefined();
  });

  it('dòng chữ: trống thì emptyLine, 200 qua, 201 bị bắt', () => {
    const values = withValues({
      highlights: [
        { key: 'h1', text: '  ' },
        { key: 'h2', text: text(200) },
      ],
      excluded: [{ key: 'e1', text: text(201) }],
    });
    expect(validateTourDetailsForm(values, detail).lines).toEqual({
      h1: fe.emptyLine,
      e1: fe.tooLong(200),
    });
  });

  it('điểm hẹn 300/301, ghi chú dữ kiện 280/281', () => {
    expect(
      validateTourDetailsForm(withValues({ meetingPoint: text(300) }), detail).meetingPoint,
    ).toBeUndefined();
    expect(
      validateTourDetailsForm(withValues({ meetingPoint: text(301) }), detail).meetingPoint,
    ).toBe(fe.tooLong(300));
    expect(
      validateTourDetailsForm(withValues({ factDurationNote: text(280) }), detail).factDurationNote,
    ).toBeUndefined();
    expect(
      validateTourDetailsForm(withValues({ factDurationNote: text(281) }), detail).factDurationNote,
    ).toBe(fe.tooLong(280));
  });

  it('tên trống hay giá 0 dùng chung luật với hộp New tour', () => {
    const errors = validateTourDetailsForm(withValues({ title: '', basePrice: '0' }), detail);
    expect(errors.title).toBe(fe.required);
    expect(errors.basePrice).toBe(fe.priceAboveZero);
  });
});

describe('tab Itinerary', () => {
  const fourDays = detailFixture({
    isPublished: false,
    durationDays: 4,
    itinerary: [
      { dayNumber: 1, title: 'Arrive', description: '09:00 — Pick-up at your hotel' },
      { dayNumber: 3, title: 'Caves', description: null },
    ],
  });

  it('đủ N ô; ngày chưa có hàng thì ô trống', () => {
    expect(itineraryFormValues(fourDays).days).toEqual([
      { title: 'Arrive', description: '09:00 — Pick-up at your hotel' },
      { title: '', description: '' },
      { title: 'Caves', description: '' },
      { title: '', description: '' },
    ]);
  });

  it('payload chỉ gửi ngày có tiêu đề, cắt khoảng trắng, mô tả trống thành null', () => {
    const values = itineraryFormValues(fourDays);
    values.days[3] = { title: '  Home ', description: '  ' };
    expect(itineraryPayload(TOUR_ID, VERSION, values)).toEqual({
      id: TOUR_ID,
      version: VERSION,
      days: [
        { dayNumber: 1, title: 'Arrive', description: '09:00 — Pick-up at your hotel' },
        { dayNumber: 3, title: 'Caves', description: null },
        { dayNumber: 4, title: 'Home', description: null },
      ],
    });
  });

  it('tour ĐANG bán mà một tiêu đề trống thì lỗi ở đúng ngày; tắt bán thì không', () => {
    const onSale = detailFixture();
    const values = itineraryFormValues(onSale);
    values.days[1] = { title: '', description: '' };
    expect(validateItineraryForm(values, onSale)).toEqual({ 2: { title: fe.dayTitleOnSale } });

    expect(validateItineraryForm(itineraryFormValues(fourDays), fourDays)).toEqual({});
  });

  it('G11: ngày vốn trống từ trước (dữ liệu cũ) không bị báo dayTitleOnSale', () => {
    const legacy = detailFixture({
      itinerary: [
        { dayNumber: 1, title: 'One', description: null },
        { dayNumber: 2, title: 'Two', description: null },
      ],
    });
    expect(validateItineraryForm(itineraryFormValues(legacy), legacy)).toEqual({});
  });

  it('có mô tả mà không tiêu đề thì nhắc — ngày không tiêu đề không được lưu', () => {
    const values = itineraryFormValues(fourDays);
    values.days[1] = { title: '', description: 'Free day' };
    expect(validateItineraryForm(values, fourDays)).toEqual({
      2: { description: fe.descriptionWithoutTitle },
    });
  });

  it('tiêu đề 200/201, mô tả 2000/2001', () => {
    const values = itineraryFormValues(fourDays);
    values.days[0] = { title: text(200), description: text(2000) };
    values.days[1] = { title: text(201), description: text(2001) };
    expect(validateItineraryForm(values, fourDays)).toEqual({
      2: { title: fe.tooLong(200), description: fe.tooLong(2000) },
    });
  });
});

describe('tab FAQ & policies', () => {
  const detail = detailFixture({
    faqs: [
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
    ],
    policies: [
      { kind: 'BOOKING', title: 'Deposit', body: 'Pay in full.' },
      { kind: 'CANCELLATION', title: 'Old', body: 'Old rule.' },
      { kind: 'GENERAL', title: 'Weather', body: 'We sail when safe.' },
    ],
  });

  it('chính sách huỷ cũ bị BỎ khỏi form và được đếm để báo — không im lặng', () => {
    const values = contentFormValues(detail);
    expect(values.policies.map((policy) => policy.title)).toEqual(['Deposit', 'Weather']);
    expect(droppedCancellationCount(detail)).toBe(1);
    expect(droppedCancellationCount(detailFixture())).toBe(0);
  });

  it('payload giữ đúng thứ tự trên màn hình, cắt khoảng trắng, bỏ key', () => {
    const values = contentFormValues(detail);
    values.faqs.reverse();
    const first = values.faqs[0];
    if (first) first.answer = ' A2 ';
    const payload = contentPayload(TOUR_ID, VERSION, values);
    expect(payload.faqs).toEqual([
      { question: 'Q2?', answer: 'A2' },
      { question: 'Q1?', answer: 'A1' },
    ]);
    expect(payload.policies).toEqual([
      { kind: 'BOOKING', title: 'Deposit', body: 'Pay in full.' },
      { kind: 'GENERAL', title: 'Weather', body: 'We sail when safe.' },
    ]);
  });

  it('ô trống → required; trần từng ô N qua, N+1 bị bắt', () => {
    const errors = validateContentForm({
      faqs: [
        { key: 'f1', question: '', answer: 'A' },
        { key: 'f2', question: text(300), answer: text(2000) },
        { key: 'f3', question: text(301), answer: text(2001) },
      ],
      policies: [
        { key: 'p1', kind: 'GENERAL', title: ' ', body: '' },
        { key: 'p2', kind: 'BOOKING', title: text(200), body: text(4000) },
        { key: 'p3', kind: 'BOOKING', title: text(201), body: text(4001) },
      ],
    });
    expect(errors).toEqual({
      f1: { question: fe.required },
      f3: { question: fe.tooLong(300), answer: fe.tooLong(2000) },
      p1: { title: fe.required, body: fe.required },
      p3: { title: fe.tooLong(200), body: fe.tooLong(4000) },
    });
  });
});

describe('tab Costs', () => {
  const detail = detailFixture({
    costItems: [
      { category: 'MEALS', label: 'Lunch', amount: '8.50', basis: 'PER_PERSON' },
      { category: 'TRANSPORT', label: 'Boat', amount: '100.01', basis: 'PER_DEPARTURE' },
    ],
  });

  it('nhãn trống/121 và số tiền sai khuôn bị bắt; 0 và nhãn 120 qua', () => {
    const errors = validateCostsForm({
      items: [
        { key: 'c1', category: 'MEALS', label: '', amount: '-1', basis: 'PER_PERSON' },
        { key: 'c2', category: 'MEALS', label: text(121), amount: '1.234', basis: 'PER_PERSON' },
        { key: 'c3', category: 'MEALS', label: text(120), amount: 'abc', basis: 'PER_PERSON' },
        { key: 'c4', category: 'OTHER', label: 'Free ticket', amount: '0', basis: 'PER_PERSON' },
      ],
    });
    expect(errors).toEqual({
      c1: { label: fe.required, amount: fe.price },
      c2: { label: fe.tooLong(120), amount: fe.price },
      c3: { amount: fe.price },
    });
  });

  it('số tiền một dòng có trần 999,999.99 — câu riêng', () => {
    const errors = validateCostsForm({
      items: [
        { key: 'c1', category: 'OTHER', label: 'Big', amount: '1000000', basis: 'PER_PERSON' },
        { key: 'c2', category: 'OTHER', label: 'Max', amount: '999999.99', basis: 'PER_PERSON' },
      ],
    });
    expect(errors).toEqual({ c1: { amount: fe.priceMax } });
  });

  it('dòng chi phí và dòng FAQ, chính sách dựng từ server mang key tất định', () => {
    expect(costsFormValues(detail).items.map((item) => item.key)).toEqual(['cost-0', 'cost-1']);
    const content = contentFormValues(
      detailFixture({
        faqs: [{ question: 'Q?', answer: 'A' }],
        policies: [{ kind: 'GENERAL', title: 'T', body: 'B' }],
      }),
    );
    expect(content.faqs[0]?.key).toBe('faq-0');
    expect(content.policies[0]?.key).toBe('pol-0');
  });

  it('payload giữ thứ tự, cắt khoảng trắng, bỏ key', () => {
    const values = costsFormValues(detail);
    values.items.reverse();
    const first = values.items[0];
    if (first) first.label = ' Boat ride ';
    expect(costsPayload(TOUR_ID, VERSION, values)).toEqual({
      id: TOUR_ID,
      version: VERSION,
      items: [
        { category: 'TRANSPORT', label: 'Boat ride', amount: '100.01', basis: 'PER_DEPARTURE' },
        { category: 'MEALS', label: 'Lunch', amount: '8.50', basis: 'PER_PERSON' },
      ],
    });
  });

  it('costDraftItems chỉ trả dòng có số tiền hợp lệ — tổng không nhảy NaN khi đang gõ dở', () => {
    const values = costsFormValues(detail);
    values.items.push({
      key: 'dở',
      category: 'GUIDE',
      label: 'Guide',
      amount: '12.',
      basis: 'PER_PERSON',
    });
    expect(costDraftItems(values)).toEqual([
      { amount: '8.50', basis: 'PER_PERSON' },
      { amount: '100.01', basis: 'PER_DEPARTURE' },
    ]);
  });
});

describe('cờ "có thay đổi" và đếm lỗi lồng', () => {
  it('sameValues bỏ qua key của dòng; đổi một chữ là khác', () => {
    const detail = detailFixture();
    const a = detailsFormValues(detail);
    // Dòng thêm mới trên trình duyệt mang key UUID — cùng chữ thì vẫn là "không đổi".
    const b = { ...a, highlights: a.highlights.map((line) => ({ ...line, key: 'client-key' })) };
    expect(sameValues(a, b)).toBe(true);
    expect(sameValues(a, { ...b, title: 'Renamed' })).toBe(false);
  });

  it('hasNestedErrors chỉ đếm khoá có giá trị', () => {
    expect(hasNestedErrors({})).toBe(false);
    expect(hasNestedErrors({ a: {} })).toBe(false);
    expect(hasNestedErrors({ a: { label: 'x' } })).toBe(true);
  });
});
