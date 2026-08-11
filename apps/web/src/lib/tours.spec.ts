import { describe, expect, it } from 'vitest';
import type { MockMediaItem, MockReview } from '@/mocks/types';
// `mocks/tours.ts` đã khai tử ở Task 7 (cụm destinations-api) — TOURS giờ là
// fixture nội bộ trích nguyên vẹn từ mock cũ, xem đầu file fixture để biết vì
// sao (mọi slug/con số các test dưới đây đang canh vẫn đúng nguyên xi).
import { FIXTURE_TOURS as TOURS } from '@/test/fixtures/catalog';

/** State rỗng dùng làm nền cho mọi test lọc — spread rồi ghi đè đúng facet cần. */
const EMPTY_FILTERS = {
  categories: [],
  destinations: [],
  durations: [],
  prices: [],
  difficulties: [],
  featured: false,
} as const;

import {
  averageRating,
  countActiveFilters,
  departureStatus,
  discountPercent,
  durationBucket,
  facetOptionCounts,
  filterTours,
  formatDate,
  formatDateRange,
  formatMoney,
  formatReviewDate,
  formatTicketDate,
  groupPoliciesByKind,
  priceBucket,
  relatedTours,
  routeChain,
  searchTours,
  sortTours,
  tourCategories,
  tourGallery,
  tourReviews,
} from './tours';

describe('tourCategories', () => {
  it('trả chuyên mục duy nhất, tổng count bằng số tour', () => {
    const cats = tourCategories(TOURS);
    expect(new Set(cats.map((c) => c.slug)).size).toBe(cats.length);
    expect(cats.reduce((sum, c) => sum + c.count, 0)).toBe(TOURS.length);
  });

  it('giữ thứ tự xuất hiện — chip không nhảy chỗ khi thêm tour', () => {
    const cats = tourCategories(TOURS);
    expect(cats[0]?.slug).toBe(TOURS[0]?.category.slug);
  });

  it('danh sách rỗng trả mảng rỗng', () => {
    expect(tourCategories([])).toEqual([]);
  });
});

describe('durationBucket', () => {
  it('1 ngày là day trip', () => {
    expect(durationBucket(1)).toBe('1');
  });
  it('2 và 3 ngày cùng nhóm', () => {
    expect(durationBucket(2)).toBe('2-3');
    expect(durationBucket(3)).toBe('2-3');
  });
  it('từ 4 ngày trở lên là nhóm dài', () => {
    expect(durationBucket(4)).toBe('4+');
    expect(durationBucket(12)).toBe('4+');
  });
});

describe('priceBucket', () => {
  it('so sánh theo SỐ dù giá lưu dạng chuỗi', () => {
    expect(priceBucket('45.00')).toBe('<100');
    expect(priceBucket('189.00')).toBe('100-300');
    expect(priceBucket('1480.00')).toBe('300+');
  });
  it('biên 100 thuộc nhóm giữa, biên 300 thuộc nhóm giữa', () => {
    expect(priceBucket('100.00')).toBe('100-300');
    expect(priceBucket('300.00')).toBe('100-300');
    expect(priceBucket('300.01')).toBe('300+');
  });
});

