import { describe, expect, it } from 'vitest';
import { JOURNAL_POSTS } from '@/mocks/journal';
import { REGIONS } from '@/mocks/regions';
import { TOURS } from '@/mocks/tours';
import { siteUrl } from './site';
import { sitemapEntries } from './sitemap';

const entries = sitemapEntries(TOURS, JOURNAL_POSTS, REGIONS);
const urls = entries.map((entry) => entry.url);

describe('sitemapEntries', () => {
  it('không có URL trùng — trùng lặp làm crawler hạ tin cậy cả sitemap', () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('mọi URL là tuyệt đối và cùng gốc site', () => {
    // Sitemap bắt buộc URL tuyệt đối; đường dẫn tương đối bị bỏ qua im lặng.
    for (const url of urls) expect(url.startsWith(`${siteUrl()}/`)).toBe(true);
  });

  it('phủ đủ 10 trang tĩnh có thật', () => {
    for (const path of [
      '/',
      '/about',
      '/contact',
      '/faq',
      '/terms',
      '/privacy',
      '/cancellation-policy',
      '/blog',
      '/tours',
      '/destinations',
    ]) {
      expect(urls).toContain(path === '/' ? `${siteUrl()}/` : `${siteUrl()}${path}`);
    }
  });

  // Trang vùng đã ship 30/07 nhưng sitemap bỏ sót suốt cụm Destinations — trang
  // sống mà crawler không thấy. Đây là Task 6 của plan, đóng ở đây.
  it('phủ đủ 3 trang vùng, đúng theo slug của REGIONS', () => {
    const regionUrls = urls.filter((url) => /\/destinations\/[^/]+$/.test(url));
    expect(regionUrls).toHaveLength(3);
    for (const region of REGIONS) {
      expect(regionUrls).toContain(`${siteUrl()}/destinations/${region.slug}`);
    }
  });

  // ⚠️ Bất biến QUAN TRỌNG NHẤT của nhóm này: sitemap và `generateStaticParams`
  // của `destinations/[region]/page.tsx` phải đọc CÙNG một nguồn (`REGIONS`).
  // Lệch nguồn thì sitemap liệt kê URL không được prerender (crawler ăn 404) hoặc
  // bỏ sót trang đã prerender — đúng lỗi vừa vá. Test này so số lượng với chính
  // `REGIONS` nên thêm/bớt một vùng là hai bên tự đi cùng nhau.
  it('URL vùng suy ra TỪ REGIONS, không phải danh sách gõ tay', () => {
    const regionUrls = urls.filter((url) => /\/destinations\/[^/]+$/.test(url));
    expect(regionUrls).toEqual(REGIONS.map((r) => `${siteUrl()}/destinations/${r.slug}`));
  });

  // 10 trang tĩnh + 16 tour + 9 bài + 3 vùng. Con số này là chốt chặn cuối: nếu ai
  // thêm một họ URL mà quên cập nhật đây thì test đỏ ngay.
  it('tổng 38 URL', () => {
    expect(entries).toHaveLength(38);
  });

  it('phủ đủ 16 tour, đúng theo slug của TOURS', () => {
    const tourUrls = urls.filter((url) => /\/tours\/[^/]+$/.test(url));
    expect(tourUrls).toHaveLength(16);
    for (const tour of TOURS) expect(tourUrls).toContain(`${siteUrl()}/tours/${tour.slug}`);
  });

  it('phủ đủ 9 bài blog, đúng theo slug của JOURNAL_POSTS', () => {
    const postUrls = urls.filter((url) => /\/blog\/[^/]+$/.test(url));
    expect(postUrls).toHaveLength(9);
    for (const post of JOURNAL_POSTS) expect(postUrls).toContain(`${siteUrl()}/blog/${post.slug}`);
  });

  it('KHÔNG liệt kê trang auth — không có giá trị index và lộ bề mặt tấn công', () => {
    for (const path of [
      'login',
      'register',
      'forgot-password',
      'reset-password',
      'verify-email',
      'two-factor',
    ]) {
      expect(urls.some((url) => url.includes(path))).toBe(false);
    }
  });

  it('không URL nào có dấu / ở cuối, trừ trang gốc', () => {
    // `/about/` và `/about` là hai URL khác nhau với crawler; canonical của các
    // trang đều là bản KHÔNG có dấu gạch cuối.
    for (const url of urls) {
      if (url === `${siteUrl()}/`) continue;
      expect(url.endsWith('/')).toBe(false);
    }
  });
});

describe('sitemapEntries — priority theo plan', () => {
  function priorityOf(path: string): number | undefined {
    const target = path === '/' ? `${siteUrl()}/` : `${siteUrl()}${path}`;
    return entries.find((entry) => entry.url === target)?.priority;
  }

  it('trang chủ 1.0, listing tour 0.9, tour detail 0.8', () => {
    expect(priorityOf('/')).toBe(1);
    expect(priorityOf('/tours')).toBe(0.9);
    expect(priorityOf(`/tours/${TOURS[0]?.slug}`)).toBe(0.8);
  });

  // Destinations đi CÙNG BẬC với Tours, không thấp hơn: hai cụm này là hai lối vào
  // catalogue ngang hàng — một cái theo chuyến, một cái theo nơi — và cả hai đều là
  // trang đích của điều hướng chính. Hạ Destinations xuống 0.7 là nói với crawler
  // rằng nó phụ, điều không đúng với cách navbar dựng.
  it('listing destinations 0.9 và trang vùng 0.8 — cùng bậc với cụm Tours', () => {
    expect(priorityOf('/destinations')).toBe(0.9);
    for (const region of REGIONS) {
      expect(priorityOf(`/destinations/${region.slug}`), region.slug).toBe(0.8);
    }
  });

  // Suy lại 30/07. Bản cũ liệt kê tay ba ngoại lệ (`/` · `/tours` · tour detail) rồi
  // khẳng định "phần còn lại ≤ 0.7"; thêm cụm Destinations là nó đỏ, và vá bằng cách
  // nối thêm ngoại lệ thì test biến thành một bản sao của thang priority — nó sẽ
  // xanh với BẤT KỲ thang nào miễn hai bên khớp nhau, tức không canh gì nữa.
  //
  // Bất biến thật sự đáng canh không phải "còn lại ≤ 0.7" mà là **thang có thứ tự
  // đúng**: trang chủ đứng một mình trên đỉnh, hai listing catalogue ngay dưới, trang
  // chi tiết dưới nữa, nội dung phụ trợ ở đáy. Viết như vậy thì đổi một giá trị bất kỳ
  // trong thang là đỏ, mà thêm một họ URL mới thì không phải sửa test.
  it('thang priority có thứ tự đúng — không phải bảng giá trị chép lại', () => {
    const home = priorityOf('/') ?? 0;
    const listings = [priorityOf('/tours') ?? 0, priorityOf('/destinations') ?? 0];
    const details = [
      priorityOf(`/tours/${TOURS[0]?.slug}`) ?? 0,
      priorityOf(`/destinations/${REGIONS[0]?.slug}`) ?? 0,
    ];
    const support = entries
      .filter((entry) =>
        /\/(about|contact|faq|terms|privacy|cancellation-policy|blog)$/.test(entry.url),
      )
      .map((entry) => entry.priority);

    expect(support.length).toBeGreaterThan(0);
    expect(home).toBeGreaterThan(Math.max(...listings));
    expect(Math.min(...listings)).toBeGreaterThan(Math.max(...details));
    expect(Math.min(...details)).toBeGreaterThan(Math.max(...support));
    // Trần tuyệt đối: sitemap khai mọi trang là 1.0 thì priority mất hết ý nghĩa.
    expect(Math.max(...support)).toBeLessThanOrEqual(0.7);
  });
});

describe('sitemapEntries — lastModified chỉ dùng ngày CÓ THẬT', () => {
  it('bài blog đã sửa lại dùng `updated`, bài chưa sửa dùng `date`', () => {
    const edited = JOURNAL_POSTS.find((post) => post.updated);
    const untouched = JOURNAL_POSTS.find((post) => !post.updated);
    expect(edited).toBeDefined();
    expect(untouched).toBeDefined();
    if (edited) {
      expect(entries.find((e) => e.url.endsWith(`/blog/${edited.slug}`))?.lastModified).toBe(
        edited.updated,
      );
    }
    if (untouched) {
      expect(entries.find((e) => e.url.endsWith(`/blog/${untouched.slug}`))?.lastModified).toBe(
        untouched.date,
      );
    }
  });

  it('tour KHÔNG có lastModified — contract mock không có ngày nào để nói thật', () => {
    // Bất biến này canh hai thứ: (a) không bịa `new Date()` cho crawler, (b) build
    // không được phụ thuộc thời điểm chạy — sitemap phải tất định. Khi contract
    // mở `updatedAt` cho tour thì sửa test này TRƯỚC rồi mới điền dữ liệu.
    for (const entry of entries.filter((e) => /\/tours\/[^/]+$/.test(e.url))) {
      expect(entry.lastModified).toBeUndefined();
    }
  });

  it('trang tĩnh cũng không bịa ngày', () => {
    expect(entries.find((e) => e.url === `${siteUrl()}/about`)?.lastModified).toBeUndefined();
  });
});
