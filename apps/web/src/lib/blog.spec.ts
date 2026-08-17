import { describe, expect, it } from 'vitest';
import type { JournalPost } from './api/posts';
import {
  adjacentPosts,
  facetCounts,
  filterPostsByFacets,
  filterPostsByTag,
  HOME_TEASER_COUNT,
  homeTeaserPosts,
  latestPosts,
  parseFacetParams,
  relatedPosts,
  searchPosts,
  serializeFacetParams,
  sortPostsByDate,
  splitTagFamilies,
} from './blog.js';

// Factory dựng post theo shape JournalPost (VM sau Task 5) — `category` là tag
// đầu tiên, `tags` mang cả tag phụ để test filterPostsByTag phủ được chip lọc.
const post = (
  slug: string,
  date: string,
  category: string,
  tags: { slug: string; name: string }[] = [{ slug: category.toLowerCase(), name: category }],
): JournalPost => ({
  slug,
  title: slug,
  excerpt: '',
  // Bài chưa có ảnh là trạng thái HỢP LỆ — SlotImage tự rơi về giữ chỗ.
  cover: null,
  date,
  readMinutes: 5,
  category,
  author: 'Guide',
  tags,
});

const POSTS = [
  post('a', '2026-01-10', 'Food'),
  post('b', '2026-03-01', 'Nature'),
  post('c', '2026-02-05', 'Food', [
    { slug: 'food', name: 'Food' },
    { slug: 'sa-pa', name: 'Sa Pa' },
  ]),
];

