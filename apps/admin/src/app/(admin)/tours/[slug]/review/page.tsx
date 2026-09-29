import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourReviewStep } from '@/components/tours/editor/tour-review-step';
import { setTourPublishedAction } from '../../actions';
import { deleteTourAction } from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Review & publish — Nexora back office' };

/**
 * Bước Review & publish (ADR-0049 §3). Phần đầu và `AdminShell` ở layout.
 *
 * Đọc tour chỉ để giữ đúng luật của các bước kia: không đọc được thì ra trang lỗi hay
 * 404 — cùng lượt đọc với layout nhờ React `cache()`, không tốn request. Thân bước đọc
 * bản MỚI NHẤT từ `TourDetailProvider`, đúng bản thanh bước đang đọc.
 */
export default async function TourReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await loadAdminTour(slug))) notFound();
  return <TourReviewStep setPublished={setTourPublishedAction} remove={deleteTourAction} />;
}
