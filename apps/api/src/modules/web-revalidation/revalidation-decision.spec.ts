import { moderationRevalidationTags } from './revalidation-decision.js';

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
