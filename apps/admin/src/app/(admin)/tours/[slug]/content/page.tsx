import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourContentForm } from '@/components/tours/editor/tour-content-form';
import { setTourContentAction } from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Tour FAQ and policies — Nexora back office' };

/** Bước FAQ & policies của khu làm việc (spec F17 §2h). Phần đầu và `AdminShell` ở layout. */
export default async function TourContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadAdminTour(slug);
  if (!detail) notFound();
  return <TourContentForm detail={detail} save={setTourContentAction} />;
}
