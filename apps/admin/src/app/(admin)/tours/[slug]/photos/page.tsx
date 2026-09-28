import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourPhotosForm } from '@/components/tours/editor/tour-photos-form';
import {
  loadTourPhotoLibraryAction,
  setTourPhotosAction,
  signTourPhotoUploadsAction,
} from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Tour photos — Nexora back office' };

/** Tab Photos của khu làm việc (spec F18 §2g). Phần đầu và `AdminShell` ở layout. */
export default async function TourPhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadAdminTour(slug);
  if (!detail) notFound();
  return (
    <TourPhotosForm
      detail={detail}
      save={setTourPhotosAction}
      sign={signTourPhotoUploadsAction}
      loadLibrary={loadTourPhotoLibraryAction}
    />
  );
}
