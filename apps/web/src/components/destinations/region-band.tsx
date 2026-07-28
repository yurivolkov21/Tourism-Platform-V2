import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { ArrowRightIcon } from 'lucide-react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { MockDestination, MockRegion } from '@/mocks/types';

/**
 * Một "trạm" trên đường kinh tuyến dọc của trang `/destinations` — khu 2 của
 * spec §5.1 (sửa lần hai, Task 4b). Ba band xếp chồng (Bắc → Trung → Nam) tạo
 * cảm giác MỘT đường kẻ chạy suốt trang chứ không phải ba hộp rời rạc. Xem
 * `docs/specs/2026-07-28-destinations-pages-design.md` §5.1.
 *
 * Thay `RegionCard` cũ (đã xoá) vì bản đó làm ba vùng TRỐNG GIỐNG NHAU — cùng
 * hộp, cùng bố cục, chỉ khác viền/nút — và bỏ phí 9 câu `description` có sẵn
 * trong mock. Band này in đủ mô tả từng địa điểm và tự nhiên khác hình dạng
 * theo dữ liệu thật (số địa điểm, độ dài mô tả) thay vì bố cục ép cứng.
 *
 * Kinh tuyến (đường dọc + chấm trạm) đặt trên phần tử MANG CHÍNH padding dọc
 * của band (`relative` + `absolute inset-y-0`) — inset của phần tử tuyệt đối
 * đo theo padding-box của tổ tiên định vị gần nhất, nên nó phủ luôn khoảng
 * padding trên/dưới, không chỉ vùng nội dung. Nhờ vậy khi 3 band xếp trực
 * tiếp cạnh nhau (không margin xen giữa), đường kẻ của band này nối liền
 * ngay vào đường kẻ của band kế — không đứt đoạn ở mép trên/dưới mỗi band.
 * `isLast` cắt đoạn dưới chấm (`h-16` bằng đúng `py-16` thay vì `h-full`) để
 * hành trình có điểm kết ở vùng Nam, không trôi tiếp vào khu phía sau.
 */
export function RegionBand({
  region,
  destinations,
  tourCount,
  isLast = false,
}: {
  region: MockRegion;
  destinations: MockDestination[];
  tourCount: number;
  /** Band cuối cùng (Nam) — kinh tuyến dừng lại ở chấm, không kéo tiếp xuống. */
  isLast?: boolean;
}) {
  const t = messages.destinationsPage;
  // Địa điểm CHÍNH của vùng = phần tử đầu trong danh sách — ảnh minh hoạ dùng
  // nhãn của nó (dữ liệu thật), không bịa mô tả ảnh.
  const [mainPlace] = destinations;

  return (
    <section
      data-region={region.key}
      // Nền PHỚT: pha `--region-primary` (tông GIỮA, cố định không theo theme)
      // với `--background` (theo theme) 88%.
      //
      // Vì sao `primary` chứ không phải `surface`: `--region-surface` là màu
      // SÁNG, nên ở dark mode pha nó vào nền tối sẽ LÀM SÁNG băng lên và kéo tụt
      // contrast của `--muted-foreground` đặt trên đó. Đo trên trình duyệt thật
      // (canvas → sRGB → WCAG): bản dùng `surface` 78% cho vùng Trung chỉ đạt
      // 4.35:1 ở dark mode, dưới ngưỡng AA 4.5 — 8 phần tử dính. Tông giữa dịch
      // SẮC mà gần như không dịch độ sáng, nên an toàn ở cả hai theme.
      //
      // Vẫn KHÔNG tô đặc: Nam (L 0.661) và Bắc (L 0.855) tô đặc thì ba băng sáng
      // khác nhau thấy rõ bằng mắt (đúng lỗi đã sửa cho hero ở §5.2).
      style={{ background: 'color-mix(in oklch, var(--region-primary), var(--background) 88%)' }}
      className="relative w-full"
    >
      <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-16 lg:px-24 xl:px-32">
        {/* Kinh tuyến — thuần trang trí, aria-hidden. Lệch trái đúng bằng
            padding trái của chính container (left-4 md:left-16…) nên đường kẻ
            đứng NGAY mép trái nơi nội dung thật sự bắt đầu, không phải mép
            trái màn hình. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-4 w-px md:left-16 lg:left-24 xl:left-32"
        >
          <div className={cn('w-px bg-border', isLast ? 'h-16' : 'h-full')} />
          {/* Chấm trạm ngang mép trên tiêu đề vùng: `top-16` bằng đúng
              padding-top của container (py-16) — tức điểm h2 bắt đầu. */}
          <span
            aria-hidden="true"
            className="absolute top-16 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'var(--region-primary)' }}
          />
        </div>

        {/* Bố cục hai cột: trái nội dung, phải ảnh — dồn một cột dưới `md`.
            `pl-8 md:pl-12` chừa khoảng cách với kinh tuyến, độc lập với
            padding ngang của container nên không lệch ở bất kỳ breakpoint. */}
        <div className="grid grid-cols-1 gap-8 pl-8 md:grid-cols-2 md:items-center md:gap-12 md:pl-12">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-heading text-3xl font-medium text-foreground md:text-4xl">
                {region.name}
              </h2>
              <p className="mt-3 max-w-md text-pretty text-muted-foreground">{region.tagline}</p>
            </div>

            <div>
              {/* Số tour của VÙNG (đã dẫn xuất distinct ở `toursInRegion()`
                  phía gọi) — KHÔNG cộng dồn `destinations[].tourCount`, vì một
                  tour có thể chạm nhiều địa điểm cùng vùng. */}
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                {t.placesLabel} · {t.toursLabel(tourCount)}
              </p>
              <ul className="mt-3 flex flex-col divide-y divide-border/60">
                {destinations.map((dest) => (
                  <li key={dest.slug}>
                    {/* Cả dòng là LINK sang trang lọc tour CÓ THẬT — không phải
                        `/destinations/[region]/[place]`, trang đó không tồn tại. */}
                    <a
                      href={`/tours?destinations=${dest.slug}`}
                      className="group flex items-start justify-between gap-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {dest.name}
                        </span>
                        {dest.description ? (
                          <span className="mt-0.5 block text-sm text-pretty text-muted-foreground">
                            {dest.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.toursLabel(dest.tourCount)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA vùng — nền chính là `--region-primary`, chữ trắng.
                `ButtonLink`, KHÔNG `Button render={<a/>}`: mẫu đó gắn
                `role="button"` lên anchor và đè mất role `link`. */}
            <ButtonLink
              href={`/destinations/${region.slug}`}
              style={{ background: 'var(--region-primary)' }}
              className="mt-2 w-fit text-white hover:opacity-90"
            >
              {t.exploreRegion(region.name)}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>

          <ImagePlaceholder label={mainPlace?.name} className="aspect-4/3 w-full rounded-2xl" />
        </div>
      </div>
    </section>
  );
}
