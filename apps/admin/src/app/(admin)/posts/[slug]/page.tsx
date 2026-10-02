import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import { PostEditor } from '@/components/posts/editor/post-editor';
import { fetchAdminPost, fetchPostTagOptions, fetchPostTourOptions } from '@/lib/api/posts';
import { getServerSession } from '@/lib/api/session';
import { loadPostCoverLibraryAction, signPostCoverUploadAction, updatePostAction } from './actions';

/**
 * `/posts/[slug]` — trang sửa một bài (spec P4e-4 §4.4). Server component đọc bài kèm cookie
 * forward rồi trao cho form client; mọi server action đi xuống như prop (form test được với
 * hàm giả). Slug không có → `notFound()`.
 */
export const metadata: Metadata = {
  title: 'Edit post — Nexora back office',
};

export default async function PostEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookie = (await cookies()).toString();
  const [session, post, tagOptions, tourOptions] = await Promise.all([
    getServerSession(),
    fetchAdminPost(cookie, slug),
    fetchPostTagOptions(cookie),
    fetchPostTourOptions(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;
  if (!post) notFound();

  return (
    <AdminShell user={session}>
      <UnsavedChangesProvider>
        <PostEditor
          detail={post}
          update={updatePostAction}
          signCover={signPostCoverUploadAction}
          loadLibrary={loadPostCoverLibraryAction}
          tagOptions={tagOptions}
          tourOptions={tourOptions}
        />
      </UnsavedChangesProvider>
    </AdminShell>
  );
}
