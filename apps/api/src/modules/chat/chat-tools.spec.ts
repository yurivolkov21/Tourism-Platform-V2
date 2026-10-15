import type { Paged, TourCard, TourDetail, ToursListQuery } from '@tourism/contract';
import { vi } from 'vitest';
import {
  type ChatToolDeps,
  createChatTools,
  toSearchQuery,
  toSearchResult,
  toTourDetailsResult,
} from './chat-tools.js';

function card(overrides: Partial<TourCard> = {}): TourCard {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'ha-long-2d1n',
    title: 'Ha Long Bay 2D1N',
    summary: 'Overnight cruise',
    basePrice: '199.00',
    compareAtPrice: null,
    priceFrom: '189.00',
    currency: 'USD',
    durationDays: 2,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [
      { slug: 'hanoi', name: 'Hanoi', isPrimary: false },
      { slug: 'ha-long', name: 'Ha Long Bay', isPrimary: true },
    ],
    category: { slug: 'cruise', name: 'Cruise' },
    ratingAvg: 4.6,
    ratingCount: 18,
    cover: null,
    ...overrides,
  };
}

function departure(day: number, bookable: boolean): TourDetail['departures'][number] {
  const date = `2026-11-${String(day).padStart(2, '0')}`;
  return {
    id: `00000000-0000-4000-8000-0000000000${String(day).padStart(2, '0')}`,
    startDate: date,
    endDate: date,
    seatsLeft: day,
    effectivePrice: '189.00',
    compareAtPrice: null,
    bookingDeadline: date,
    bookable,
  };
}

function detail(overrides: Partial<TourDetail> = {}): TourDetail {
  return {
    ...card(),
    suitableFor: ['COUPLE'],
    badges: [],
    included: ['Cabin'],
    excluded: ['Drinks'],
    highlights: ['Kayaking'],
    meetingPoint: 'Hanoi Old Quarter',
    factDurationNote: null,
    factGroupSizeNote: null,
    factDifficultyNote: null,
    factGoodForNote: null,
    itinerary: [
      { dayNumber: 1, title: 'Board the cruise', description: 'x'.repeat(500) },
      { dayNumber: 2, title: 'Back to Hanoi', description: null },
    ],
    faqs: Array.from({ length: 8 }, (_, i) => ({
      question: `Q${i + 1}?`,
      answer: 'y'.repeat(i === 0 ? 400 : 20),
    })),
    policies: [{ kind: 'BOOKING', title: 'Deposit', body: 'Pay in full at booking.' }],
    departures: [
      departure(1, false),
      ...Array.from({ length: 8 }, (_, i) => departure(i + 2, true)),
    ],
    media: [],
    ...overrides,
  };
}

describe('toSearchQuery', () => {
  it('mặc định: mới nhất, 8 tour, trang 1', () => {
    expect(toSearchQuery({})).toMatchObject({
      page: 1,
      limit: 8,
      sort: 'createdAt',
      order: 'desc',
    });
  });

  it.each([
    ['price-asc', 'basePrice', 'asc'],
    ['price-desc', 'basePrice', 'desc'],
    ['newest', 'createdAt', 'desc'],
  ] as const)('sort %s → %s %s', (sort, column, order) => {
    expect(toSearchQuery({ sort })).toMatchObject({ sort: column, order });
  });

  it('chuyển nguyên slug điểm đến, danh mục và chữ tìm', () => {
    expect(
      toSearchQuery({ destination: 'ha-long', category: 'cruise', search: 'kayak' }),
    ).toMatchObject({ destination: 'ha-long', category: 'cruise', search: 'kayak' });
  });
});

describe('toSearchResult', () => {
  it('giữ đúng các field của spec §2c, link nội bộ', () => {
    const paged: Paged<TourCard> = {
      items: [card()],
      page: 1,
      limit: 8,
      total: 11,
      totalPages: 2,
    };
    expect(toSearchResult(paged)).toEqual({
      total: 11,
      tours: [
        {
          slug: 'ha-long-2d1n',
          title: 'Ha Long Bay 2D1N',
          url: '/tours/ha-long-2d1n',
          priceFrom: '189.00',
          currency: 'USD',
          durationDays: 2,
          destinations: ['Ha Long Bay', 'Hanoi'],
          ratingAvg: 4.6,
        },
      ],
    });
  });
});

describe('toTourDetailsResult', () => {
  const result = toTourDetailsResult(detail());

  it('link xem và link đặt là đường dẫn nội bộ', () => {
    expect(result.url).toBe('/tours/ha-long-2d1n');
    expect(result.bookUrl).toBe('/tours/ha-long-2d1n/book');
  });

  it('lịch trình: mỗi ngày một dòng, mô tả cắt 200 ký tự', () => {
    expect(result.itinerary).toHaveLength(2);
    expect(result.itinerary[0]?.day).toBe(1);
    expect(result.itinerary[0]?.description?.length).toBeLessThanOrEqual(200);
    expect(result.itinerary[1]?.description).toBeNull();
  });

  it('đợt khởi hành: chỉ đợt còn đặt được, tối đa 6, gần nhất trước', () => {
    expect(result.departures).toHaveLength(6);
    expect(result.departures[0]).toEqual({ date: '2026-11-02', price: '189.00', seatsLeft: 2 });
    expect(result.departures.map((d) => d.date)).not.toContain('2026-11-01');
  });

  it('FAQ: tối đa 6 câu, câu trả lời cắt 300 ký tự', () => {
    expect(result.faqs).toHaveLength(6);
    expect(result.faqs[0]?.answer.length).toBeLessThanOrEqual(300);
    expect(result.faqs[0]?.answer.endsWith('…')).toBe(true);
    expect(result.faqs[1]?.answer).toBe('y'.repeat(20));
  });

  it('luật huỷ sinh từ độ dài chuyến như trang tour (ADR-0041)', () => {
    expect(result.cancellation).toContain('3 days before departure');
    expect(toTourDetailsResult(detail({ durationDays: 1 })).cancellation).toContain(
      '1 day before departure',
    );
  });

  it('không mang ảnh, id hay số liệu nội bộ', () => {
    const json = JSON.stringify(result);
    expect(json).not.toContain('00000000-0000');
    expect(result).not.toHaveProperty('media');
    expect(result).not.toHaveProperty('cover');
  });
});

