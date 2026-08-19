import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrivateTripForm } from '@/components/booking/private-trip-form';
import { TourHeroBoard } from '@/components/tours/tour-hero-board';
import { getServerSession } from '@/lib/api/session';
import { fetchTourDetail } from '@/lib/api/tours';

export const metadata: Metadata = {
  title: `${messages.booking.form.private.submit} — Nexora`,
  robots: { index: false, follow: false },
};

/**
 * Hỏi báo giá cho chuyến riêng — nhánh tách khỏi `/book` ngày 19/08.
 *
 * **Trang này CÔNG KHAI, và đó là chủ đích chứ không phải sót.**
 * `PrivateTripForm` gọi `enquiries.create` browser-direct KHÔNG kèm auth
 * context (ADR-0016 §2), tức là luồng này vốn chưa bao giờ cần đăng nhập. Nó bị
 * chặn suốt thời gian qua chỉ vì tình cờ nằm chung trang với `/book` — trang có
 * `requireSession`. Tách route ra là trả lại đúng quyền vào cho nó.
 *
 * Vì vậy ở đây dùng `getServerSession` (trả `null` khi chưa đăng nhập) chứ
 * TUYỆT ĐỐI không `requireSession`, và `proxy.ts` matcher CỐ Ý không liệt kê
 * `/enquire`. Ai đã đăng nhập thì vẫn được điền sẵn tên/email; khách vãng lai
 * gõ tay — không ai bị chặn.
 *
 * Vẫn `noindex` như `/book`: đây là bề mặt giao dịch, không phải trang nội dung.
 */
export default async function EnquireTourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [session, tour] = await Promise.all([getServerSession(), fetchTourDetail(slug)]);
  if (!tour) notFound();

  return (
    <>
      <TourHeroBoard tour={tour} />

      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-10 md:px-8 md:pb-14">
        <PrivateTripForm
          tourId={tour.id}
          maxGroupSize={tour.maxGroupSize}
          defaultName={session?.name ?? ''}
          defaultEmail={session?.email ?? ''}
        />
      </div>
    </>
  );
}
