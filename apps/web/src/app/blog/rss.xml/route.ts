import { fetchPosts } from '@/lib/api/posts';
import { settle } from '@/lib/api/resilience';
import { sortPostsByDate } from '@/lib/blog';
import { absoluteUrl, escapeXml } from '@/lib/site';

// Feed đặt NGOÀI route group (site): nó trả XML nên không được đi qua layout
// có navbar/footer.
export const revalidate = 300;

export async function GET() {
  const postsRes = await settle(fetchPosts());
  // Feed sai (rỗng/thiếu bài) còn tệ hơn feed vắng hẳn: trả 503 để reader/crawler
  // biết đây là lỗi tạm thời, không phải "blog không còn bài nào" — khác nhánh
  // sitemap (feed không có ISR tự chữa kiểu "trang có link" để bù).
  if (!postsRes.ok) {
    return new Response('temporarily unavailable', { status: 503 });
  }
  const posts = sortPostsByDate(postsRes.data);
  const items = posts
    .map((post) =>
      [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(absoluteUrl(`/blog/${post.slug}`))}</link>`,
        `      <guid isPermaLink="true">${escapeXml(absoluteUrl(`/blog/${post.slug}`))}</guid>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        `      <pubDate>${new Date(post.date).toUTCString()}</pubDate>`,
        `      <category>${escapeXml(post.category)}</category>`,
        '    </item>',
      ].join('\n'),
    )
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Nexora — Journal</title>',
    `    <link>${escapeXml(absoluteUrl('/blog'))}</link>`,
    '    <description>Notes from the road, written by our local guides.</description>',
    '    <language>en</language>',
    items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
}
