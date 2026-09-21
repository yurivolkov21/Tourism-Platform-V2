import { moderationRevalidationTags, tourRevalidationTags } from './revalidation-decision.js';

// Logic thuần — không đụng DB/HTTP. TDD trước khi có revalidation-decision.ts
// (spec 03/08 §3: hàm quyết định phải viết TRƯỚC service gọi fetch).
describe('moderationRevalidationTags', () => {
  it('không có tourSlug → null (review không gắn tour, không có gì để bust)', () => {
    expect(
      moderationRevalidationTags({ tourSlug: null, fromApproved: false, toApproved: true }),
    ).toBeNull();
  });

  it('approve giữ nguyên trạng thái true→true → null', () => {
    expect(
      moderationRevalidationTags({
        tourSlug: 'vung-tau-2n1d',
        fromApproved: true,
        toApproved: true,
      }),
    ).toBeNull();
  });

  it('approve giữ nguyên trạng thái false→false → null', () => {
    expect(
      moderationRevalidationTags({
        tourSlug: 'vung-tau-2n1d',
        fromApproved: false,
        toApproved: false,
      }),
    ).toBeNull();
  });

  it('false→true (duyệt lần đầu, có slug) → tags bust tour', () => {
    expect(
      moderationRevalidationTags({
        tourSlug: 'vung-tau-2n1d',
        fromApproved: false,
        toApproved: true,
      }),
    ).toEqual(['tours', 'tour:vung-tau-2n1d']);
  });

  it('true→false (bỏ duyệt, có slug) → tags bust tour', () => {
    expect(
      moderationRevalidationTags({
        tourSlug: 'vung-tau-2n1d',
        fromApproved: true,
        toApproved: false,
      }),
    ).toEqual(['tours', 'tour:vung-tau-2n1d']);
  });
});

// Nâng cặp tag lên một hàm chung ở F11 (21/09) — `admin.tours.setPublished`
// bust đúng cặp này, và hai chuỗi `'tour:' + …` ở hai file là hai thứ sẽ trôi
// lệch nhau.
describe('tourRevalidationTags', () => {
  it('luôn là cặp [danh sách, tour đó] — đúng taxonomy của apps/web/src/lib/api/tags.ts', () => {
    expect(tourRevalidationTags('vung-tau-2n1d')).toEqual(['tours', 'tour:vung-tau-2n1d']);
  });

  it('là NGUỒN của tags mà moderationRevalidationTags trả về', () => {
    expect(
      moderationRevalidationTags({
        tourSlug: 'vung-tau-2n1d',
        fromApproved: false,
        toApproved: true,
      }),
    ).toEqual(tourRevalidationTags('vung-tau-2n1d'));
  });
});
