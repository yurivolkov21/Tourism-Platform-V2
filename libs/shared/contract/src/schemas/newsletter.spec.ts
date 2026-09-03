import {
  AdminSubscribersListQuerySchema,
  AdminSubscribersListResultSchema,
  AdminSubscriberUnsubscribeInputSchema,
  AdminSubscriberUnsubscribeResultSchema,
  SUBSCRIBER_SOURCE_MAX_LENGTH,
  SubscriberRowSchema,
} from './newsletter.js';
import { AdminSubscribersStatsSchema, STATS_WINDOW_DAYS } from './stats.js';

/**
 * Contract vùng subscribers cho ADMIN (spec P4c §3-F10). Schema là hợp đồng
 * giữa API và admin, nên test pin đúng những gì hai bên dựa vào: cờ ba-trạng-
 * thái `active`, trần của ô tìm/`source`, hình dạng row (source + hai mốc
 * nullable), danh sách `sources` đi kèm trang, và kết quả gọn của lệnh ghi.
 */

const validRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: 'footer',
  createdAt: '2026-09-01T10:00:00.000Z',
  unsubscribedAt: null,
};

describe('SUBSCRIBER_SOURCE_MAX_LENGTH', () => {
  it('là 40 — soi gương cột `subscribers.source @db.VarChar(40)`', () => {
    expect(SUBSCRIBER_SOURCE_MAX_LENGTH).toBe(40);
  });
});

