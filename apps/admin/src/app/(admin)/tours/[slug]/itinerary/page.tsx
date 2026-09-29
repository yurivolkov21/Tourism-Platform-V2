import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourItineraryForm } from '@/components/tours/editor/tour-itinerary-form';
import { setTourItineraryAction } from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Tour itinerary — Nexora back office' };

/** Bước Itinerary của khu làm việc (spec F17 §2h). Phần đầu và `AdminShell` ở layout. */
export default async function TourItineraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadAdminTour(slug);
  if (!detail) notFound();
  return <TourItineraryForm detail={detail} save={setTourItineraryAction} />;
}
