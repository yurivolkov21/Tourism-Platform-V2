import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BookingsListView } from '@/components/account/bookings-list-view';
import { ContentHero } from '@/components/content/content-hero';
import { fetchMyBookingsPage } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { bookingsListApiInput, bookingsListHref, bookingsListParams } from '@/lib/bookings-list';
import type { RawSearchParam } from '@/lib/search-params';

/**
 * `/account/bookings` — My bookings (spec P7 §7, ADR-0054). Bộ lọc, từ khoá và số trang nằm
 * trên URL; server lọc, xếp theo hành trình và cắt 10 đơn mỗi trang. Thay "Load more" cộng dồn
 * cũ: sang trang không còn xáo thứ tự, và đơn thứ 51 trở đi tới được.
 */
export const metadata: Metadata = {
  title: 'My bookings — Nexora',
};

export default async function AccountBookingsPage({
  searchParams,
}: {
  // `string[]` khi một khoá lặp lại trên URL — `bookingsListParams` chuẩn hoá ở biên.
  searchParams: Promise<Record<string, RawSearchParam>>;
}) {
  const params = bookingsListParams(await searchParams);
  // Phiên hết hạn thì đăng nhập xong quay về ĐÚNG URL đang lọc, cùng nếp `/checkout/success`
  // (review P7 06/10: truyền path trần là mất bộ lọc, từ khoá và số trang).
  await requireSession(bookingsListHref(params));
  const cookie = (await cookies()).toString();
  const result = await fetchMyBookingsPage(cookie, bookingsListApiInput(params));

  // `page` vượt số trang (link cũ, gõ tay, vừa huỷ bớt đơn) → về trang cuối (spec §2.7).
  // `redirect` ném để ngắt render, nên không bọc trong `try/catch`.
  if (result.totalPages > 0 && params.page > result.totalPages) {
    redirect(bookingsListHref({ ...params, page: result.totalPages }));
  }

  const t = messages.passportBookings;
  return (
    <div>
      <ContentHero
        breadcrumb={t.breadcrumb}
        title={t.title}
        meta={t.metaTrips(result.overallTotal)}
        back={{ href: '/account', label: messages.accountBookings.backToPassport }}
      />
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <BookingsListView result={result} params={params} />
      </div>
    </div>
  );
}
