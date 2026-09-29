import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourPhotosForm } from '@/components/tours/editor/tour-photos-form';
import { TourPhotosUnavailable } from '@/components/tours/editor/tour-photos-unavailable';
import { hasKnownPhotos } from '@/lib/api/tours';
import {
  loadTourPhotoLibraryAction,
  setTourPhotosAction,
  signTourPhotoUploadsAction,
} from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Tour photos — Nexora back office' };

/** Bước Photos của khu sửa tour (spec F18 §2g). Phần đầu và `AdminShell` ở layout. */
export default async function TourPhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadAdminTour(slug);
  if (!detail) notFound();
  // Khe deploy (vòng review F18): API chưa trả ảnh thì không dựng form từ danh sách bịa.
  if (!hasKnownPhotos(detail)) return <TourPhotosUnavailable />;
  return (
    <TourPhotosForm
      detail={detail}
      save={setTourPhotosAction}
      sign={signTourPhotoUploadsAction}
      loadLibrary={loadTourPhotoLibraryAction}
    />
  );
}
