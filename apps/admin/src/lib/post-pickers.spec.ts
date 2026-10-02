import type { AdminPostTag } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import type { PostTourDraft, PostTourOption } from './post-form';
import { addTag, addTour, TAG_SUGGESTIONS_MAX, tagSuggestions, tourMatches } from './post-pickers';

describe('addTag', () => {
  it('thêm tên đã trim vào cuối', () => {
    expect(addTag(['Food'], '  Hội An ')).toEqual({ ok: true, tags: ['Food', 'Hội An'] });
  });

  it('trùng THEO SLUG là trùng — "Hoi An" đụng "Hội An"', () => {
    expect(addTag(['Hội An'], 'Hoi An')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rỗng, chỉ ký hiệu, quá dài', () => {
    expect(addTag([], '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(addTag([], '!!!')).toEqual({ ok: false, reason: 'invalid' });
    expect(addTag([], 'x'.repeat(61))).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('đủ 5 thì không thêm nữa; gõ lại tag đã có vẫn nói là trùng', () => {
    const five = ['A1', 'B2', 'C3', 'D4', 'E5'];
    expect(addTag(five, 'F6')).toEqual({ ok: false, reason: 'full' });
    expect(addTag(five, 'a1')).toEqual({ ok: false, reason: 'duplicate' });
  });
});

describe('tagSuggestions', () => {
  const ALL: AdminPostTag[] = [
    { slug: 'hoi-an', name: 'Hội An', count: 3 },
    { slug: 'food', name: 'Food', count: 5 },
    { slug: 'hue', name: 'Huế', count: 1 },
    { slug: 'markets', name: 'Markets', count: 5 },
  ];

  it('ô trống: tag dùng nhiều trước, cùng số thì theo tên; bỏ tag bài đã có', () => {
    expect(tagSuggestions(ALL, ['Food'], '').map((tag) => tag.name)).toEqual([
      'Markets',
      'Hội An',
      'Huế',
    ]);
  });

  it('gõ không dấu vẫn khớp tên có dấu, không phân biệt hoa thường', () => {
    expect(tagSuggestions(ALL, [], 'HU').map((tag) => tag.name)).toEqual(['Huế']);
    expect(tagSuggestions(ALL, [], 'hoi').map((tag) => tag.name)).toEqual(['Hội An']);
  });

  it(`tối đa ${TAG_SUGGESTIONS_MAX} gợi ý`, () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      slug: `t${i}`,
      name: `Tag ${i}`,
      count: 1,
    }));
    expect(tagSuggestions(many, [], '')).toHaveLength(TAG_SUGGESTIONS_MAX);
  });
});

describe('tourMatches / addTour', () => {
  const FOOD: PostTourOption = {
    id: 'a',
    slug: 'hoi-an-food-walk',
    title: 'Hội An Food Walk',
    isPublished: true,
  };
  const MY_SON: PostTourOption = {
    id: 'b',
    slug: 'my-son-sunrise',
    title: 'Mỹ Sơn Sunrise',
    isPublished: false,
  };
  const HUE: PostTourOption = {
    id: 'c',
    slug: 'hue-citadel',
    title: 'Huế Citadel',
    isPublished: true,
  };
  const OPTIONS = [FOOD, MY_SON, HUE];
  const draft = (option: PostTourOption): PostTourDraft => ({ key: option.id, ...option });

  it('ô trống thì không gợi ý; gõ không dấu khớp tiêu đề có dấu; bỏ tour đã chọn', () => {
    expect(tourMatches(OPTIONS, [], '  ')).toEqual([]);
    expect(tourMatches(OPTIONS, [], 'my son').map((tour) => tour.id)).toEqual(['b']);
    expect(tourMatches(OPTIONS, [draft(FOOD)], 'h').map((tour) => tour.id)).toEqual(['c']);
  });

  it('thêm vào cuối kèm key; đã có hay đã đủ 3 thì giữ nguyên', () => {
    expect(addTour([draft(FOOD)], HUE).map((tour) => tour.id)).toEqual(['a', 'c']);
    expect(addTour([draft(FOOD)], FOOD).map((tour) => tour.id)).toEqual(['a']);
    expect(addTour([draft(FOOD), draft(MY_SON), draft(HUE)], { ...HUE, id: 'd' })).toHaveLength(3);
  });
});
