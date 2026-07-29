'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { PaginationBar } from '@/components/tours/pagination-bar';
import { TourCard } from '@/components/tours/tour-card';
import { paginate } from '@/lib/paginate';
import type { MockTourCard } from '@/mocks/types';

/** Hai hàng đầy trên lưới 3 cột (còn dư 2 ô ở hàng ba) — cùng con số
    `REGION_PAGE_SIZE` của Nexora. Mock hiện có 6 tour/vùng nên luôn ra ĐÚNG một
    trang; phân trang vẫn dựng vì đây là nhánh có thật khi gắn API (catalogue
    thật của một vùng vượt 8 tour dễ dàng), chỉ thanh điều khiển là tự ẩn. */
const REGION_PAGE_SIZE = 8;

/** Giá trị `active` khi không lọc theo địa điểm nào. Không phải slug của địa
    điểm nào cả nên không thể đụng nhau. */
const ALL = 'all';

const CHIP = 'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors';

/**
 * Khu TOURS của trang vùng — hàng chip lọc theo địa điểm + lưới `TourCard`,
 * phân trang 8/trang. Đây là nơi DUY NHẤT địa điểm của vùng xuất hiện: bản Task 5
 * có thêm một khu "places" dạng hàng, nhưng trang Nexora thật không có nó — địa
 * điểm ở đó là TAB LỌC, và một danh sách nơi chốn không dẫn đi đâu thì chỉ là
 * mục lục cho chính khu này.
 *
 * `'use client'` vì lọc + phân trang chạy hoàn toàn phía client (trang vẫn được
 * render tĩnh lúc build). KHÔNG đọc `?d=` từ URL như Nexora: v2 chưa có link nào
 * trỏ tới đây kèm query đó, thêm vào là dựng nhánh không ai đi.
 *
 * Nhận dữ liệu qua PROP, không tự import mock — để test được với fixture nhỏ.
 */
export function RegionTours({
  tours,
  places,
}: {
  tours: MockTourCard[];
  places: { slug: string; name: string }[];
}) {
  const t = messages.regionPage;
  const [active, setActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  // Lọc bằng `some()`: một tour chạm nhiều địa điểm, và chặng PHỤ vẫn tính là
  // "tour này đi qua đó". Lọc theo điểm đến chính sẽ giấu mất `ha-long-bay-cruise`
  // khỏi tab Ninh Bình dù nó ngủ đêm ở đó.
  const filtered =
    active === ALL
      ? tours
      : tours.filter((tour) => tour.destinations.some((dest) => dest.slug === active));

  const paged = paginate(filtered, page, REGION_PAGE_SIZE);

  // Đổi tab thì về trang 1 — giữ nguyên số trang cũ có thể rơi vào vùng trống
  // của tập kết quả mới.
  const selectPlace = (slug: string) => {
    setActive(slug);
    setPage(1);
  };

  return (
    // `id="tours"` là ĐÍCH của CTA `#tours` ở khu intro — đổi id ở đây là làm
    // chết cái nút đó, im lặng.
    <section id="tours" className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        {/* Số tour làm eyebrow — DẪN XUẤT từ `tours`, đúng cách `region-group.tsx`
            làm ở trang index. Đếm CẢ vùng (`tours`), không đếm tập đang lọc: đây
            là nhãn của khu, không phải bộ đếm kết quả — để nó nhảy theo từng chip
            là biến header thành một chỉ báo trạng thái thứ hai bên cạnh chính hàng
            chip đang bật. */}
        <SectionEyebrow>{messages.destinationsPage.toursLabel(tours.length)}</SectionEyebrow>
        <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
          {t.toursHeading}
        </h2>

        {/* `aria-pressed` chứ không phải `role="tab"`: đây là nhóm nút bật/tắt
            một bộ lọc, không phải tablist có panel tương ứng từng tab — dựng
            role tab thì bàn phím phải đi mũi tên và trình đọc màn hình sẽ hứa
            một cấu trúc không có thật. */}
        <div className="mt-8 flex flex-wrap gap-2">
          <FilterChip label={t.allTab} pressed={active === ALL} onSelect={() => selectPlace(ALL)} />
          {places.map((place) => (
            <FilterChip
              key={place.slug}
              label={place.name}
              pressed={active === place.slug}
              onSelect={() => selectPlace(place.slug)}
            />
          ))}
        </div>

        {paged.items.length === 0 ? (
          // Nhánh CÓ THẬT: một địa điểm mới chưa gắn tour nào. Lưới rỗng không
          // giải thích được gì — hai câu này thì có, và `/contact` là trang thật.
          <div className="mt-10 max-w-2xl">
            <p className="text-foreground">{t.noTours}</p>
            <p className="mt-2 text-pretty text-muted-foreground">{t.noToursBody}</p>
          </div>
        ) : (
          <>
            {/* Cùng lưới `related-tours.tsx`: gap-y lớn hơn gap-x vì card không
                có khung, hai hàng cần khoảng thở dọc rộng hơn. */}
            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {paged.items.map((tour) => (
                <TourCard key={tour.slug} tour={tour} />
              ))}
            </div>

            {/* Ẩn CẢ thanh khi chỉ có một trang, không chỉ ẩn dãy số: dòng
                "Showing 1–6 of 6" cộng một đường kẻ ngang dưới lưới là hai phần
                tử nói lại đúng thứ mắt vừa đếm xong. */}
            {paged.totalPages > 1 ? (
              <PaginationBar
                page={paged.page}
                totalPages={paged.totalPages}
                total={paged.total}
                pageSize={REGION_PAGE_SIZE}
                onChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/** Một chip lọc. Chip đang chọn tô bằng token VÙNG nên hàng chip đổi sắc theo
    vùng mà không cần bảng class riêng cho từng vùng (Nexora phải có `chipOn`). */
function FilterChip({
  label,
  pressed,
  onSelect,
}: {
  label: string;
  pressed: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onSelect}
      style={
        pressed
          ? { background: 'var(--region-primary)', borderColor: 'var(--region-primary)' }
          : undefined
      }
      className={cn(
        CHIP,
        pressed
          ? 'text-on-media'
          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
