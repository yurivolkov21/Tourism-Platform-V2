import type { BookingsListResult } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { BookingsToolbar, ResetFiltersButton } from '@/components/account/bookings-toolbar';
import { TripPager } from '@/components/account/trip-pager';
import { BookingAccordion } from '@/components/passport/booking-accordion';
import {
  BOOKINGS_COUNT_ID,
  type BookingsListParams,
  bookingsListHref,
  hasListFilters,
  pagerView,
} from '@/lib/bookings-list';

/**
 * Thân trang My bookings (spec P7 §7.2–7.4) — tách khỏi `page.tsx` để test được: Vitest của
 * web không quét `src/app/**`. Trang lo phiên, URL, lời gọi API và chuyển trang; component này
 * lo mọi thứ khách thấy dưới hero.
 *
 * - Khách chưa có đơn nào: trạng thái trống cũ, không bày hàng lọc.
 * - Dòng đếm: đang lọc hay tìm thì hiện "{total} of {overallTotal} trips"; chưa lọc thì
 *   "{total} trips" chỉ cho trình đọc màn hình, vì hero đã in đúng số ấy.
 * - Lọc ra rỗng: "No trips match" kèm nút Reset về danh sách gốc (`router.replace`, như hàng lọc).
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
  const pager = pagerView(params, result.totalPages, result.total, result.limit);
  const filtered = hasListFilters(params);

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
      {/* `aria-live`: lọc xong thì trình đọc màn hình đọc lại số đơn mới. Sang trang thì tiêu điểm
          về đây (`TripPager`, `tabIndex={-1}`); câu tóm tắt trang chỉ trình đọc màn hình nghe.
          Chưa lọc thì số đơn trùng số hero đã in (`metaTrips` ở `page.tsx`), nên dòng chỉ còn cho
          trình đọc màn hình (user chốt 08/10); đang lọc thì "n of tổng" là điều hero không nói. */}
      <p
        id={BOOKINGS_COUNT_ID}
        tabIndex={-1}
        aria-live="polite"
        className={
          filtered
            ? 'mt-3 text-[12.5px] text-muted-foreground tabular-nums outline-none'
            : 'sr-only'
        }
      >
        {filtered ? tb.tripsOf(result.total, result.overallTotal) : t.metaTrips(result.total)}
        {pager === null ? null : <span className="sr-only">{`. ${pager.summary}`}</span>}
      </p>
      {result.total === 0 ? (
        <div className="mt-10 text-center">
          <h2 className="font-heading text-2xl font-semibold text-balance">{tb.noMatchHeading}</h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
            {tb.noMatchBody}
          </p>
          <ResetFiltersButton />
        </div>
      ) : (
        <div className={filtered ? 'mt-2.5' : 'mt-4'}>
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