describe('filterTours — đa chọn', () => {
  it('state rỗng thì trả nguyên danh sách', () => {
    expect(filterTours(TOURS, EMPTY_FILTERS)).toHaveLength(TOURS.length);
  });

  it('trong CÙNG một facet là OR — chọn 2 chuyên mục ra tổng của cả hai', () => {
    const trekking = filterTours(TOURS, { ...EMPTY_FILTERS, categories: ['trekking'] }).length;
    const food = filterTours(TOURS, { ...EMPTY_FILTERS, categories: ['food'] }).length;
    const both = filterTours(TOURS, { ...EMPTY_FILTERS, categories: ['trekking', 'food'] });
    expect(both).toHaveLength(trekking + food);
  });

  it('giữa CÁC facet là AND — thu hẹp dần', () => {
    const onlyTrekking = filterTours(TOURS, { ...EMPTY_FILTERS, categories: ['trekking'] });
    const trekkingInSaPa = filterTours(TOURS, {
      ...EMPTY_FILTERS,
      categories: ['trekking'],
      destinations: ['sa-pa'],
    });
    expect(trekkingInSaPa.length).toBeLessThanOrEqual(onlyTrekking.length);
    expect(
      trekkingInSaPa.every(
        (t) => t.category.slug === 'trekking' && t.destinations.some((d) => d.slug === 'sa-pa'),
      ),
    ).toBe(true);
  });

  it('slug lạ cho mảng RỖNG — không âm thầm rơi về "All"', () => {
    expect(filterTours(TOURS, { ...EMPTY_FILTERS, categories: ['khong-ton-tai'] })).toEqual([]);
  });

  it('destination khớp cả khi là chặng PHỤ, không chỉ primary', () => {
    const result = filterTours(TOURS, { ...EMPTY_FILTERS, destinations: ['ninh-binh'] });
    const halong = result.find((t) => t.slug === 'ha-long-bay-cruise');
    expect(halong?.destinations.find((d) => d.slug === 'ninh-binh')?.isPrimary).toBe(false);
  });

  it('lọc theo nhóm thời lượng', () => {
    const result = filterTours(TOURS, { ...EMPTY_FILTERS, durations: ['1'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.durationDays === 1)).toBe(true);
  });

  it('lọc theo nhóm giá', () => {
    const result = filterTours(TOURS, { ...EMPTY_FILTERS, prices: ['<100'] });
    expect(result.every((t) => Number(t.basePrice) < 100)).toBe(true);
  });

  it('lọc theo độ khó; tour có difficulty null KHÔNG lọt bất kỳ nhóm nào', () => {
    const result = filterTours(TOURS, {
      ...EMPTY_FILTERS,
      difficulties: ['EASY', 'MODERATE', 'CHALLENGING'],
    });
    expect(result.every((t) => t.difficulty !== null)).toBe(true);
    expect(result).toHaveLength(TOURS.filter((t) => t.difficulty !== null).length);
  });

  it('featured=false nghĩa là KHÔNG lọc, khác hẳn "chỉ tour không featured"', () => {
    expect(filterTours(TOURS, { ...EMPTY_FILTERS, featured: false })).toHaveLength(TOURS.length);
  });

  it('featured=true chỉ giữ tour featured', () => {
    const result = filterTours(TOURS, { ...EMPTY_FILTERS, featured: true });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.isFeatured)).toBe(true);
  });

  it('không sửa mảng gốc tại chỗ', () => {
    const before = TOURS.map((t) => t.slug);
    filterTours(TOURS, { ...EMPTY_FILTERS, categories: ['trekking'] });
    expect(TOURS.map((t) => t.slug)).toEqual(before);
  });
});

describe('countActiveFilters', () => {
  it('đếm từng option đã chọn, cộng featured là 1', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        categories: ['trekking', 'food'],
        durations: ['1'],
        featured: true,
      }),
    ).toBe(4);
  });
});

