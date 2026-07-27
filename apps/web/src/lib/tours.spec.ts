import { describe, expect, it } from 'vitest';
import { TOURS } from '@/mocks/tours';
import {
  departureStatus,
  discountPercent,
  filterToursByCategory,
  filterToursByDestination,
  filterToursByFeatured,
  formatDateRange,
  formatMoney,
  groupPoliciesByKind,
  relatedTours,
  routeChain,
  searchTours,
  sortTours,
  tourCategories,
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

describe('filterToursByCategory', () => {
  it('không truyền slug thì trả nguyên danh sách', () => {
    expect(filterToursByCategory(TOURS, undefined)).toHaveLength(TOURS.length);
  });

  it('slug lạ cho mảng RỖNG — không âm thầm rơi về "All"', () => {
    expect(filterToursByCategory(TOURS, 'khong-ton-tai')).toEqual([]);
  });

  it('lọc đúng theo slug chuyên mục', () => {
    const result = filterToursByCategory(TOURS, 'trekking');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.category.slug === 'trekking')).toBe(true);
  });
});

describe('filterToursByDestination', () => {
  it('mọi kết quả đều thật sự đi qua destination đó', () => {
    const result = filterToursByDestination(TOURS, 'ninh-binh');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.destinations.some((d) => d.slug === 'ninh-binh'))).toBe(true);
  });

  it('khớp cả khi destination chỉ là chặng PHỤ, không phải primary', () => {
    // ha-long-bay-cruise có primary = ha-long, ninh-binh là chặng phụ. Nexora
    // so theo TÊN destination chính nên bỏ lọt đúng trường hợp này.
    const result = filterToursByDestination(TOURS, 'ninh-binh');
    const halong = result.find((t) => t.slug === 'ha-long-bay-cruise');
    expect(halong).toBeDefined();
    expect(halong?.destinations.find((d) => d.slug === 'ninh-binh')?.isPrimary).toBe(false);
  });

  it('không truyền slug thì trả nguyên danh sách', () => {
    expect(filterToursByDestination(TOURS, undefined)).toHaveLength(TOURS.length);
  });

  it('slug lạ cho mảng rỗng', () => {
    expect(filterToursByDestination(TOURS, 'khong-ton-tai')).toEqual([]);
  });
});

describe('filterToursByFeatured', () => {
  it('undefined nghĩa là KHÔNG lọc, khác hẳn false', () => {
    expect(filterToursByFeatured(TOURS, undefined)).toHaveLength(TOURS.length);
  });
  it('true chỉ giữ tour featured', () => {
    const result = filterToursByFeatured(TOURS, true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.isFeatured)).toBe(true);
  });
  it('false chỉ giữ tour KHÔNG featured', () => {
    const result = filterToursByFeatured(TOURS, false);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => !t.isFeatured)).toBe(true);
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
