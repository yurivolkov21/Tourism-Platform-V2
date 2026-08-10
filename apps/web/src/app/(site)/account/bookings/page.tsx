import { messages } from '@tourism/i18n';
import { buttonVariants } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { BookingCard } from '@/components/account/booking-card';
import { groupBookingsByTime } from '@/lib/account-stats';
import { BOOKINGS_MAX_LIMIT, BOOKINGS_PAGE_SIZE, fetchMyBookings } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/bookings` — list mọi booking (spec §3, Task 6/A2: fetch thật thay
 * mock nội bộ cụm đã khai tử). Server đã `orderBy createdAt desc` — không cần sort lại
 * phía web như bản mock cũ.
 */
export const metadata: Metadata = {
  title: `${messages.accountBookings.title} — Tourism`,
  description: messages.accountBookings.subtitle,
  robots: { index: false },
};

function EmptyState() {
  const t = messages.accountBookings.emptyState;
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
        {t.heading}
      </h2>
      <p className="mt-3 text-pretty text-muted-foreground">{t.body}</p>
      <ButtonLink href="/tours" className="mt-6">
        {t.cta}
      </ButtonLink>
    </div>
  );
}

/**
 * "Load more" KHÔNG dùng client state (brief Task 6: server đọc `?page=`) —
 * `chunk` (tên tham số URL vẫn là `page` cho gọn) đếm số LẦN đã bấm "Load
 * more", KHÔNG phải offset trang chuẩn: fetch luôn `page: 1` với
 * `limit = chunk * BOOKINGS_PAGE_SIZE` (kẹp trần `BOOKINGS_MAX_LIMIT`) — nhờ
 * vậy link `?page=${chunk + 1}` CỘNG DỒN danh sách đã thấy thay vì thay hẳn
 * bằng trang kế (đúng nghĩa "load more", không phải "trang sau"), mà vẫn
 * không cần một dòng JS client nào — mỗi lần bấm là một điều hướng server
 * thật (URL chia sẻ được, back-button hoạt động đúng).
 */
export default async function AccountBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Chỉ cần GATE (defense-in-depth, `proxy.ts` đã chặn sớm — ADR-0017 §3) —
  // trang này không hiện tên/hồ sơ nên không giữ lại giá trị trả về.
  await requireSession('/account/bookings');

  const { page: pageParam } = await searchParams;
  // `Number('abc') || 1` → 1: `?page=` rác từ link cũ/bot mở ra chunk 1 chứ
  // không phải NaN.
  const chunk = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(chunk * BOOKINGS_PAGE_SIZE, BOOKINGS_MAX_LIMIT);

  const cookie = (await cookies()).toString();
  const paged = await fetchMyBookings(cookie, limit);
  const bookings = paged.items;
  // Còn nữa để tải VÀ chưa chạm trần limit — trần thì im re (biên hiếm gặp ở
  // quy mô capstone, xem comment `BOOKINGS_MAX_LIMIT`/`DASHBOARD_BOOKINGS_LIMIT`
  // ở `bookings.ts`).
  const hasMore = bookings.length < paged.total && limit < BOOKINGS_MAX_LIMIT;

  const t = messages.accountBookings;
  const grouped = groupBookingsByTime(bookings);
  // Thứ tự cố định: đang đi → sắp tới → đã qua. Khẩn trước, ký ức sau.
  const GROUPS = [
    { key: 'onTheRoad', items: grouped.onTheRoad },
    { key: 'upcoming', items: grouped.upcoming },
    { key: 'past', items: grouped.past },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground">
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Ba nhóm thời gian thay danh sách phẳng. Nhóm rỗng KHÔNG render
              tiêu đề — một khối "On the road now" trống rỗng đọc như trang
              hỏng chứ không như tin "bạn đang ở nhà". */}
          {GROUPS.map(({ key, items }) =>
            items.length === 0 ? null : (
              <section key={key}>
                <h2 className="mb-2.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  {t.groups[key]}
                </h2>
                {/* MỘT tấm sheet ngăn hairline cho cả nhóm — `divide-y` giữ
                    đường ngăn mảnh, không nhân đôi viền như card rời. */}
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                  {items.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      showEndsHint={key === 'onTheRoad'}
                    />
                  ))}
                </ul>
              </section>
            ),
          )}
          {hasMore ? (
            <div className="flex justify-center">
              <Link
                href={`/account/bookings?page=${chunk + 1}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                {t.loadMore}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