describe('facetOptionCounts', () => {
  it('không có facet nào bật thì đếm bằng số tour thật của từng option', () => {
    const counts = facetOptionCounts(TOURS, EMPTY_FILTERS, 'categories', ['trekking', 'food']);
    expect(counts.trekking).toBe(TOURS.filter((t) => t.category.slug === 'trekking').length);
    expect(counts.food).toBe(TOURS.filter((t) => t.category.slug === 'food').length);
  });

  it('đếm cho CHÍNH facet đang bật thì BỎ QUA lựa chọn hiện tại của facet đó', () => {
    // Đã chọn Trekking. Trong cùng facet là OR nên "Food" phải hiện số tour
    // food thật, KHÔNG phải 0 (giao của trekking và food).
    const state = { ...EMPTY_FILTERS, categories: ['trekking'] };
    const counts = facetOptionCounts(TOURS, state, 'categories', ['food']);
    expect(counts.food).toBe(TOURS.filter((t) => t.category.slug === 'food').length);
  });

  it('đếm cho facet KHÁC thì có tính các facet đang bật', () => {
    // Đã chọn category=trekking; đếm theo nhóm thời lượng phải thu hẹp trong
    // phạm vi tour trekking.
    const state = { ...EMPTY_FILTERS, categories: ['trekking'] };
    const counts = facetOptionCounts(TOURS, state, 'durations', ['1', '2-3', '4+']);
    const trekking = TOURS.filter((t) => t.category.slug === 'trekking');
    expect(counts['1']).toBe(0);
    expect(counts['2-3'] + counts['4+']).toBe(trekking.length);
  });

  it('option không ra kết quả nào cho 0 — đó là tín hiệu để làm mờ nó', () => {
    const state = { ...EMPTY_FILTERS, categories: ['trekking'] };
    const counts = facetOptionCounts(TOURS, state, 'destinations', ['phu-quoc']);
    expect(counts['phu-quoc']).toBe(0);
  });

  it('featured đang bật cũng được tính vào phép đếm của facet khác', () => {
    const withFeatured = facetOptionCounts(
      TOURS,
      { ...EMPTY_FILTERS, featured: true },
      'categories',
      ['cruises'],
    );
    const without = facetOptionCounts(TOURS, EMPTY_FILTERS, 'categories', ['cruises']);
    expect(withFeatured.cruises).toBeLessThanOrEqual(without.cruises ?? 0);
  });
});

describe('searchTours', () => {
  it('bỏ dấu hai phía — gõ không dấu vẫn ra địa danh có dấu', () => {
    expect(searchTours(TOURS, 'ha long').map((t) => t.slug)).toContain('ha-long-bay-cruise');
  });
  it('tìm cả trong tên destination, không chỉ tiêu đề', () => {
    // "Phú Quốc" chỉ xuất hiện ở destinations của phu-quoc-sunset-sail
    // (tiêu đề có "Phú Quốc" nhưng ta kiểm cả nhánh destination qua Cần Thơ).
    const result = searchTours(TOURS, 'can tho');
    expect(result.map((t) => t.slug)).toContain('mekong-delta-boats');
  });
  it('tìm được theo tên chuyên mục', () => {
    expect(searchTours(TOURS, 'trekking').length).toBeGreaterThan(0);
  });
  it('chuỗi rỗng hoặc toàn khoảng trắng trả nguyên danh sách', () => {
    expect(searchTours(TOURS, '   ')).toHaveLength(TOURS.length);
  });
  it('tour có summary null không làm hàm nổ', () => {
    expect(() => searchTours(TOURS, 'reef')).not.toThrow();
    expect(searchTours(TOURS, 'reef').map((t) => t.slug)).toContain('phu-quoc-reef-days');
  });
  it('không khớp gì thì trả mảng rỗng', () => {
    expect(searchTours(TOURS, 'zzzzz')).toEqual([]);
  });
});

describe('sortTours', () => {
  it('basePrice so sánh theo SỐ dù lưu chuỗi — "89.00" phải nhỏ hơn "1480.00"', () => {
    const asc = sortTours(TOURS, 'basePrice', 'asc').map((t) => Number(t.basePrice));
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(asc[0]).toBeLessThan(asc[asc.length - 1] ?? 0);
  });
  it('basePrice desc là chiều ngược lại', () => {
    const desc = sortTours(TOURS, 'basePrice', 'desc').map((t) => Number(t.basePrice));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });
  it('durationDays sắp tăng dần đúng', () => {
    const asc = sortTours(TOURS, 'durationDays', 'asc').map((t) => t.durationDays);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });
  it('title dùng localeCompare, không so mã ký tự', () => {
    const asc = sortTours(TOURS, 'title', 'asc').map((t) => t.title);
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
  });
  it('createdAt desc giữ NGUYÊN thứ tự mảng mock', () => {
    expect(sortTours(TOURS, 'createdAt', 'desc').map((t) => t.slug)).toEqual(
      TOURS.map((t) => t.slug),
    );
  });
  it('createdAt asc là mảng đảo ngược', () => {
    expect(sortTours(TOURS, 'createdAt', 'asc').map((t) => t.slug)).toEqual(
      [...TOURS].reverse().map((t) => t.slug),
    );
  });
  it('không sửa mảng gốc tại chỗ', () => {
    const before = TOURS.map((t) => t.slug);
    sortTours(TOURS, 'basePrice', 'asc');
    sortTours(TOURS, 'createdAt', 'asc');
    expect(TOURS.map((t) => t.slug)).toEqual(before);
  });
});

