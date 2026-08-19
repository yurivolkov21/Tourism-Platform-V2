import { messages } from '@tourism/i18n';
import { ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrivateTripForm } from '@/components/booking/private-trip-form';
import { getServerSession } from '@/lib/api/session';
import { fetchTourDetail } from '@/lib/api/tours';
import { routeChain } from '@/lib/tours';

export const metadata: Metadata = {
  title: `${messages.booking.form.private.submit} — Tourism`,
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

  const t = messages.booking.page;

  return (
    // `pt-36` mượn ĐÚNG hằng số `/book` dùng để né navbar `fixed` — cùng lý do,
    // trang này cũng không có hero để ăn khoảng đó.
    <div className="mx-auto w-full max-w-6xl px-4 pt-36 pb-10 md:px-8 md:pb-14">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/tours" className="transition-colors hover:text-foreground">
          {messages.tourDetail.sections.departures}
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden="true" />
        <Link href={`/tours/${tour.slug}`} className="transition-colors hover:text-foreground">
          {t.backToTour}
        </Link>
      </nav>

      <header className="mt-6 flex flex-col gap-3">
        <h1 className="font-heading text-3xl font-semibold text-balance">{tour.title}</h1>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {routeChain(tour.destinations).map((d) => (
            <li key={d.slug} className="after:ml-2 after:content-['·'] last:after:content-['']">
              {d.name}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          {messages.tourDetail.durationValue(tour.durationDays)} ·{' '}
          {messages.tourDetail.groupSize(tour.maxGroupSize)}
        </p>
      </header>

      <div className="mt-10">
        <PrivateTripForm
          tourId={tour.id}
          maxGroupSize={tour.maxGroupSize}
          defaultName={session?.name ?? ''}
          defaultEmail={session?.email ?? ''}
        />
      </div>
    </div>
  );
}
