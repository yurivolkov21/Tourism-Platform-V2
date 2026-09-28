import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourDetailsForm } from '@/components/tours/editor/tour-details-form';
import { deleteTourAction, updateTourDetailsAction } from './actions';
import { loadAdminTour, loadTourEditorOptions } from './load-tour';

export const metadata: Metadata = { title: 'Tour details — Nexora back office' };

/** Tab Details của khu làm việc (spec F17 §2h). Phần đầu và `AdminShell` ở layout. */
export default async function TourDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [detail, options] = await Promise.all([loadAdminTour(slug), loadTourEditorOptions()]);
  if (!detail) notFound();
  return (
    <TourDetailsForm
      detail={detail}
      options={options}
      save={updateTourDetailsAction}
      remove={deleteTourAction}
    />
  );
}
