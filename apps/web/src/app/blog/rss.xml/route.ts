import { sortPostsByDate } from '@/lib/blog';
import { absoluteUrl, escapeXml } from '@/lib/site';
import { JOURNAL_POSTS } from '@/mocks/journal';

// Feed đặt NGOÀI route group (site): nó trả XML nên không được đi qua layout
// có navbar/footer.
export const dynamic = 'force-static';

export function GET() {
  const posts = sortPostsByDate(JOURNAL_POSTS);
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
    '    <title>Tourism — Journal</title>',
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