describe('routeChain', () => {
  it('primary đứng đầu, phần còn lại giữ nguyên thứ tự', () => {
    const chain = routeChain([
      { slug: 'b', name: 'B', isPrimary: false },
      { slug: 'a', name: 'A', isPrimary: true },
      { slug: 'c', name: 'C', isPrimary: false },
    ]);
    expect(chain.map((d) => d.slug)).toEqual(['a', 'b', 'c']);
  });
  it('mảng rỗng trả mảng rỗng', () => {
    expect(routeChain([])).toEqual([]);
  });
  it('không sửa mảng gốc tại chỗ', () => {
    const input = [
      { slug: 'b', name: 'B', isPrimary: false },
      { slug: 'a', name: 'A', isPrimary: true },
    ];
    routeChain(input);
    expect(input.map((d) => d.slug)).toEqual(['b', 'a']);
  });
});

describe('discountPercent', () => {
  it('làm tròn xuống phần trăm giảm', () => {
    expect(discountPercent('175.00', '236.00')).toBe(25);
  });
  it('không có giá gạch thì trả null', () => {
    expect(discountPercent('189.00', null)).toBeNull();
  });
  it('giá gạch KHÔNG cao hơn giá gốc thì trả null — không hiện −0% hay số âm', () => {
    expect(discountPercent('189.00', '189.00')).toBeNull();
    expect(discountPercent('189.00', '100.00')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('định dạng USD không phần lẻ', () => {
    expect(formatMoney('189.00', 'USD')).toBe('$189');
  });
  it('giữ đúng độ lớn với số hàng nghìn', () => {
    expect(formatMoney('1480.00', 'USD')).toBe('$1,480');
  });
});

describe('departureStatus', () => {
  it('0 ghế là hết chỗ', () => {
    expect(departureStatus(0)).toBe('sold-out');
  });
  it('1..3 ghế là sắp hết', () => {
    expect(departureStatus(1)).toBe('limited');
    expect(departureStatus(3)).toBe('limited');
  });
  it('từ 4 ghế trở lên là còn chỗ', () => {
    expect(departureStatus(4)).toBe('available');
    expect(departureStatus(12)).toBe('available');
  });
});

describe('formatDateRange', () => {
  it('gộp tháng khi cùng tháng', () => {
    expect(formatDateRange('2026-08-21', '2026-08-30')).toBe('21–30 Aug 2026');
  });
  it('cùng một ngày thì chỉ hiện một ngày', () => {
    expect(formatDateRange('2026-08-14', '2026-08-14')).toBe('14 Aug 2026');
  });
  it('không gộp khi khác tháng', () => {
    expect(formatDateRange('2026-08-28', '2026-09-04')).toBe('28 Aug – 4 Sep 2026');
  });
  it('khác năm thì hiện cả hai năm', () => {
    expect(formatDateRange('2026-12-28', '2027-01-05')).toBe('28 Dec 2026 – 5 Jan 2027');
  });
});

describe('formatDate', () => {
  it('in một ngày lịch dạng "D MMM YYYY"', () => {
    expect(formatDate('2026-08-21')).toBe('21 Aug 2026');
  });
  it('không lệch ngày ở đầu/cuối tháng — tách chuỗi, KHÔNG qua new Date()', () => {
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });
});

describe('formatTicketDate — ngày ngắn kiểu vé máy bay ("24 AUG"), dùng cho khoảnh khắc primary', () => {
  it('ngày + tháng viết tắt HOA, KHÔNG năm', () => {
    expect(formatTicketDate('2026-08-24')).toBe('24 AUG');
  });
  it('không đệm 0 ở ngày một chữ số', () => {
    expect(formatTicketDate('2026-01-05')).toBe('5 JAN');
  });
});

describe('groupPoliciesByKind', () => {
  it('thứ tự nhóm cố định Cancellation → Booking → General', () => {
    const groups = groupPoliciesByKind([
      { kind: 'GENERAL', title: 'g', body: 'g' },
      { kind: 'BOOKING', title: 'b', body: 'b' },
      { kind: 'CANCELLATION', title: 'c', body: 'c' },
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['CANCELLATION', 'BOOKING', 'GENERAL']);
  });
  it('nhóm rỗng bị loại khỏi kết quả', () => {
    const groups = groupPoliciesByKind([{ kind: 'BOOKING', title: 'b', body: 'b' }]);
    expect(groups.map((g) => g.kind)).toEqual(['BOOKING']);
  });
  it('mảng rỗng trả mảng rỗng', () => {
    expect(groupPoliciesByKind([])).toEqual([]);
  });
});

describe('relatedTours', () => {
  it('không bao giờ chứa chính nó', () => {
    const related = relatedTours(TOURS, 'ha-long-bay-cruise', 3);
    expect(related.map((t) => t.slug)).not.toContain('ha-long-bay-cruise');
  });
  it('ưu tiên cùng chuyên mục trước', () => {
    const related = relatedTours(TOURS, 'sa-pa-terraces-trek', 3);
    expect(related[0]?.category.slug).toBe('trekking');
  });
  it('hết cùng chuyên mục thì tới tour chia chung destination', () => {
    // beaches chỉ có một tour (phu-quoc-reef-days), nên gợi ý đầu tiên phải là
    // tour khác cùng đi Phú Quốc chứ không phải tour ngẫu nhiên.
    const related = relatedTours(TOURS, 'phu-quoc-reef-days', 3);
    expect(related[0]?.slug).toBe('phu-quoc-sunset-sail');
  });
  it('trả đúng số lượng yêu cầu', () => {
    expect(relatedTours(TOURS, 'ha-long-bay-cruise', 3)).toHaveLength(3);
  });
  it('slug lạ vẫn trả danh sách chứ không nổ', () => {
    expect(relatedTours(TOURS, 'khong-ton-tai', 3)).toHaveLength(3);
  });
});

describe('tourGallery', () => {
  const item = (
    role: MockMediaItem['role'],
    sortOrder: number,
    type: MockMediaItem['type'] = 'IMAGE',
  ): MockMediaItem => ({
    publicId: `p${sortOrder}-${role}`,
    url: `https://cdn.example/${sortOrder}.jpg`,
    type,
    role,
    posterUrl: null,
    width: 1600,
    height: 1067,
    alt: null,
    sortOrder,
  });

  it('ảnh hero đứng đầu dù sortOrder của nó lớn hơn', () => {
    // Ô lớn của khảm là ảnh dẫn, không phải "ảnh có sortOrder nhỏ nhất".
    const result = tourGallery([item('gallery', 1), item('gallery', 2), item('hero', 9)]);
    expect(result[0]?.role).toBe('hero');
  });

  it('phần còn lại giữ đúng thứ tự sortOrder', () => {
    const result = tourGallery([item('gallery', 3), item('hero', 0), item('gallery', 1)]);
    expect(result.map((m) => m.sortOrder)).toEqual([0, 1, 3]);
  });

  it('bỏ VIDEO — gallery hiện tại chỉ render ảnh', () => {
    const result = tourGallery([item('hero', 0), item('gallery', 1, 'VIDEO')]);
    expect(result).toHaveLength(1);
  });

  it('bỏ role avatar và body — chúng thuộc chỗ khác, không phải gallery tour', () => {
    const result = tourGallery([item('hero', 0), item('avatar', 1), item('body', 2)]);
    expect(result).toHaveLength(1);
  });

  it('mảng rỗng cho mảng rỗng, không throw', () => {
    expect(tourGallery([])).toEqual([]);
  });

  it('không có hero thì ảnh gallery đầu tiên lên làm ảnh dẫn', () => {
    // Nhánh thật khi biên tập upload ảnh mà quên đánh dấu hero.
    const result = tourGallery([item('gallery', 5), item('gallery', 2)]);
    expect(result.map((m) => m.sortOrder)).toEqual([2, 5]);
  });
});

describe('averageRating', () => {
  const r = (rating: number): MockReview => ({
    id: `r${rating}`,
    rating,
    title: null,
    body: 'x',
    authorName: 'A',
    authorDeleted: false,
    createdAt: '2026-07-01T00:00:00.000Z',
  });

  it('làm tròn tới MỘT chữ số thập phân — khớp Decimal(2,1) của cột denormalize', () => {
    expect(averageRating([r(5), r(4), r(4)])).toBe(4.3);
  });

  it('mảng rỗng cho null, KHÔNG phải 0 — chưa ai đánh giá khác bị chấm 0 điểm', () => {
    expect(averageRating([])).toBeNull();
  });

  it('một review thì trung bình là chính nó', () => {
    expect(averageRating([r(4)])).toBe(4);
  });

  it('không bao giờ vượt 5 hay xuống dưới 1 khi mọi rating hợp lệ', () => {
    expect(averageRating([r(5), r(5)])).toBe(5);
    expect(averageRating([r(1), r(1)])).toBe(1);
  });
});

describe('tourReviews', () => {
  const rv = (id: string, createdAt: string, authorDeleted = false): MockReview => ({
    id,
    rating: 5,
    title: null,
    body: 'x',
    authorName: authorDeleted ? null : 'A',
    authorDeleted,
    createdAt,
  });

  it('mới nhất trước', () => {
    const result = tourReviews([
      rv('old', '2026-05-01T00:00:00.000Z'),
      rv('new', '2026-07-01T00:00:00.000Z'),
    ]);
    expect(result.map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('tác giả đã xoá tài khoản CHÌM xuống cuối, kể cả khi review mới hơn', () => {
    // Đúng thứ tự server: `authorDeleted asc → createdAt desc`. Nếu client sắp
    // khác server thì trang 1 tĩnh và trang 1 từ API sẽ ra hai danh sách khác nhau.
    const result = tourReviews([
      rv('deleted-but-newest', '2026-08-01T00:00:00.000Z', true),
      rv('kept', '2026-06-01T00:00:00.000Z'),
    ]);
    expect(result.map((r) => r.id)).toEqual(['kept', 'deleted-but-newest']);
  });

  it('trả mảng MỚI — mock là hằng số dùng chung', () => {
    const input = [rv('a', '2026-07-01T00:00:00.000Z')];
    expect(tourReviews(input)).not.toBe(input);
  });
});

describe('formatReviewDate', () => {
  it('ISO datetime ra "tháng năm" đọc được', () => {
    expect(formatReviewDate('2026-07-18T09:12:00.000Z')).toBe('July 2026');
  });

  it('KHÁC formatDateRange: chuỗi này có giờ + Z nên new Date() là đúng', () => {
    // Bẫy "đừng dựng new Date()" chỉ áp cho date-only YYYY-MM-DD của departures —
    // chuỗi đó bị hiểu là UTC rồi hiển thị theo giờ máy, lệch một ngày ở múi giờ âm.
    // Ở đây có múi giờ tường minh nên không có chỗ nào để diễn giải sai.
    expect(formatReviewDate('2026-01-01T23:30:00.000Z')).toBe('January 2026');
  });
});
