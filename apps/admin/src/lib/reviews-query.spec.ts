import { AdminReviewsQuerySchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  parseReviewState,
  parseReviewsSearchParams,
  reviewsHref,
  toReviewsListInput,
} from './reviews-query';

/**
 * Trạng thái hàng đợi `/reviews` sống TRÊN URL như hai vùng trước (spec P4b
 * §2.2). Khác biệt của vùng này nằm ở CHỖ NỐI với contract:
 * `AdminReviewsQuerySchema` extend `PageQuerySchema` nên field số dòng tên
 * **`pageSize`**, còn kit `table-query.ts` (và hai schema list kia) gọi là
 * `limit` — nên có hàm `toReviewsListInput` riêng, và bộ test dưới cùng khoá
 * đúng chỗ đó lại.
 */
describe('parseReviewsSearchParams', () => {
  it('không param nào → trang 1, limit mặc định, KHÔNG filter (contract: bỏ trống = tất cả)', () => {
    expect(parseReviewsSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('phân trang dùng CHUNG luật clamp của kit (page rác → 1, limit vượt trần → mặc định)', () => {
    expect(parseReviewsSearchParams({ page: '0', limit: '500' })).toEqual({ page: 1, limit: 20 });
    expect(parseReviewsSearchParams({ page: '4', limit: '10' })).toEqual({ page: 4, limit: 10 });
  });

  it('hai trạng thái duyệt lọc được: pending (chờ) và approved (đã lên trang tour)', () => {
    expect(parseReviewsSearchParams({ status: 'pending' })).toEqual({
      page: 1,
      limit: 20,
      state: 'pending',
    });
    expect(parseReviewsSearchParams({ status: 'approved' })).toEqual({
      page: 1,
      limit: 20,
      state: 'approved',
    });
  });

  it('status lạ (kể cả "true"/enum của vùng khác) bị BỎ, không ném lỗi — URL do người gõ', () => {
    expect(parseReviewsSearchParams({ status: 'true' })).toEqual({ page: 1, limit: 20 });
    expect(parseReviewsSearchParams({ status: 'REQUESTED' })).toEqual({ page: 1, limit: 20 });
    expect(parseReviewsSearchParams({ status: 'PENDING' })).toEqual({ page: 1, limit: 20 });
  });

  it('q được trim; rỗng/toàn khoảng trắng = không lọc', () => {
    expect(parseReviewsSearchParams({ q: '  cruise  ' })).toEqual({
      page: 1,
      limit: 20,
      search: 'cruise',
    });
    expect(parseReviewsSearchParams({ q: '   ' })).toEqual({ page: 1, limit: 20 });
  });

  it('q cắt đúng trần 100 của AdminReviewsQuerySchema — KHÔNG phải 120 như bookings', () => {
    // Gửi thẳng chuỗi 200 ký tự là ăn 400 ở lớp validate; cắt tại đây thì
    // admin dán nhầm cả đoạn văn vẫn tìm được.
    const query = parseReviewsSearchParams({ q: 'a'.repeat(200) });
    expect(query.search).toHaveLength(100);
  });

  it('param lặp lấy giá trị đầu', () => {
    expect(parseReviewsSearchParams({ status: ['approved', 'pending'] })).toEqual({
      page: 1,
      limit: 20,
      state: 'approved',
    });
  });
});

describe('parseReviewState', () => {
  it('nhận đúng hai chữ hợp lệ, mọi thứ khác → null (dùng chung cho URL lẫn tab)', () => {
    // Tab/Select cũng gọi hàm này: value lạ (kể cả `null` khi bị reset) rơi êm
    // về "All" thay vì ném giữa event handler — nếp safeParse của hai vùng kia.
    expect(parseReviewState('pending')).toBe('pending');
    expect(parseReviewState('approved')).toBe('approved');
    expect(parseReviewState('APPROVED')).toBeNull();
    expect(parseReviewState('ALL')).toBeNull();
    expect(parseReviewState(undefined)).toBeNull();
  });
});

describe('reviewsHref', () => {
  it('trạng thái mặc định → đường dẫn trơn, không query cụt', () => {
    expect(reviewsHref({ page: 1, limit: 20 }, {})).toBe('/reviews');
  });

  it('giữ filter hiện tại khi chỉ đổi trang', () => {
    expect(reviewsHref({ page: 1, limit: 20, state: 'pending' }, { page: 3 })).toBe(
      '/reviews?status=pending&page=3',
    );
  });

  it('đổi filter ĐẶT LẠI trang về 1 — trang 5 của bộ lọc cũ gần như chắc chắn rỗng', () => {
    expect(reviewsHref({ page: 5, limit: 20, state: 'pending' }, { state: 'approved' })).toBe(
      '/reviews?status=approved',
    );
  });

  it('state: null XOÁ filter (khác undefined = giữ nguyên)', () => {
    expect(reviewsHref({ page: 2, limit: 20, state: 'approved' }, { state: null })).toBe(
      '/reviews',
    );
  });

  it('search đi vào q, giữ cùng filter trạng thái, và cũng đặt lại trang 1', () => {
    expect(reviewsHref({ page: 4, limit: 20, state: 'pending' }, { search: '  halong ' })).toBe(
      '/reviews?status=pending&q=halong',
    );
  });

  it('search: null xoá ô tìm kiếm', () => {
    expect(reviewsHref({ page: 3, limit: 20, search: 'halong' }, { search: null })).toBe(
      '/reviews',
    );
  });

  it('đổi số dòng mỗi trang cũng đặt lại trang 1 và giữ filter', () => {
    expect(reviewsHref({ page: 4, limit: 20, state: 'approved' }, { limit: 50 })).toBe(
      '/reviews?status=approved&limit=50',
    );
  });
});

/**
 * BẪY ĐÃ GHI SẴN trong JSDoc `TablePaging` (kit `table-query.ts`): schema
 * reviews dùng `pageSize`, kit dùng `limit`. Spread thẳng `{...paging}` vào
 * input thì Zod STRIP im lặng — "Rows per page" thành nút chết, không lỗi
 * nào đỏ. Ba test dưới đây là cái chốt cửa đó.
 */
describe('toReviewsListInput', () => {
  it('map số dòng sang `pageSize` và KHÔNG để sót key `limit` của kit', () => {
    const input = toReviewsListInput({ page: 2, limit: 50 });
    expect(input).toEqual({ page: 2, pageSize: 50 });
    expect('limit' in input).toBe(false);
  });

  it('qua CHÍNH schema contract, pageSize sống sót đúng số đã chọn (không rơi về mặc định 20)', () => {
    const parsed = AdminReviewsQuerySchema.parse(toReviewsListInput({ page: 1, limit: 50 }));
    expect(parsed.pageSize).toBe(50);
  });

  it('state → isApproved boolean; không lọc thì KHÔNG gửi key nào (bỏ trống = tất cả)', () => {
    expect(toReviewsListInput({ page: 1, limit: 20, state: 'pending' })).toEqual({
      page: 1,
      pageSize: 20,
      isApproved: false,
    });
    expect(toReviewsListInput({ page: 1, limit: 20, state: 'approved' })).toEqual({
      page: 1,
      pageSize: 20,
      isApproved: true,
    });
    expect('isApproved' in toReviewsListInput({ page: 1, limit: 20 })).toBe(false);
  });

  it('search đi thẳng vào `search` của contract', () => {
    expect(toReviewsListInput({ page: 1, limit: 20, search: 'halong' })).toEqual({
      page: 1,
      pageSize: 20,
      search: 'halong',
    });
  });
});