describe('createChatTools', () => {
  const tour = { id: '00000000-0000-4000-8000-0000000000aa', title: 'Ha Long Bay 2D1N' };

  function deps(overrides: Partial<ChatToolDeps> = {}): ChatToolDeps {
    return {
      catalog: {
        listTours: vi.fn(
          async (_query: ToursListQuery): Promise<Paged<TourCard>> => ({
            items: [card()],
            page: 1,
            limit: 8,
            total: 1,
            totalPages: 1,
          }),
        ),
        getTourBySlug: vi.fn(async (slug: string) => (slug === 'ha-long-2d1n' ? detail() : null)),
      },
      enquiries: { create: vi.fn(async () => ({ id: 'enq-1' })) },
      findPublishedTour: vi.fn(async (slug: string) => (slug === 'ha-long-2d1n' ? tour : null)),
      hasEnquiry: vi.fn(async () => false),
      linkEnquiry: vi.fn(async () => {}),
      userId: 'user-1',
      ...overrides,
    };
  }

  const call = { toolCallId: 'c1', messages: [], context: {} } as never;
  const enquiryInput = { name: 'An Nguyen', email: 'an@example.com', message: 'Is there space?' };

  it('searchTours gọi listTours với truy vấn đã map', async () => {
    const d = deps();
    const { tools } = createChatTools(d);
    const out = await tools.searchTours.execute({ sort: 'price-asc' }, call);
    expect(d.catalog.listTours).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 8, sort: 'basePrice', order: 'asc' }),
    );
    expect(out).toMatchObject({ total: 1 });
  });

  it('getTourDetails không thấy tour → found: false', async () => {
    const { tools } = createChatTools(deps());
    expect(await tools.getTourDetails.execute({ slug: 'nope' }, call)).toEqual({ found: false });
    expect(await tools.getTourDetails.execute({ slug: 'ha-long-2d1n' }, call)).toMatchObject({
      found: true,
      title: 'Ha Long Bay 2D1N',
    });
  });

  it('submitEnquiry gắn tour đang bán và người dùng, rồi ghi enquiry vào hội thoại', async () => {
    const d = deps();
    const { tools } = createChatTools(d);
    const out = await tools.submitEnquiry.execute(
      { ...enquiryInput, tourSlug: 'ha-long-2d1n', groupSize: 2 },
      call,
    );
    expect(out).toEqual({ sent: true });
    expect(d.enquiries.create).toHaveBeenCalledWith(
      {
        name: 'An Nguyen',
        email: 'an@example.com',
        message: 'Is there space?',
        tourId: tour.id,
        groupSize: 2,
        interests: [],
      },
      'user-1',
    );
    expect(d.linkEnquiry).toHaveBeenCalledWith('enq-1');
  });

  it('submitEnquiry với slug không còn bán → enquiry chung', async () => {
    const d = deps();
    const { tools } = createChatTools(d);
    await tools.submitEnquiry.execute({ ...enquiryInput, tourSlug: 'gone-tour' }, call);
    expect(d.enquiries.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ tourId: expect.anything() }),
      'user-1',
    );
  });

  it('hội thoại đã có enquiry → already_sent, không gọi service', async () => {
    const d = deps({ hasEnquiry: vi.fn(async () => true) });
    const { tools } = createChatTools(d);
    expect(await tools.submitEnquiry.execute(enquiryInput, call)).toEqual({
      sent: false,
      reason: 'already_sent',
    });
    expect(d.enquiries.create).not.toHaveBeenCalled();
    expect(d.linkEnquiry).not.toHaveBeenCalled();
  });

  describe('toolApproval', () => {
    it('luôn cần khách bấm; tên tour đi kèm để thẻ hiện trước khi gửi', async () => {
      const { toolApproval } = createChatTools(deps());
      expect(
        await toolApproval.submitEnquiry({ ...enquiryInput, tourSlug: 'ha-long-2d1n' }),
      ).toEqual({ type: 'user-approval', reason: 'Ha Long Bay 2D1N' });
      expect(await toolApproval.submitEnquiry(enquiryInput)).toEqual({ type: 'user-approval' });
    });

    it('slug không phải tour đang bán → thẻ không có tên tour, như enquiry chung được gửi', async () => {
      const { toolApproval } = createChatTools(deps());
      expect(await toolApproval.submitEnquiry({ ...enquiryInput, tourSlug: 'gone' })).toEqual({
        type: 'user-approval',
      });
    });
  });
});
