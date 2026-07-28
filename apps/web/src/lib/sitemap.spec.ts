import { describe, expect, it } from 'vitest';
import { JOURNAL_POSTS } from '@/mocks/journal';
import { TOURS } from '@/mocks/tours';
import { siteUrl } from './site';
import { sitemapEntries } from './sitemap';

const entries = sitemapEntries(TOURS, JOURNAL_POSTS);
const urls = entries.map((entry) => entry.url);

describe('sitemapEntries', () => {
  it('không có URL trùng — trùng lặp làm crawler hạ tin cậy cả sitemap', () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('mọi URL là tuyệt đối và cùng gốc site', () => {
    // Sitemap bắt buộc URL tuyệt đối; đường dẫn tương đối bị bỏ qua im lặng.
    for (const url of urls) expect(url.startsWith(`${siteUrl()}/`)).toBe(true);
  });

  it('phủ đủ 9 trang tĩnh có thật', () => {
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
    ]) {
      expect(urls).toContain(path === '/' ? `${siteUrl()}/` : `${siteUrl()}${path}`);
    }
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

  it('phần còn lại không vượt 0.7', () => {
    const rest = entries.filter(
      (entry) =>
        entry.url !== `${siteUrl()}/` &&
        entry.url !== `${siteUrl()}/tours` &&
        !/\/tours\/[^/]+$/.test(entry.url),
    );
    expect(rest.length).toBeGreaterThan(0);
    for (const entry of rest) expect(entry.priority).toBeLessThanOrEqual(0.7);
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
