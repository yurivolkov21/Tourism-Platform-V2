import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import {
  ArrowRightIcon,
  CompassIcon,
  type LucideIcon,
  MapPinIcon,
  SparklesIcon,
} from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import type { MockRegion } from '@/mocks/types';

/** Icon theo THỨ TỰ mục, đúng bộ `region-highlights.tsx` cũ dùng (khu đó đã gộp
    vào đây 29/07). Ba mục là hằng số của copy nên danh sách này không cần dài
    hơn; `?? SparklesIcon` là lưới an toàn nếu copy nở ra mục thứ tư. */
const HIGHLIGHT_ICONS: readonly LucideIcon[] = [SparklesIcon, CompassIcon, MapPinIcon];

/**
 * Khu 2 — đoạn dẫn của vùng: chữ bên trái, ba highlight xếp dọc bên phải. Port
 * `region-intro.tsx` của Nexora, khác hai chỗ:
 *  · CTA trỏ neo `#tours` NGAY TRÊN TRANG này (Nexora trỏ `#itineraries`, một
 *    khu họ không có).
 *  · Cột phải KHÔNG còn là bento ảnh (29/07): gallery ở khu 5 đã là khu ảnh
 *    riêng, nên ba ô ảnh giữ chỗ ở đây là ảnh LẶP LẠI không thêm thông tin gì
 *    mới. Gộp hẳn khu `RegionHighlights` cũ (`What makes {region} special`)
 *    vào cột phải — vẫn trả lời "vùng này đặc biệt ở đâu", chỉ đổi từ một khu
 *    đứng riêng có ba thẻ viền thành ba mục xếp dọc cạnh cột chữ.
 *
 * `tags` truyền từ page chứ không gõ tay trong i18n: chúng DẪN XUẤT từ
 * `regionGlance(tours).categories`, nên thêm/bớt tour là hàng chip tự đúng theo.
 * Nexora gõ tay nên chữ sai âm thầm mỗi lần catalogue đổi.
 */
export function RegionIntro({
  region,
  tags,
  highlights,
}: {
  region: MockRegion;
  tags: string[];
  highlights: readonly { title: string; body: string }[];
}) {
  const t = messages.regionPage;
  const copy = t.regions[region.key];
  const hasHighlights = highlights.length > 0;

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div
        className={cn(
          'mx-auto grid max-w-7xl gap-12',
          hasHighlights && 'lg:grid-cols-2 lg:items-center lg:gap-16',
        )}
      >
        {/* ── Trái: eyebrow + tiêu đề + hai đoạn + tags + CTA ──
            `highlights` rỗng (nhánh có thật khi gắn API: vùng chưa có copy
            highlight) thì cột này trải rộng `max-w-2xl` thay vì bó theo một
            lưới hai cột không còn cột kia để cân. */}
        <div className={hasHighlights ? undefined : 'max-w-2xl'}>
          {/* Vạch accent `h-1 w-12` màu vùng đã BỎ (29/07): chấm vuông của
              `SectionEyebrow` đã là dấu accent chuẩn của site, hai dấu chồng
              nhau trên cùng một header là thừa một. */}
          <SectionEyebrow>{t.introEyebrow}</SectionEyebrow>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.introHeading(region.name)}
          </h2>
          <p className="mt-2 text-lg text-pretty text-muted-foreground">{copy.intro}</p>
          <p className="mt-4 text-pretty text-muted-foreground">{copy.intro2}</p>

          {/* Vùng chưa có tour nào thì `tags` rỗng (chúng dẫn xuất từ chuyên mục
              của tour) — bỏ CẢ hàng, không để lại mỗi nhãn "Best for:" treo lơ
              lửng không theo sau thứ gì. */}
          {tags.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{t.bestForLabel}:</span>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* Nền là token VÙNG nên đặt qua `style`, và inline style luôn thắng
              `hover:bg-primary/90` của variant mặc định — hover đổi độ mờ thay
              vì đổi nền, nếu không nút này sẽ không phản hồi gì khi rê chuột. */}
          <ButtonLink
            href="#tours"
            style={{ background: 'var(--region-primary)' }}
            className="mt-8 text-on-media transition-opacity hover:opacity-90"
          >
            {t.browseCta(region.name)}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>

        {/* ── Phải: ba highlight xếp dọc — khu `What makes X special` cũ, GỘP
            vào đây 29/07 ──
            Rỗng thì bỏ hẳn cột: cột trái đã trải rộng ở trên, một cột rỗng bên
            cạnh là khoảng trống không giải thích được (cùng lý lẽ đã áp cho
            bento cũ và hàng `tags`). */}
        {hasHighlights ? (
          <div>
            <h3 className="font-heading text-xl font-medium text-foreground md:text-2xl">
              {t.highlightsHeading(region.name)}
            </h3>

            <div className="mt-6 flex flex-col gap-6">
              {highlights.map((item, i) => {
                const Icon = HIGHLIGHT_ICONS[i] ?? SparklesIcon;
                return (
                  <div key={item.title} className="flex items-start gap-4">
                    {/* Chip ĐẶC (nền `--region-primary` + icon `on-media`) —
                        GIỮ NGUYÊN cặp màu của `region-highlights.tsx` cũ, KHÔNG
                        đổi sang chip phớt dù cột này giờ nằm trên nền trang
                        trần (không khung, không băng signature kề bên).
                        Đã THỬ chip phớt (`color-mix(--region-primary,
                        --background 88%)` + icon màu vùng) trước, vì cột hẹp
                        không cần chip mạnh như một khu đứng riêng — nhưng ĐO
                        thật (script canvas, 3 vùng × 2 theme) ra đúng lớp lỗi
                        đã dính nhiều lần của cụm này: `--region-*` bất biến
                        theo theme còn `--background` lật, nên contrast rơi
                        4.10/7.14/3.89:1 ở light (qua ngưỡng 3.0) nhưng chỉ
                        2.81/1.62/2.95:1 ở dark (DƯỚI ngưỡng, cả ba vùng). Chip
                        đặc + on-media đo được 4.59–8.91:1 ở CẢ HAI theme (số
                        đo lại nằm trong báo cáo Task 5e) — cùng cặp màu CTA
                        `#tours` và tab đang chọn ở khu Tours đã dùng, nên cả
                        trang vẫn đúng MỘT kiểu accent. */}
                    <span
                      style={{ background: 'var(--region-primary)' }}
                      className="flex size-12 shrink-0 items-center justify-center rounded-full text-on-media"
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h4 className="font-heading text-lg font-medium text-foreground">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-pretty text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
