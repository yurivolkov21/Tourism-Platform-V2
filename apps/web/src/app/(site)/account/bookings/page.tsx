import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { BookingCard } from '@/components/account/booking-card';
import { MOCK_BOOKINGS } from '@/mocks/account';

/**
 * `/account/bookings` — list mọi booking (spec §3, pha A1 TĨNH). Đọc trực
 * tiếp `MOCK_BOOKINGS`, KHÔNG gọi `bookings.mine` — Task 6 (A2) thay bằng
 * fetch thật (`?page=` server component, không client state — giữ dynamic).
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

export default function AccountBookingsPage() {
  const t = messages.accountBookings;
  // Mới nhất trước (spec §3, khớp thứ tự `bookings.mine` thật) — mock KHÔNG
  // tự theo thứ tự này (Task 2 sắp theo nhánh trạng thái để dễ đọc), nên sort
  // lại ở đây thay vì sửa thứ tự mock.
  const bookings = [...MOCK_BOOKINGS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
          <ul className="flex flex-col gap-4">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </ul>
          {/* A1: nút hiện diện tĩnh, chưa phân trang thật (mock chỉ 7 dòng,
              vừa một trang) — A2 (Task 6) nối `?page=` server component. */}
          <div className="flex justify-center">
            <Button type="button" variant="outline">
              {t.loadMore}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
