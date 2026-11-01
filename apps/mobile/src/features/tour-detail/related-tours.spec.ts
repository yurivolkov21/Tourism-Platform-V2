import { relatedTours } from './related-tours';

const tour = (slug: string, category: string, destinations: string[]) => ({
  slug,
  category: { slug: category },
  destinations: destinations.map((d) => ({ slug: d })),
});

describe('relatedTours', () => {
  const tours = [
    tour('current', 'trek', ['sa-pa']),
    tour('other-cat-other-place', 'cruise', ['ha-long']),
    tour('other-cat-same-place', 'day', ['sa-pa']),
    tour('same-cat', 'trek', ['ha-giang']),
  ];

  it('cùng danh mục trước, rồi chung địa danh, rồi lấp; bỏ chính tour đang xem', () => {
    expect(relatedTours(tours, 'current', 3).map((t) => t.slug)).toEqual([
      'same-cat',
      'other-cat-same-place',
      'other-cat-other-place',
    ]);
  });

  it('cắt theo limit', () => {
    expect(relatedTours(tours, 'current', 1).map((t) => t.slug)).toEqual(['same-cat']);
  });

  it('không thấy tour đang xem trong danh sách: lấy theo thứ tự API', () => {
    expect(relatedTours(tours, 'missing', 2).map((t) => t.slug)).toEqual([
      'current',
      'other-cat-other-place',
    ]);
  });
});
