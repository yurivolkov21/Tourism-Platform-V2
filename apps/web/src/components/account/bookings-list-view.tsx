import type { BookingsListResult } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { BookingsToolbar } from '@/components/account/bookings-toolbar';
import { TripPager } from '@/components/account/trip-pager';
import { BookingAccordion } from '@/components/passport/booking-accordion';
import {
  BOOKINGS_LIST_PATH,
  type BookingsListParams,
  bookingsListHref,
  hasListFilters,
} from '@/lib/bookings-list';

/**
 * Thân trang My bookings (spec P7 §7.2–7.4) — tách khỏi `page.tsx` để test được: Vitest của
 * web không quét `src/app/**`. Trang lo phiên, URL, lời gọi API và chuyển trang; component này
 * lo mọi thứ khách thấy dưới hero.
 *
 * - Khách chưa có đơn nào: trạng thái trống cũ, không bày hàng lọc.
 * - Dòng đếm: "{total} trips"; đang lọc hay tìm thì "{total} of {overallTotal} trips".
 * - Lọc ra rỗng: "No trips match" kèm link Reset về danh sách gốc.
 * - `BookingAccordion` mang `key` theo URL: mỗi trang và mỗi bộ lọc dựng accordion MỚI, nên
 *   hàng đầu của trang mới mở sẵn. `defaultValue` chỉ được đọc lúc dựng — giữ accordion cũ thì
 *   sang trang 2 không hàng nào mở.
 */
export function BookingsListView({
  result,
  params,
}: {
  result: BookingsListResult;
  params: BookingsListParams;
}) {
  const t = messages.passportBookings;
  const tb = messages.accountBookings;

  if (result.overallTotal === 0) {
    return (
      <div className="mt-12 text-center">
        <h2 className="font-heading text-2xl font-semibold text-balance">{t.emptyHeading}</h2>
        <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
          {t.emptyBody}
        </p>
        <ButtonLink href="/tours" className="mt-6">
          {t.emptyCta}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <BookingsToolbar params={params} facets={result.facets} />
      {/* `aria-live`: lọc xong thì trình đọc màn hình đọc lại số đơn mới. */}
      <p aria-live="polite" className="mt-3 text-[12.5px] text-muted-foreground tabular-nums">
        {hasListFilters(params)
          ? tb.tripsOf(result.total, result.overallTotal)
          : t.metaTrips(result.total)}
      </p>
      {result.total === 0 ? (
        <div className="mt-10 text-center">
          <h2 className="font-heading text-2xl font-semibold text-balance">{tb.noMatchHeading}</h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
            {tb.noMatchBody}
          </p>
          <ButtonLink href={BOOKINGS_LIST_PATH} variant="outline" className="mt-6">
            {tb.reset}
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-2.5">
          {/* `result.today`: CHÍNH ngày API đã dùng để xếp và lọc trang này. */}
          <BookingAccordion
            key={bookingsListHref(params)}
            bookings={result.items}
            today={result.today}
          />
          <TripPager
            params={params}
            totalPages={result.totalPages}
            total={result.total}
            limit={result.limit}
          />
        </div>
      )}
    </div>
  );
}
