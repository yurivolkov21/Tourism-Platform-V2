import { describe, expect, it } from 'vitest';
import { countTours, NO_TOURS } from './tour-counts.js';

/**
 * Luật đếm tour của MỘT hàng danh mục hay điểm đến (ADR-0053 §5) — một bản cho cả hai bảng
 * (review RU1). Trước đó danh mục giữ một bản chép riêng, không có test nào ngoài int spec.
 */

describe('countTours', () => {
  it('tour đã đăng và tour mọi trạng thái đếm từ CÙNG một danh sách', () => {
    expect(
      countTours([{ isPublished: true }, { isPublished: false }, { isPublished: true }]),
    ).toEqual({ tourCount: 2, linkedTourCount: 3 });
  });

  it('chỉ có tour nháp: không tour nào khách thấy, nhưng vẫn chặn xoá', () => {
    expect(countTours([{ isPublished: false }])).toEqual({ tourCount: 0, linkedTourCount: 1 });
  });

  it('không tour nào thì cả hai số là 0 — đúng `NO_TOURS`', () => {
    expect(countTours([])).toEqual({ tourCount: 0, linkedTourCount: 0 });
    expect(NO_TOURS).toEqual(countTours([]));
  });
});
