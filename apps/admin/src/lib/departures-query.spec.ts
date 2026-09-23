import { describe, expect, it } from 'vitest';
import { departuresHref, departuresPath, parseDeparturesSearchParams } from './departures-query';

/**
 * Trạng thái bảng chuyến sống trên URL (spec P4e-1 F12). Điểm khác mọi vùng
 * khác: `slug` đến từ ĐOẠN ĐƯỜNG DẪN, nên nó phải sống sót qua mọi href mà
 * không bao giờ bị đọc từ query.
 */

const QUERY = { slug: 'ha-long-bay-cruise', page: 1, limit: 20 };

describe('parseDeparturesSearchParams', () => {
  it('slug lấy từ đường dẫn, KHÔNG từ query', () => {
    // `?slug=` gõ tay không được phép đổi bảng sang tour khác — đường dẫn là
    // nguồn duy nhất, nếu không thì breadcrumb và bảng nói hai chuyện.
    const query = parseDeparturesSearchParams('ha-long-bay-cruise', { slug: 'tour-khac' });

    expect(query.slug).toBe('ha-long-bay-cruise');
  });

  it('page/limit rác rơi về mặc định', () => {
    const query = parseDeparturesSearchParams('a-tour', { page: '-3', limit: '9999' });

    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
  });

  it('phase ngoài bốn nhóm thì bỏ filter, trong nhóm thì giữ', () => {
    // `on-sale` là một GIAI ĐOẠN, không phải một nhóm lọc.
    expect(parseDeparturesSearchParams('a-tour', { phase: 'on-sale' }).phase).toBeUndefined();
    expect(parseDeparturesSearchParams('a-tour', { phase: 'completed' }).phase).toBe('completed');
  });

  it('URL cũ `?status=OPEN` rơi êm về All — không còn nghĩa, không ném', () => {
    expect(parseDeparturesSearchParams('a-tour', { status: 'OPEN' })).toEqual({
      slug: 'a-tour',
      page: 1,
      limit: 20,
    });
  });
});

describe('departuresHref', () => {
  it('luôn dựng lại đường dẫn của đúng tour đang mở', () => {
    expect(departuresHref(QUERY, {})).toBe(departuresPath('ha-long-bay-cruise'));
  });

  it('đổi filter ĐẶT LẠI trang về 1', () => {
    const onPage5 = { ...QUERY, page: 5 };

    expect(departuresHref(onPage5, { phase: 'upcoming' })).toBe(
      '/tours/ha-long-bay-cruise/departures?phase=upcoming',
    );
  });

  it('đổi trang thì giữ filter', () => {
    const filtered = { ...QUERY, phase: 'departed' as const };

    expect(departuresHref(filtered, { page: 3 })).toBe(
      '/tours/ha-long-bay-cruise/departures?phase=departed&page=3',
    );
  });

  it('`null` xoá filter, `undefined` giữ nguyên', () => {
    const filtered = { ...QUERY, phase: 'completed' as const };

    expect(departuresHref(filtered, { phase: null })).toBe('/tours/ha-long-bay-cruise/departures');
    expect(departuresHref(filtered, {})).toContain('phase=completed');
  });
});
