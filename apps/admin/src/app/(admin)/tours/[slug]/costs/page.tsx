import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourCostsForm } from '@/components/tours/editor/tour-costs-form';
import { setTourCostsAction } from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Tour costs — Nexora back office' };

/** Bước Costs của khu làm việc (spec F17 §2h). Phần đầu và `AdminShell` ở layout. */
export default async function TourCostsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadAdminTour(slug);
  if (!detail) notFound();
  return <TourCostsForm detail={detail} save={setTourCostsAction} />;
}
