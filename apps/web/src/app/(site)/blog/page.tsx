import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryChips } from '@/components/blog/category-chips';
import { PostCard } from '@/components/blog/post-card';
import { ContentHero } from '@/components/content/content-hero';
import { Reveal } from '@/components/motion/reveal';
import { filterPostsByCategory, postCategories, sortPostsByDate } from '@/lib/blog';
import { JOURNAL_POSTS } from '@/mocks/journal';

export const metadata: Metadata = {
  title: 'Journal — Tourism',
  description:
    'Notes from the road, written by the local guides who lead our trips — food, packing, seasons, and the places we keep going back to.',
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const categories = postCategories(JOURNAL_POSTS);
  // Tag lạ chỉ dẫn tới danh sách rỗng, KHÔNG 404: URL do người dùng gõ tay
  // hoặc link cũ thì trả trang trống có lối thoát vẫn tử tế hơn trang lỗi.
  const active = tag && categories.includes(tag) ? tag : undefined;
  const posts = sortPostsByDate(filterPostsByCategory(JOURNAL_POSTS, tag));

  return (
    <>
      <ContentHero
        breadcrumb="Journal"
        title="Notes from the road"
        subtitle="Written by the guides who lead the trips — what to pack, where to eat, and when not to come."
      />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl">
          <CategoryChips categories={categories} active={active} />

          {posts.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-dashed p-12 text-center">
              <h2 className="font-heading text-xl font-medium text-foreground">
                Nothing filed under “{tag}” yet
              </h2>
              <p className="mt-2 text-pretty text-muted-foreground">
                Try another topic — or read everything we have.
              </p>
              <Link
                href="/blog"
                className="mt-5 inline-block text-sm font-medium text-primary hover:underline"
              >
                Clear filter
              </Link>
            </div>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <Reveal
                  key={post.slug}
                  delay={index * 0.05}
                  className={!active && index === 0 ? 'sm:col-span-2' : ''}
                >
                  {/* Bài nổi bật = bài MỚI NHẤT CỦA CẢ BLOG, nên khi đang lọc
                      thì bỏ — "nổi bật" không có nghĩa là đầu mỗi bộ lọc. */}
                  <PostCard post={post} featured={!active && index === 0} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
