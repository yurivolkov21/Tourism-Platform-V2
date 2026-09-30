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
 * Đọc tour MỖI lần vào bước và đưa bản ấy cho bước, như mọi bước khác: chuyển bước phía
 * client thì layout KHÔNG render lại, nên `cache()` chỉ gộp với layout ở lượt tải cả trang
 * (vòng review F19 — bản trước vứt lượt đọc này và dựng từ bản cũ của layout, hộp xoá đếm
 * sai số chuyến sẽ mất theo). Không đọc được thì ra trang lỗi hay 404.
 */
export default async function TourReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadAdminTour(slug);
  if (!detail) notFound();
  return (
    <TourReviewStep
      detail={detail}
      setPublished={setTourPublishedAction}
      remove={deleteTourAction}
    />
  );
}
