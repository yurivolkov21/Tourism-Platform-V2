import type { Metadata } from 'next';
import { BlogExplorer } from '@/components/blog/blog-explorer';
import { ContentHero } from '@/components/content/content-hero';
import { LoadErrorState } from '@/components/feedback/load-error-state';
import { fetchPosts, fetchPostTags } from '@/lib/api/posts';
import { contentState, settle } from '@/lib/api/resilience';

export const revalidate = 300; // ADR-0016 §3

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
  searchParams: Promise<{ tag?: string; q?: string; page?: string }>;
}) {
  const { tag, q, page } = await searchParams;
  // settle() không bao giờ throw — hai fetch chạy song song, mỗi cái tự đứng
  // độc lập, một cái sập không kéo cái kia theo.
  const [postsRes, tagsRes] = await Promise.all([settle(fetchPosts()), settle(fetchPostTags())]);
  // Chip là điều hướng PHỤ — posts sống mà tags chết thì vẫn hiện bài, hàng
  // chip rơi về rỗng; chỉ posts chết mới là lỗi trang (ADR-0016 §4).
  const state = contentState({
    failed: !postsRes.ok,
    isEmpty: (postsRes.data ?? []).length === 0,
  });
  // Truyền tag THÔ xuống BlogExplorer, không lọc theo tags.includes ở đây:
  // tag lạ (link cũ/gõ tay) phải khớp filterPostsByTag ra mảng rỗng → trạng
  // thái rỗng "Nothing here yet", KHÔNG 404 và KHÔNG âm thầm rơi về "All"
  // (bug trước đây: lọc sạch tag lạ thành undefined làm URL vẫn ghi ?tag=…
  // nhưng hiện đủ bài với chip "All" sáng).

  return (
    <>
      <ContentHero
        breadcrumb="Journal"
        title="Notes from the road"
        subtitle="Written by the guides who lead the trips — what to pack, where to eat, and when not to come."
      />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl">
          {state === 'error' ? (
            <LoadErrorState />
          ) : (
            // `state === 'empty'` để BlogExplorer tự xử — nó đã có màn
            // "Nothing here yet" cho trường hợp lọc/tìm ra rỗng.
            <BlogExplorer
              posts={postsRes.data ?? []}
              tags={tagsRes.data ?? []}
              initialTag={tag}
              initialQuery={q}
              // `Number('abc') || 1` → 1: ?page= rác từ link cũ hay bot mở ra trang
              // 1 chứ không phải NaN. `paginate` cũng tự kẹp page < 1.
              initialPage={Number(page) || 1}
            />
          )}
        </div>
      </div>
    </>
  );
}
