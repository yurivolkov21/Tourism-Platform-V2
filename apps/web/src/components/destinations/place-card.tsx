import { messages } from '@tourism/i18n';
import { ArrowRightIcon } from 'lucide-react';
import type { MockDestination } from '@/mocks/types';

/**
 * Một địa điểm trên trang vùng — HÀNG rộng kẻ mảnh, KHÔNG phải thẻ có khung
 * (quyết định 2 của user 29/07). Dải ảnh full-bleed đã là chữ ký của
 * `/destinations`, còn thẻ có khung là hình dạng của trang listing; trang vùng
 * cần hình dạng thứ ba, và hàng rộng là thứ duy nhất còn chỗ cho `description`
 * ở trạng thái NGHỈ — thứ bản 3-thẻ cũ phải giấu sau hover.
 *
 * Đúng MỘT link mỗi hàng: cả hàng là `<a>`. Không nút phụ, không link lồng —
 * cảm ứng và bàn phím hoạt động y hệt chuột.
 *
 * Vạch ngăn giữa các hàng do PHÍA GỌI vẽ (`divide-y divide-border` trên
 * container). Nếu hàng tự vẽ viền dưới thì hàng cuối thừa một vạch treo lơ lửng.
 */
export function PlaceCard({ destination }: { destination: MockDestination }) {
  const t = messages.destinationsPage;

  return (
    <a
      href={`/tours?destinations=${destination.slug}`}
      className="group relative block py-8 md:py-10"
    >
      {/* Tint hover theo VÙNG — `--region-primary` do `[data-region]` ở div bọc
          trang gán. Chỉ 6%: đủ để hàng "sáng lên" mà không đổi nền thật, nên
          chữ KHÔNG cần đổi màu theo (đổi cả hai là hai tín hiệu cho một trạng
          thái, và màu chữ mới lại phải đi đo tương phản lần nữa). */}
      <div
        aria-hidden="true"
        style={{ background: 'var(--region-primary)' }}
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-[0.06] group-focus-visible:opacity-[0.06] motion-reduce:transition-none"
      />

      {/* `relative` để nội dung nằm TRÊN lớp tint — lớp tint là phần tử định vị
          nên nếu nội dung ở dòng chảy thường, tint sẽ vẽ đè lên chữ. */}
      <div className="relative flex flex-col gap-4 md:flex-row md:items-baseline md:justify-between md:gap-10">
        <div className="min-w-0 md:max-w-2xl">
          <h3 className="font-heading text-2xl leading-tight font-medium text-foreground md:text-3xl">
            {destination.name}
          </h3>
          {/* `description` nullable trong contract — không giữ chỗ cho đoạn
              rỗng, và tuyệt đối không in chữ "null". */}
          {destination.description ? (
            <p className="mt-2 text-pretty text-muted-foreground">{destination.description}</p>
          ) : null}
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
          {t.toursLabel(destination.tourCount)}
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
          />
        </span>
      </div>
    </a>
  );
}
