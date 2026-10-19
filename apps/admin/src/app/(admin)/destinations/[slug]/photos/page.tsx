import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { DestinationPhotosForm } from '@/components/destinations/destination-photos-form';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import { fetchAdminDestinationPhotos } from '@/lib/api/destinations';
import { getServerSession } from '@/lib/api/session';
import { setDestinationPhotosAction, signDestinationPhotoUploadsAction } from '../../actions';

/**
 * `/destinations/[slug]/photos` — ảnh của một điểm đến (spec P4f Media §7, ADR-0060 §8). Server
 * component đọc danh sách kèm cookie forward rồi trao cho form client; hai server action đi xuống
 * như prop. Slug không có → `notFound()`. Fetch hỏng vì lý do khác thì NÉM, boundary lo — cũng là
 * đường của khe deploy khi admin mới lên trước API.
 */
export const metadata: Metadata = {
  title: 'Destination photos — Nexora back office',
};

export default async function DestinationPhotosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookie = (await cookies()).toString();
  const [session, detail] = await Promise.all([
    getServerSession(),
    fetchAdminDestinationPhotos(cookie, slug),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;
  if (!detail) notFound();

  return (
    <AdminShell user={session}>
      <UnsavedChangesProvider>
        <DestinationPhotosForm
          detail={detail}
          save={setDestinationPhotosAction}
          sign={signDestinationPhotoUploadsAction}
        />
      </UnsavedChangesProvider>
    </AdminShell>
  );
}