describe('AdminSubscribersListQuerySchema', () => {
  it('mặc định trang 1 · 20 dòng, không filter, `includeSources` BẬT (trang bảng); export tắt nó', () => {
    expect(AdminSubscribersListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      includeSources: true,
    });
    expect(AdminSubscribersListQuerySchema.parse({ includeSources: false }).includeSources).toBe(
      false,
    );
  });

  it('`active` là BA trạng thái: true (đang nhận) · false (đã huỷ) · vắng (mọi row)', () => {
    expect(AdminSubscribersListQuerySchema.parse({ active: true }).active).toBe(true);
    expect(AdminSubscribersListQuerySchema.parse({ active: false }).active).toBe(false);
    expect(AdminSubscribersListQuerySchema.parse({}).active).toBeUndefined();
  });

  it('nhận search ≤120 và source ≤40, từ chối chuỗi rỗng/quá trần', () => {
    expect(
      AdminSubscribersListQuerySchema.parse({ search: 'ada@', source: 'footer' }),
    ).toMatchObject({ search: 'ada@', source: 'footer' });
    expect(AdminSubscribersListQuerySchema.safeParse({ search: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(AdminSubscribersListQuerySchema.safeParse({ search: '' }).success).toBe(false);
    expect(AdminSubscribersListQuerySchema.safeParse({ source: 'x'.repeat(41) }).success).toBe(
      false,
    );
    expect(AdminSubscribersListQuerySchema.safeParse({ source: '' }).success).toBe(false);
  });

  it('từ chối `active` không phải boolean và limit vượt trần 100', () => {
    expect(AdminSubscribersListQuerySchema.safeParse({ active: 'yes' }).success).toBe(false);
    expect(AdminSubscribersListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('giữ nguyên `.shape` — điều kiện để ZodSmartCoercionPlugin ép query string', () => {
    expect(Object.keys(AdminSubscribersListQuerySchema.shape)).toEqual([
      'page',
      'limit',
      'active',
      'search',
      'source',
      'includeSources',
    ]);
  });
});

describe('SubscriberRowSchema', () => {
  it('nhận một hàng đầy đủ', () => {
    expect(SubscriberRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('`source` và `unsubscribedAt` đều nullable — form footer không gửi source', () => {
    expect(
      SubscriberRowSchema.parse({ ...validRow, source: null, unsubscribedAt: null }),
    ).toMatchObject({ source: null, unsubscribedAt: null });
  });

  it('`unsubscribedAt` có giá trị là mốc ISO — dấu khách đã rút consent', () => {
    expect(
      SubscriberRowSchema.parse({ ...validRow, unsubscribedAt: '2026-09-02T08:00:00.000Z' })
        .unsubscribedAt,
    ).toBe('2026-09-02T08:00:00.000Z');
  });

  it('từ chối email sai định dạng và source vượt trần cột', () => {
    expect(SubscriberRowSchema.safeParse({ ...validRow, email: 'not-an-email' }).success).toBe(
      false,
    );
    expect(SubscriberRowSchema.safeParse({ ...validRow, source: 'x'.repeat(41) }).success).toBe(
      false,
    );
  });
});

describe('AdminSubscribersListResultSchema', () => {
  const paged = { items: [validRow], page: 1, limit: 20, total: 1, totalPages: 1 };

  it('là một trang chuẩn CỘNG `sources` — Select lọc đọc từ chính response', () => {
    expect(AdminSubscribersListResultSchema.parse({ ...paged, sources: ['footer'] })).toMatchObject(
      { total: 1, sources: ['footer'] },
    );
  });

  it('`sources` BẮT BUỘC có mặt (rỗng khi chưa row nào khai nguồn), không optional', () => {
    expect(AdminSubscribersListResultSchema.parse({ ...paged, sources: [] }).sources).toEqual([]);
    expect(AdminSubscribersListResultSchema.safeParse(paged).success).toBe(false);
  });
});

describe('AdminSubscriberUnsubscribeInputSchema', () => {
  it('chỉ nhận uuid — không có ô note, không có cờ nào khác', () => {
    expect(AdminSubscriberUnsubscribeInputSchema.parse({ id: validRow.id, extra: 'x' })).toEqual({
      id: validRow.id,
    });
    expect(AdminSubscriberUnsubscribeInputSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });
});

describe('AdminSubscriberUnsubscribeResultSchema', () => {
  it('gọn: id + mốc câu UPDATE vừa ghi, KHÔNG chở cả row', () => {
    const parsed = AdminSubscriberUnsubscribeResultSchema.parse({
      id: validRow.id,
      unsubscribedAt: '2026-09-03T09:00:00.000Z',
    });
    expect(parsed).toEqual({ id: validRow.id, unsubscribedAt: '2026-09-03T09:00:00.000Z' });
    expect(Object.keys(AdminSubscriberUnsubscribeResultSchema.shape)).toEqual([
      'id',
      'unsubscribedAt',
    ]);
  });

  it('`unsubscribedAt` KHÔNG nullable — lệnh chỉ trả về khi đã ghi được mốc', () => {
    expect(
      AdminSubscriberUnsubscribeResultSchema.safeParse({ id: validRow.id, unsubscribedAt: null })
        .success,
    ).toBe(false);
  });
});

describe('AdminSubscribersStatsSchema', () => {
  const period = {
    windowDays: STATS_WINDOW_DAYS,
    currentFrom: '2026-08-06T00:00:00.000Z',
    previousFrom: '2026-07-09T00:00:00.000Z',
    generatedAt: '2026-09-03T00:00:00.000Z',
  };

  it('hai metric neo mốc thời gian là CẶP hai kỳ, `active` là số ĐƠN', () => {
    const parsed = AdminSubscribersStatsSchema.parse({
      period,
      created: { current: 12, previous: 8 },
      unsubscribed: { current: 2, previous: 5 },
      active: 140,
    });
    expect(parsed.created).toEqual({ current: 12, previous: 8 });
    expect(parsed.unsubscribed).toEqual({ current: 2, previous: 5 });
    expect(parsed.active).toBe(140);
  });

  it('thiếu `previous` của một cặp là hỏng hợp đồng (client không tự chế delta)', () => {
    expect(
      AdminSubscribersStatsSchema.safeParse({
        period,
        created: { current: 12 },
        unsubscribed: { current: 2, previous: 5 },
        active: 140,
      }).success,
    ).toBe(false);
  });

  it('`active` là số đơn, không phải cặp — không có mốc để dựng lại đầu kỳ', () => {
    expect(
      AdminSubscribersStatsSchema.safeParse({
        period,
        created: { current: 12, previous: 8 },
        unsubscribed: { current: 2, previous: 5 },
        active: { current: 140, previous: 130 },
      }).success,
    ).toBe(false);
  });
});
