'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { PaginationBar } from '@/components/tours/pagination-bar';
import { TourCard } from '@/components/tours/tour-card';
import { paginate } from '@/lib/paginate';
import type { MockTourCard } from '@/mocks/types';

/**
 * Số tour mỗi trang. **6 chứ không phải 8** (user chốt 29/07).
 *
 * Lưới ở đây là `sm:grid-cols-2 lg:grid-cols-3`, nên con số phải chia hết cho
 * CẢ HAI: 6 = 3 hàng đầy ở khổ 2 cột và 2 hàng đầy ở khổ 3 cột. 8 để lại hàng
 * cuối khuyết 1 ô ở 3 cột; 9 thì đầy ở 3 cột nhưng khuyết ở 2 cột. 6 là con số
 * duy nhất dưới 12 không bỏ lại ô mồ côi ở bất kỳ khổ nào.
 *
 * Nexora dùng 8, nhưng nguyên tắc họ ghi trong comment là *"two full desktop
 * rows"* và lưới của họ **4 cột** — port trung thành nguyên tắc đó sang lưới 3
 * cột chính là 6, không phải chép lại con số.
 *
 * Mock hiện có đúng 6 tour/vùng nên vẫn luôn ra ĐÚNG một trang và thanh điều
 * khiển tự ẩn. Phân trang vẫn dựng vì đây là nhánh CÓ THẬT khi gắn API — một
 * vùng vượt 6 tour là chuyện thường. Hệ quả cần biết: tour thứ 7 của một vùng
 * sẽ tạo ra trang 2 chỉ có một card.
 *
 * EXPORT **không phải** để spec thôi gõ lại con số. Spec CỐ TÌNH giữ literal
 * riêng làm chốt chặn: nếu ai đổi cỡ trang ở đây mà không đổi test thì test đỏ
 * ngay — import hằng số vào sẽ khiến test âm thầm đi theo mọi giá trị và mất
 * hẳn khả năng bắt thay đổi ngoài ý muốn. Export chỉ để spec **so hai con số
 * với nhau** trong một test riêng, nên lệch là báo thẳng chứ không hỏng lòng
 * vòng qua một phép đếm card.
 */
export const REGION_PAGE_SIZE = 6;

/** Giá trị `active` khi không lọc theo địa điểm nào. Không phải slug của địa
    điểm nào cả nên không thể đụng nhau. */
const ALL = 'all';

const CHIP = 'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors';

/**
 * Khu TOURS của trang vùng — hàng chip lọc theo địa điểm + lưới `TourCard`,
 * phân trang 6/trang. Đây là nơi DUY NHẤT địa điểm của vùng xuất hiện: bản Task 5
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

        {/* Vùng thông báo cho trình đọc màn hình. Lọc bằng chip hoặc bấm sang
            trang khác thay TOÀN BỘ nội dung lưới mà không có gì được nói ra —
            `/tours` đã có tiền lệ (`tours-explorer.tsx` gắn role=status +
            aria-live lên số kết quả).

            Đặt ở ĐÂY, ngoài nhánh rỗng, để vùng live tồn tại LIÊN TỤC trong DOM
            kể cả lúc 0 kết quả: một vùng live chỉ xuất hiện cùng lúc nội dung đổi
            thường bị trình đọc màn hình bỏ qua vì nó chưa kịp được theo dõi.

            `sr-only` chứ không in ra màn hình: người nhìn thấy đã có chip đang bật
            và chính các card để đếm; thêm một dòng số hiện hình là dựng chỉ báo
            trạng thái THỨ HAI cạnh hàng chip — đúng thứ comment ở eyebrow trên kia
            từ chối. Người dùng trình đọc màn hình thì không có cả hai manh mối đó.

            Đếm `paged.items.length` trên nền `paged.total` (số card đang hiện /
            tập đã lọc) chứ không phải `filtered.length` trên nền `tours.length`:
            cách sau đứng yên khi bấm Next, tức bỏ đúng một nửa vấn đề. Dùng lại
            `resultsHeading` sẵn có — nó tự thu về "3 tours" khi hai số bằng nhau
            và cho "0 tours" ở nhánh rỗng, sạch hơn "Showing 0–0 of 0". */}
        <p role="status" aria-live="polite" className="sr-only">
          {messages.toursPage.resultsHeading(paged.items.length, paged.total)}
        </p>

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

/** Một chip lọc. Chip đang chọn dùng cặp `bg-primary`/`text-primary-foreground`
    mặc định của hệ (ADR-0015: bỏ tint theo vùng) — hết inline style, nên chip ăn
    theo hover/focus của hệ như mọi bề mặt primary khác. Đo 5.52:1 light /
    4.11:1 dark; chữ 14px nên ngưỡng là 4.5 và con số dark trượt — nó đúng bằng
    cặp mặc định của toàn repo, nợ đã ghi ở ADR-0015 §Hệ quả. */
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
      className={cn(
        CHIP,
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
