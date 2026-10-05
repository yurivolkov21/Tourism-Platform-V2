import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { StripCreateParam } from '@/components/kit/strip-create-param';
import { PostsTable } from '@/components/posts/posts-table';
import { fetchAdminPosts } from '@/lib/api/posts';
import { getServerSession } from '@/lib/api/session';
import { wantsCreate } from '@/lib/create-param';
import { parsePostsSearchParams, postsHref } from '@/lib/posts-query';
import { toPostRowVM } from '@/lib/posts-view';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';
import { createPostAction } from './actions';

/**
 * `/posts` — bảng bài viết (spec P4e-4 §4.2). Server component đúng nếp `/tours`:
 * `searchParams` → input contract → fetch oRPC kèm cookie forward → một trang đã format
 * xuống bảng client. Hộp New post nhận server action qua prop (test được với hàm giả).
 * `create=1` của Quick Create không vào contract: nó chỉ mở sẵn hộp New post (spec
 * 2026-10-05 §2.5).
 */
export const metadata: Metadata = {
  title: 'Posts — Nexora back office',
};

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const query = parsePostsSearchParams(raw);
  const openCreate = wantsCreate(raw);
  const cookie = (await cookies()).toString();
  const [session, paged] = await Promise.all([getServerSession(), fetchAdminPosts(cookie, query)]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;

  // Trang mồ côi: tab co lại sau khi xoá hay gỡ đăng — về trang cuối còn thật.
  const orphan = orphanPageHref(paged, query, (page) => postsHref(query, { page }));
  if (orphan) redirect(orphan);

  return (
    <AdminShell user={session}>
      <PostsTable
        rows={paged.items.map(toPostRowVM)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        create={createPostAction}
        openCreate={openCreate}
      />
      {openCreate ? <StripCreateParam /> : null}
    </AdminShell>
  );
}
