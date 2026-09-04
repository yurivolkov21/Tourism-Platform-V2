import { describe, expect, it } from 'vitest';
import {
  cancellationDetailHref,
  cancellationsBackHref,
  cancellationsHref,
  parseCancellationsSearchParams,
} from './cancellations-query';

/**
 * Trạng thái hàng đợi `/cancellations` sống TRÊN URL như vùng bookings (spec
 * P4b §2.2). Vùng này chỉ có MỘT filter (status) — `AdminCancellationsList
 * QuerySchema` không khai `search` — nên đừng dựng thêm ô tìm kiếm giả rồi
 * lặng lẽ bỏ qua nó.
 */
describe('parseCancellationsSearchParams', () => {
  it('không param nào → trang 1, limit mặc định, KHÔNG filter (contract: bỏ trống = tất cả)', () => {
    expect(parseCancellationsSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('phân trang dùng chung luật clamp với bookings (page rác → 1, limit vượt trần → mặc định)', () => {
    expect(parseCancellationsSearchParams({ page: '0', limit: '500' })).toEqual({
      page: 1,
      limit: 20,
    });
    expect(parseCancellationsSearchParams({ page: '4', limit: '10' })).toEqual({
      page: 4,
      limit: 10,
    });
  });

  it('cả ba trạng thái của enum contract đều lọc được', () => {
    for (const status of ['REQUESTED', 'REFUNDED', 'DENIED'] as const) {
      expect(parseCancellationsSearchParams({ status })).toEqual({ page: 1, limit: 20, status });
    }
  });

  it('status lạ (kể cả của enum booking) bị BỎ, không ném lỗi — URL do người gõ', () => {
    expect(parseCancellationsSearchParams({ status: 'requested' })).toEqual({ page: 1, limit: 20 });
    expect(parseCancellationsSearchParams({ status: 'PAID' })).toEqual({ page: 1, limit: 20 });
  });

  it('param lặp lấy giá trị đầu', () => {
    expect(parseCancellationsSearchParams({ status: ['DENIED', 'REQUESTED'] })).toEqual({
      page: 1,
      limit: 20,
      status: 'DENIED',
    });
  });
});

describe('cancellationsHref', () => {
  it('trạng thái mặc định → đường dẫn trơn, không query cụt', () => {
    expect(cancellationsHref({ page: 1, limit: 20 }, {})).toBe('/cancellations');
  });

  it('giữ filter hiện tại khi chỉ đổi trang', () => {
    expect(cancellationsHref({ page: 1, limit: 20, status: 'REQUESTED' }, { page: 3 })).toBe(
      '/cancellations?status=REQUESTED&page=3',
    );
  });

  it('đổi filter ĐẶT LẠI trang về 1 — trang 5 của bộ lọc cũ gần như chắc chắn rỗng', () => {
    expect(
      cancellationsHref({ page: 5, limit: 20, status: 'REQUESTED' }, { status: 'DENIED' }),
    ).toBe('/cancellations?status=DENIED');
  });

  it('status: null XOÁ filter (khác undefined = giữ nguyên)', () => {
    expect(cancellationsHref({ page: 2, limit: 20, status: 'DENIED' }, { status: null })).toBe(
      '/cancellations',
    );
  });

  it('đổi số dòng mỗi trang cũng đặt lại trang 1 và giữ filter', () => {
    expect(cancellationsHref({ page: 4, limit: 20, status: 'REFUNDED' }, { limit: 50 })).toBe(
      '/cancellations?status=REFUNDED&limit=50',
    );
  });
});

/**
 * Bộ lọc khoảng ngày (ADR-0028 §AMEND) — theo `createdAt`, ngày khách GỬI yêu
 * cầu. Khác `/bookings` ở đúng một chỗ và đó là chủ đích: **không độn mặc
 * định**. Trang này là hàng đợi việc phải làm, mặc định phải thấy đủ mọi
 * request đang mở kể cả cái gửi từ tháng trước — nên URL trần CHÍNH LÀ "xem
 * tất cả", và không có sentinel `?dates=all` nào.
 */
describe('cancellations — bộ lọc khoảng ngày', () => {
  it('URL trần KHÔNG mang ngày nào: mặc định là xem tất cả', () => {
    const query = parseCancellationsSearchParams({});
    expect(query.from).toBeUndefined();
    expect(query.to).toBeUndefined();
  });

  it('đọc đúng hai ngày trên URL', () => {
    expect(parseCancellationsSearchParams({ from: '2026-05-01', to: '2026-05-31' })).toMatchObject({
      from: '2026-05-01',
      to: '2026-05-31',
    });
  });

  it('ngày rác rơi im lặng, không ném lên API', () => {
    // Cùng luật khoan dung với /bookings: URL là thứ người gõ được, và 400 là
    // câu trả lời vô nghĩa với admin.
    expect(parseCancellationsSearchParams({ from: '2026-02-31' }).from).toBeUndefined();
    expect(parseCancellationsSearchParams({ to: '31-05-2026' }).to).toBeUndefined();
    expect(parseCancellationsSearchParams({ from: '9999-12-31' }).from).toBeUndefined();
  });

  it('khoảng NGƯỢC giữ `from`, bỏ `to` — người gõ thấy ngay cái vừa bị vứt', () => {
    const query = parseCancellationsSearchParams({ from: '2026-05-31', to: '2026-05-01' });
    expect(query.from).toBe('2026-05-31');
    expect(query.to).toBeUndefined();
  });

  it('href mang ngày, và đổi ngày ĐẶT LẠI trang về 1', () => {
    expect(
      cancellationsHref({ page: 4, limit: 20, from: '2026-05-01' }, { to: '2026-05-31' }),
    ).toBe('/cancellations?from=2026-05-01&to=2026-05-31');
  });

  it('xoá trắng một ô ngày là XOÁ đầu đó — `null` và chuỗi rỗng như nhau', () => {
    // Không có sentinel nào để phát: URL không còn ngày CHÍNH LÀ xem tất cả.
    const current = { page: 1, limit: 20, from: '2026-05-01', to: '2026-05-31' };
    expect(cancellationsHref(current, { from: null, to: null })).toBe('/cancellations');
    expect(cancellationsHref(current, { from: '', to: '' })).toBe('/cancellations');
  });

  it('ngày cộng dồn với status, không cái nào thay cái nào', () => {
    expect(
      cancellationsHref({ page: 1, limit: 20, status: 'REQUESTED' }, { from: '2026-05-01' }),
    ).toBe('/cancellations?status=REQUESTED&from=2026-05-01');
  });

  it('ngày rác từ patch bị vứt ở đây, không ném lên URL', () => {
    // Một href sinh ra 400 là một cú click chết.
    expect(cancellationsHref({ page: 1, limit: 20 }, { from: '2026-02-31' })).toBe(
      '/cancellations',
    );
  });
});

/**
 * Vòng đi–về hàng đợi ↔ trang chi tiết RIÊNG của vùng huỷ (user chốt 04/09:
 * hai vùng hai route). Cùng luật với `/bookings`, khác đúng một chỗ: không có
 * sentinel `?dates=all` vì URL trần chính là "xem tất cả".
 */
describe('vòng đi–về hàng đợi ↔ /cancellations/[code]', () => {
  describe('cancellationDetailHref', () => {
    it('mang trọn bộ lọc và trang hiện tại sang link chi tiết', () => {
      const query = parseCancellationsSearchParams({
        status: 'REQUESTED',
        from: '2026-05-01',
        to: '2026-05-31',
        page: '3',
        limit: '50',
      });
      const href = cancellationDetailHref(query, 'BK-J8F2AIOG');

      expect(href.startsWith('/cancellations/BK-J8F2AIOG?')).toBe(true);
      expect(searchParamsOf(href)).toEqual({
        status: 'REQUESTED',
        from: '2026-05-01',
        to: '2026-05-31',
        page: '3',
        limit: '50',
      });
    });

    it('hàng đợi chưa lọc gì → link chi tiết TRẦN, không độn tham số nào', () => {
      // Khác `/bookings`: ở đó mặc định tháng này được viết ra tường minh.
      expect(cancellationDetailHref(parseCancellationsSearchParams({}), 'BK-1')).toBe(
        '/cancellations/BK-1',
      );
    });
  });

  describe('cancellationsBackHref', () => {
    it('dựng lại ĐÚNG URL hàng đợi đã rời', () => {
      const query = parseCancellationsSearchParams({
        status: 'REQUESTED',
        from: '2026-05-01',
        page: '2',
      });
      const back = cancellationsBackHref(searchParamsOf(cancellationDetailHref(query, 'BK-1')));

      expect(searchParamsOf(back)).toEqual({
        status: 'REQUESTED',
        from: '2026-05-01',
        page: '2',
      });
    });

    it('vào thẳng URL chi tiết → hàng đợi TRẦN, tức thấy đủ mọi request', () => {
      // Mặc định của vùng là KHÔNG lọc ngày — hàng đợi việc phải làm thì phải
      // thấy đủ, kể cả request tháng trước còn đang mở (ADR-0028 §AMEND).
      expect(cancellationsBackHref({})).toBe('/cancellations');
    });

    it('tham số rác không đẻ ra một href hỏng', () => {
      const back = cancellationsBackHref({ status: 'NOPE', from: '2026-02-31', page: '-2' });
      expect(back).toBe('/cancellations');
    });
  });
});

/** `?a=1&b=2` của một href → shape mà hàm parse nhận. */
function searchParamsOf(href: string): Record<string, string> {
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return Object.fromEntries(new URLSearchParams(query));
}
