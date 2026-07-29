import { messages } from '@tourism/i18n';
import { RegionTile } from '@/components/destinations/region-tile';
import type { MockRegion } from '@/mocks/types';

/**
 * Khu "{region} in photos" — khảm 10 ô theo nhịp `1 lớn · 2×2 · 2×2 · 1 lớn`,
 * đúng nhịp `Gallery` của Nexora dựng cho trang vùng.
 *
 * KHÔNG lightbox, và đó là chủ ý: bản Nexora mở lightbox vì ô của họ là ảnh
 * thật; ở đây mỗi ô là `RegionTile` giữ chỗ, nên một lightbox chỉ phóng to đúng
 * cái icon vừa nhìn. Khu này giới thiệu, không phải gallery tương tác — cùng
 * lý lẽ `JourneyMoments` đã dùng khi bỏ lightbox của `TourGallery`.
 */
export function RegionGallery({ region }: { region: MockRegion }) {
  const t = messages.regionPage;
  const labels = t.galleryTiles;

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.galleryHeading(region.name)}
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">{t.gallerySubtitle}</p>
        </div>

        {/* Bốn khối trên lưới 2 cột: khối 1 và 4 là MỘT ô lớn, khối 2 và 3 là cụm
            2×2 ô vuông.
            Ô lớn bỏ tỉ lệ cố định từ `md` trở lên (`md:aspect-auto md:h-full`) và
            để `stretch` mặc định của grid kéo nó cao bằng cụm 2×2 bên cạnh. Giữ
            `aspect-16/9` thì đo được một khoảng hụt ~290px dưới ô lớn ở mỗi hàng —
            cụm bốn ô vuông luôn cao hơn ô 16/9 cùng bề rộng. Đây đúng cái bẫy
            `gallery.tsx` của Nexora đã ghi chú (ô đơn phải lấp đầy ô lưới của nó).
            Dưới `md` lưới về một cột, không còn hàng để so, nên tỉ lệ 16/9 mới là
            thứ cho ô lớn chiều cao. */}
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <GalleryTile label={labels[0]} className="aspect-16/9 w-full md:aspect-auto md:h-full" />
          <GalleryCluster labels={labels.slice(1, 5)} />
          <GalleryCluster labels={labels.slice(5, 9)} />
          <GalleryTile label={labels[9]} className="aspect-16/9 w-full md:aspect-auto md:h-full" />
        </div>
      </div>
    </section>
  );
}

/** Cụm 2×2 ô vuông. */
function GalleryCluster({ labels }: { labels: readonly string[] }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      {labels.map((label) => (
        <GalleryTile key={label} label={label} className="aspect-square w-full" />
      ))}
    </div>
  );
}

/** Một ô. `label` optional vì `noUncheckedIndexedAccess` khai mọi truy cập theo
    chỉ số là có thể `undefined` — danh sách i18n có đúng 10 mục nên nhánh này
    không chạy, nhưng bỏ ô còn hơn render một `aria-label` rỗng. */
function GalleryTile({ label, className }: { label?: string; className: string }) {
  if (!label) return null;
  return <RegionTile label={label} className={className} />;
}
