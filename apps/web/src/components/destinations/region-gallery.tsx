import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { RegionTile } from '@/components/destinations/region-tile';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';
import type { MockRegion } from '@/mocks/types';

export type GalleryVariant = 'peaks' | 'lanterns' | 'panorama';

/**
 * Bốn cột của `peaks`. `pad` là khoảng lệch DỌC (chỉ từ `sm` trở lên), `heights`
 * là chiều cao hai ô trong cột.
 *
 * Bốn cột cộng lại luôn cao **468px**: `pad + h1 + gap(20) + h2`. Đó là điều kiện
 * để đáy dải THẲNG trong khi đỉnh dải RĂNG CƯA — nếu cả hai mép đều so le thì dải
 * đọc thành một khảm xếp lỗi chứ không thành đường chân trời. Cột nào sửa chiều
 * cao thì phải sửa `pad` bù lại đúng số đó.
 *
 * Thứ tự lệch 48 · 0 · 64 · 32 chọn để không cột nào cạnh cột bằng nó — hai cột
 * liền nhau cùng độ cao đọc ra một bậc thang, không ra đỉnh núi.
 *
 * Hàng TRÊN cao 208–288px trên cột rộng ~280px, tức ô gần vuông hoặc cao hơn rộng.
 * Bản đầu dùng 144–224px và chụp lại thì bốn ô nằm ngang đọc ra một lưới xô lệch
 * chứ không ra đường chân trời — chiều cao ô phải THẮNG chiều ngang để mắt đọc
 * mép trên thành một hình.
 */
const PEAK_COLUMNS = [
  { pad: 'sm:pt-12', heights: ['h-56', 'h-44'] },
  { pad: 'sm:pt-0', heights: ['h-72', 'h-40'] },
  { pad: 'sm:pt-16', heights: ['h-52', 'h-44'] },
  { pad: 'sm:pt-8', heights: ['h-64', 'h-40'] },
] as const;

/** Số ô mỗi biến thể dùng. Nhãn CẮT từ `galleryTiles` (10 mục) theo con số này —
    cần ít hơn thì cắt, KHÔNG bịa thêm nhãn. */
const TILE_COUNT: Record<GalleryVariant, number> = { peaks: 8, lanterns: 10, panorama: 3 };

/**
 * Khu "{region} in photos" — MỘT khu, BA bố cục.
 *
 * Ràng buộc user chốt: *"mỗi miền bắt buộc có gallery riêng"*, khác BỐ CỤC chứ
 * không chỉ khác số ô. Ba biến thể vì thế khác nhau ở hình khối, và mỗi hình cắm
 * vào cảnh vùng đó thật sự bán:
 *
 *  · **`peaks`** (Bắc) — bốn cột lệch dọc so le, đỉnh dải răng cưa như dãy núi.
 *  · **`lanterns`** (Trung) — một hàng ô vuông đều nhau treo trên "dây" dài ngắn
 *    khác nhau, cuộn ngang; Hội An là phố đèn lồng, và đây là hình của nó.
 *  · **`panorama`** (Nam) — ba ô thấp và dài xếp dọc, ô giữa lệch ngang: mặt nước
 *    của delta và biển đảo, thứ miền Nam bán.
 *
 * KHÔNG lightbox, và đó là chủ ý: bản Nexora mở lightbox vì ô của họ là ảnh thật;
 * ở đây mỗi ô là `RegionTile` giữ chỗ, nên một lightbox chỉ phóng to đúng cái icon
 * vừa nhìn. Khu này giới thiệu, không phải gallery tương tác — cùng lý lẽ
 * `JourneyMoments` đã dùng khi bỏ lightbox của `TourGallery`.
 *
 * Khu này LUÔN đứng trên băng phớt ở cả ba miền: nó là khu ảnh, và một khu ảnh
 * trên nền trang thì các ô trôi nổi không có gì giữ. Băng cũng là thứ tạo nhịp —
 * xem bản đồ khu ở `lib/region-theme.ts`.
 */
export function RegionGallery({
  region,
  variant,
}: {
  region: MockRegion;
  variant: GalleryVariant;
}) {
  const t = messages.regionPage;
  const labels = t.galleryTiles.slice(0, TILE_COUNT[variant]);

  return (
    <section
      style={{ background: SIGNATURE_BAND_BG }}
      className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          {/* `SectionEyebrow` là một hàng flex chiếm trọn bề ngang nên `text-center`
              của khối cha KHÔNG kéo nó vào giữa — phải bọc `flex justify-center`,
              đúng cách `home/gallery.tsx` (khu căn giữa duy nhất khác của site đang
              dùng eyebrow này) làm. */}
          <div className="flex justify-center">
            <SectionEyebrow>{t.galleryEyebrow}</SectionEyebrow>
          </div>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.galleryHeading(region.name)}
          </h2>
          <p className="mt-2 text-pretty text-muted-foreground">{t.gallerySubtitle}</p>
        </div>

        {variant === 'peaks' ? <PeaksLayout labels={labels} /> : null}
        {variant === 'lanterns' ? <LanternsLayout labels={labels} /> : null}
        {variant === 'panorama' ? <PanoramaLayout labels={labels} /> : null}
      </div>
    </section>
  );
}