describe('sortPostsByDate', () => {
  it('mới nhất lên đầu', () => {
    expect(sortPostsByDate(POSTS).map((p) => p.slug)).toEqual(['b', 'c', 'a']);
  });

  it('không sửa mảng gốc', () => {
    sortPostsByDate(POSTS);
    expect(POSTS.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('filterPostsByTag', () => {
  it('không truyền tag thì trả nguyên danh sách', () => {
    expect(filterPostsByTag(POSTS)).toHaveLength(3);
  });

  it('lọc đúng theo tag hiển thị chính (category)', () => {
    expect(filterPostsByTag(POSTS, 'food').map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('lọc phủ CẢ tag phụ — không chỉ tag đầu tiên (category)', () => {
    expect(filterPostsByTag(POSTS, 'sa-pa').map((p) => p.slug)).toEqual(['c']);
  });

  it('tag lạ trả mảng rỗng, không ném lỗi', () => {
    expect(filterPostsByTag(POSTS, 'submarine')).toEqual([]);
  });
});

describe('adjacentPosts', () => {
  it('bài giữa có cả bài mới hơn lẫn cũ hơn', () => {
    const { newer, older } = adjacentPosts(POSTS, 'c');
    expect(newer?.slug).toBe('b');
    expect(older?.slug).toBe('a');
  });

  it('bài mới nhất không có bài mới hơn', () => {
    expect(adjacentPosts(POSTS, 'b').newer).toBeUndefined();
  });

  it('bài cũ nhất không có bài cũ hơn', () => {
    expect(adjacentPosts(POSTS, 'a').older).toBeUndefined();
  });

  it('slug lạ trả hai đầu rỗng', () => {
    expect(adjacentPosts(POSTS, 'zzz')).toEqual({ newer: undefined, older: undefined });
  });
});

describe('relatedPosts', () => {
  it('ưu tiên bài cùng chuyên mục và không bao giờ chứa chính nó', () => {
    const result = relatedPosts(POSTS, 'a', 2);
    expect(result.map((p) => p.slug)).not.toContain('a');
    expect(result[0]?.slug).toBe('c');
  });

  it('thiếu bài cùng chuyên mục thì bù bằng bài mới nhất, ĐÚNG thứ tự mới-nhất-trước', () => {
    // 'b' (Nature) không có bài cùng chuyên mục nào khác → toàn bộ kết quả là
    // filler, phải xếp mới-nhất-trước: c (2026-02-05) rồi a (2026-01-10).
    // Assert thứ tự tường minh — chỉ canh độ dài thì thêm .reverse() vào phần
    // filler trong relatedPosts() vẫn xanh (lỗ hổng reviewer chỉ ra).
    const result = relatedPosts(POSTS, 'b', 2);
    expect(result.map((p) => p.slug)).toEqual(['c', 'a']);
  });

  it('không trả quá limit', () => {
    expect(relatedPosts(POSTS, 'a', 1)).toHaveLength(1);
  });
});

describe('searchPosts', () => {
  it('query rỗng hoặc toàn khoảng trắng trả nguyên danh sách', () => {
    expect(searchPosts(POSTS, '   ')).toHaveLength(3);
  });

  it('khớp theo tiêu đề, không phân biệt hoa thường', () => {
    expect(searchPosts(POSTS, 'A').map((p) => p.slug)).toEqual(['a']);
  });

  it('khớp cả trong excerpt', () => {
    // Dùng factory `post()` thay vì spread POSTS[0] để khỏi đụng
    // noUncheckedIndexedAccess (POSTS[0] là T | undefined) — Biome cấm `!`
    // (noNonNullAssertion) nên factory là lối sạch hơn guard/assertion.
    const posts = [{ ...post('a', '2026-01-10', 'Food'), excerpt: 'Bún chả in Hanoi' }];
    expect(searchPosts(posts, 'hanoi')).toHaveLength(1);
  });

  it('bỏ dấu tiếng Việt hai chiều — gõ "bun cha" vẫn ra "bún chả"', () => {
    const posts = [
      { ...post('a', '2026-01-10', 'Food'), title: 'Bridges, beaches and bún chả cá' },
    ];
    expect(searchPosts(posts, 'bun cha')).toHaveLength(1);
  });

  it('không khớp gì thì trả mảng rỗng', () => {
    expect(searchPosts(POSTS, 'submarine')).toEqual([]);
  });

  it('bỏ được chữ đ/Đ — normalize NFD không tách được nên phải thay tay', () => {
    const posts = [post('da-nang', '2026-04-01', 'Food')].map((p) => ({
      ...p,
      title: 'Đà Nẵng in three days',
    }));
    expect(searchPosts(posts, 'da nang')).toHaveLength(1);
    expect(searchPosts(posts, 'Đà')).toHaveLength(1);
  });

  it('không sửa mảng gốc', () => {
    searchPosts(POSTS, 'a');
    expect(POSTS.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('homeTeaserPosts', () => {
  it('trả đúng HOME_TEASER_COUNT bài', () => {
    expect(HOME_TEASER_COUNT).toBe(3);
    const many = Array.from({ length: 7 }, (_, i) => post(`p${i}`, `2026-0${i + 1}-01`, 'Food'));
    expect(homeTeaserPosts(many)).toHaveLength(3);
  });

  it('lấy bài MỚI NHẤT trước', () => {
    const many = [
      post('cu', '2026-01-01', 'Food'),
      post('moi-nhat', '2026-09-01', 'Food'),
      post('giua', '2026-05-01', 'Food'),
      post('cu-hon', '2025-12-01', 'Food'),
    ];
    expect(homeTeaserPosts(many).map((p) => p.slug)).toEqual(['moi-nhat', 'giua', 'cu']);
  });

  it('ít bài hơn giới hạn thì trả hết, không lỗi', () => {
    expect(homeTeaserPosts([post('a', '2026-01-01', 'Food')])).toHaveLength(1);
  });

  it('không sửa mảng gốc', () => {
    const many = [post('a', '2026-01-01', 'Food'), post('b', '2026-05-01', 'Food')];
    homeTeaserPosts(many);
    expect(many.map((p) => p.slug)).toEqual(['a', 'b']);
  });
});

describe('latestPosts', () => {
  it('lấy đúng số lượng yêu cầu, mới nhất trước', () => {
    const many = [
      post('cu', '2026-01-01', 'Food'),
      post('moi-nhat', '2026-09-01', 'Food'),
      post('giua', '2026-05-01', 'Food'),
    ];
    expect(latestPosts(many, 2).map((p) => p.slug)).toEqual(['moi-nhat', 'giua']);
  });

  it('xin nhiều hơn số bài đang có thì trả hết, không lỗi', () => {
    expect(latestPosts([post('a', '2026-01-01', 'Food')], 99)).toHaveLength(1);
  });

  it('count 0 hoặc âm trả mảng rỗng, không cắt ngược', () => {
    const many = [post('a', '2026-01-01', 'Food'), post('b', '2026-05-01', 'Food')];
    expect(latestPosts(many, 0)).toEqual([]);
    expect(latestPosts(many, -3)).toEqual([]);
  });

  it('không sửa mảng gốc', () => {
    const many = [post('a', '2026-01-01', 'Food'), post('b', '2026-05-01', 'Food')];
    latestPosts(many, 1);
    expect(many.map((p) => p.slug)).toEqual(['a', 'b']);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Lọc theo HAI TRỤC (Topic / Place) — nền cho filter sidebar /blog (17/08)
// ─────────────────────────────────────────────────────────────────────────

// 19 slug địa danh thật từ API, cắt gọn cho test.
const DESTS = ['can-tho', 'da-nang', 'ha-long', 'hanoi', 'hoi-an', 'hue', 'ninh-binh', 'sa-pa'];

const tag = (slug: string) => ({ slug, name: slug });
const p = (slug: string, date: string, tags: string[]) =>
  post(slug, date, tags[0] ?? 'x', tags.map(tag));

describe('splitTagFamilies', () => {
  it('tag trùng slug địa danh → Place, còn lại → Topic', () => {
    const { topics, places } = splitTagFamilies(
      [tag('food'), tag('hoi-an'), tag('packing'), tag('sa-pa')],
      DESTS,
    );
    expect(topics.map((t) => t.slug)).toEqual(['food', 'packing']);
    expect(places.map((t) => t.slug)).toEqual(['hoi-an', 'sa-pa']);
  });

  it('NGOẠI LỆ: địa danh không có trong destinations vẫn phải vào Place', () => {
    // `lan-ha-bay` là tag địa danh thật của blog nhưng KHÔNG phải slug
    // destination (danh sách có `cat-ba` và `ha-long`, không có nó). Đo được
    // 17/08 — nếu chỉ đối chiếu destinations thì nó rơi nhầm sang Topic và
    // hiện cạnh "Food" trong sidebar.
    const { topics, places } = splitTagFamilies([tag('food'), tag('lan-ha-bay')], DESTS);
    expect(topics.map((t) => t.slug)).toEqual(['food']);
    expect(places.map((t) => t.slug)).toEqual(['lan-ha-bay']);
  });

  it('destinations rỗng (API hắt hơi) → mọi tag về Topic, KHÔNG ném', () => {
    const { topics, places } = splitTagFamilies([tag('food'), tag('hoi-an')], []);
    expect(topics.map((t) => t.slug)).toEqual(['food', 'hoi-an']);
    expect(places).toEqual([]);
  });
});

describe('filterPostsByFacets', () => {
  const posts = [
    p('a', '2026-07-08', ['food', 'hoi-an']),
    p('b', '2026-05-02', ['food', 'da-nang']),
    p('c', '2026-06-25', ['markets', 'can-tho']),
    p('d', '2026-06-08', ['practical']),
  ];

  it('không chọn gì → trả nguyên danh sách', () => {
    expect(filterPostsByFacets(posts, {}).map((x) => x.slug)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('trong CÙNG một trục là OR', () => {
    expect(filterPostsByFacets(posts, { topics: ['food', 'markets'] }).map((x) => x.slug)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('giữa HAI trục là AND', () => {
    expect(
      filterPostsByFacets(posts, { topics: ['food'], places: ['hoi-an'] }).map((x) => x.slug),
    ).toEqual(['a']);
  });

  it('giao rỗng → mảng rỗng, không phải "rơi về tất cả"', () => {
    expect(filterPostsByFacets(posts, { topics: ['markets'], places: ['hoi-an'] })).toEqual([]);
  });

  it('bài không có tag địa danh biến mất khi lọc theo Place', () => {
    // Bài 'd' chỉ có tag chủ đề. Đúng về logic, nhưng ghi lại thành test để
    // không ai "sửa" thành fallback lọt lưới.
    expect(filterPostsByFacets(posts, { places: ['can-tho'] }).map((x) => x.slug)).toEqual(['c']);
  });
});

describe('facetCounts', () => {
  const posts = [
    p('a', '2026-07-08', ['food', 'hoi-an']),
    p('b', '2026-05-02', ['food', 'da-nang']),
    p('c', '2026-06-25', ['markets', 'can-tho']),
  ];

  it('đếm cho một trục thì BỎ QUA lựa chọn của chính trục đó', () => {
    // Nếu áp cả lựa chọn của chính nó thì mọi mục chưa chọn đều ra 0 và
    // người dùng không bao giờ chọn thêm được giá trị thứ hai cùng nhóm.
    const c = facetCounts(posts, { topics: ['food'] }, 'topics');
    expect(c.get('food')).toBe(2);
    expect(c.get('markets')).toBe(1);
  });

  it('trục kia thì CÓ áp — đây là chỗ số đếm của API nói dối', () => {
    // `PostTagSchema.count` là tổng toàn cục; sau khi chọn Topic=food thì
    // can-tho phải về 0 chứ không còn là 1.
    const c = facetCounts(posts, { topics: ['food'] }, 'places');
    expect(c.get('hoi-an')).toBe(1);
    expect(c.get('da-nang')).toBe(1);
    expect(c.get('can-tho')).toBe(0);
  });

  it('tag chưa từng xuất hiện → 0 chứ không undefined', () => {
    expect(facetCounts(posts, {}, 'places').get('sa-pa')).toBe(0);
  });
});

describe('parseFacetParams', () => {
  it('đọc topic và place dạng danh sách phẩy', () => {
    expect(parseFacetParams({ topic: 'food,markets', place: 'hoi-an' })).toEqual({
      topics: ['food', 'markets'],
      places: ['hoi-an'],
      legacyTag: undefined,
    });
  });

  it('bỏ khoảng trắng và phần tử rỗng', () => {
    expect(parseFacetParams({ topic: ' food , , markets ' }).topics).toEqual(['food', 'markets']);
  });

  it('link CŨ `?tag=` vẫn chạy — không được để link đã chia sẻ chết', () => {
    expect(parseFacetParams({ tag: 'sa-pa' })).toEqual({
      topics: [],
      places: [],
      legacyTag: 'sa-pa',
    });
  });

  it('có topic/place mới thì BỎ QUA tag cũ — tránh hai bộ lọc chồng nhau', () => {
    expect(parseFacetParams({ topic: 'food', tag: 'sa-pa' }).legacyTag).toBeUndefined();
  });
});

describe('serializeFacetParams', () => {
  it('nối bằng dấu phẩy, bỏ trục rỗng', () => {
    expect(serializeFacetParams({ topics: ['food', 'markets'], places: [] })).toEqual({
      topic: 'food,markets',
    });
  });

  it('không chọn gì → object rỗng, URL sạch', () => {
    expect(serializeFacetParams({ topics: [], places: [] })).toEqual({});
  });
});
