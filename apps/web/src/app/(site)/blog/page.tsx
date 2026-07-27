import type { Metadata } from 'next';
import { BlogExplorer } from '@/components/blog/blog-explorer';
import { ContentHero } from '@/components/content/content-hero';
import { postCategories } from '@/lib/blog';
import { JOURNAL_POSTS } from '@/mocks/journal';

export const metadata: Metadata = {
  title: 'Journal — Tourism',
  description:
    'Notes from the road, written by the local guides who lead our trips — food, packing, seasons, and the places we keep going back to.',
  // Khai báo feed để trình duyệt/trình đọc feed tự phát hiện được — không thì
  // /blog/rss.xml tồn tại nhưng không ai tìm ra.
  alternates: {
    types: { 'application/rss+xml': '/blog/rss.xml' },
  },
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string }>;
}) {
  const { tag, q } = await searchParams;
  const categories = postCategories(JOURNAL_POSTS);
  // Truyền tag THÔ xuống BlogExplorer, không lọc theo categories.includes ở
  // đây: tag lạ (link cũ/gõ tay) phải khớp filterPostsByCategory ra mảng rỗng
  // → trạng thái rỗng "Nothing here yet", KHÔNG 404 và KHÔNG âm thầm rơi về
  // "All" (bug trước đây: lọc sạch tag lạ thành undefined làm URL vẫn ghi
  // ?tag=… nhưng hiện đủ 9 bài với chip "All" sáng).

  return (
    <>
      <ContentHero
        breadcrumb="Journal"
        title="Notes from the road"
        subtitle="Written by the guides who lead the trips — what to pack, where to eat, and when not to come."
      />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl">
          <BlogExplorer
            posts={JOURNAL_POSTS}
            categories={categories}
            initialTag={tag}
            initialQuery={q}
          />
        </div>
      </div>
    </>
  );
}