/** Bốn cột, hai ô mỗi cột, đỉnh răng cưa. Dưới `sm` bỏ hẳn khoảng lệch (`sm:pt-*`)
    và về hai cột: ở bề ngang đó bốn cột so le chỉ còn là khoảng trống rời rạc. */
function PeaksLayout({ labels }: { labels: readonly string[] }) {
  return (
    <div className="mt-12 grid grid-cols-2 gap-4 sm:mt-16 sm:grid-cols-4 sm:gap-5">
      {PEAK_COLUMNS.map((column, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: PEAK_COLUMNS là hằng ở module scope, không sắp lại và không thêm bớt
          key={index}
          data-peak-column={index}
          className={cn('flex flex-col gap-4 sm:gap-5', column.pad)}
        >
          {column.heights.map((height, row) => {
            const label = labels[index * 2 + row];
            // `noUncheckedIndexedAccess` khai mọi truy cập theo chỉ số là có thể
            // `undefined`. Bốn cột × hai ô = 8 = đúng số nhãn đã cắt, nên nhánh này
            // không chạy — nhưng bỏ ô còn hơn render một `aria-label` rỗng.
            if (!label) return null;
            return <RegionTile key={label} label={label} className={cn('w-full', height)} />;
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Một hàng ô vuông treo trên dây, cuộn ngang.
 *
 * `overflow-x-auto` nằm trên CHÍNH container này — thiếu nó là mười ô đẩy thân
 * trang cuộn ngang, lỗi thấy ngay ở 390px.
 *
 * `data-lenis-prevent`: Lenis chặn wheel trên cả tài liệu nên lăn chuột trong vùng
 * cuộn lồng lại cuộn TRANG CHÍNH. Thuộc tính này trả wheel về cho đây — cùng khuôn
 * `departure-strip.tsx` và `departures-table.tsx`.
 *
 * `-mx-4 px-4 md:mx-0 md:px-0`: ở mobile dải chảy ra tới mép màn hình (âm lề đúng
 * bằng `px-4` của section, nên KHÔNG rộng hơn viewport và không sinh cuộn ngang cho
 * body), từ `md` thì về trong khung.
 *
 * "Dây" là `<span>` một pixel, dài ngắn xen kẽ, treo từ `border-t` của chính hàng
 * cuộn. Cả hai đều `aria-hidden` và không mang thông tin nào — nhưng chúng là thứ
 * làm hàng ô vuông đọc ra ĐÈN LỒNG chứ ra một carousel: đèn lồng Hội An treo so le
 * trên một sợi dây căng ngang lối, và đó là cảnh miền Trung bán. Bản đầu chỉ có dây
 * mà không có sợi ngang, chụp lại thì mấy đoạn dây treo lơ lửng từ khoảng không.
 * Sợi ngang nằm TRONG vùng cuộn nên nó chạy hết bề dài dải, đúng như một sợi dây
 * thật kéo dài quá tầm mắt.
 */
function LanternsLayout({ labels }: { labels: readonly string[] }) {
  return (
    <div
      data-gallery-scroll
      data-lenis-prevent
      className="-mx-4 mt-12 flex snap-x scroll-px-4 items-start gap-4 overflow-x-auto border-t border-border px-4 pb-2 sm:mt-16 sm:gap-5 md:mx-0 md:scroll-px-0 md:px-0"
    >
      {labels.map((label, index) => (
        <div key={label} className="flex shrink-0 snap-start flex-col items-center">
          <span
            aria-hidden="true"
            className={cn('w-px bg-border', index % 2 === 0 ? 'h-4' : 'h-10')}
          />
          <RegionTile label={label} className="aspect-square w-36 sm:w-44" />
        </div>
      ))}
    </div>
  );
}

/** Ba ô thấp và dài xếp dọc, ô GIỮA lệch ngang. Trong `flex flex-col` con mặc định
    `stretch`, nên `sm:ml-16` vừa đẩy ô sang phải vừa làm nó hẹp lại — không có
    cách nào tràn khỏi khung, khác hẳn một `translate-x`. */
function PanoramaLayout({ labels }: { labels: readonly string[] }) {
  return (
    <div className="mt-12 flex flex-col gap-5 sm:mt-16 sm:gap-6">
      {labels.map((label, index) => (
        <RegionTile
          key={label}
          label={label}
          className={cn('aspect-21/9 w-full', index === 1 && 'sm:ml-16')}
        />
      ))}
    </div>
  );
}
