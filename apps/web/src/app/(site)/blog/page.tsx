import type { Metadata } from 'next';
import { BlogExplorer } from '@/components/blog/blog-explorer';
import { ContentHero } from '@/components/content/content-hero';
import { postCategories } from '@/lib/blog';
import { JOURNAL_POSTS } from '@/mocks/journal';

export const metadata: Metadata = {
  title: 'Journal — Tourism',
  description:
    'Notes from the road, written by the local guides who lead our trips — food, packing, seasons, and the places we keep going back to.',
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string }>;
}) {
  const { tag, q } = await searchParams;
  const categories = postCategories(JOURNAL_POSTS);
  // Tag lạ chỉ rơi về "All", KHÔNG 404: URL do người dùng gõ tay hoặc link cũ
  // thì trả danh sách đầy đủ vẫn tử tế hơn trang lỗi.
  const active = tag && categories.includes(tag) ? tag : undefined;

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
            initialTag={active}
            initialQuery={q}
          />
        </div>
      </div>
    </>
  );
}
