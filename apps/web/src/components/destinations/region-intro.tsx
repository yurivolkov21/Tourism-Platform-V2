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

          {/* Nút primary MẶC ĐỊNH của hệ (ADR-0015: hết inline style theo vùng),
              nên `hover:bg-primary/80` của variant chạy lại bình thường. Nút này
              KHÔNG nằm trong scope `dark` nên cặp nền/chữ lật theo theme thật:
              đo 5.52:1 (light) / 4.11:1 (dark) — con số dark đúng bằng cặp
              `bg-primary`/`primary-foreground` mặc định của mọi nút primary
              trong repo, tức nợ toàn site đã ghi, không phải lớp lỗi mới. */}
          <ButtonLink href="#tours" className="mt-8">
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
                    {/* Chip ĐẶC (`bg-primary` + icon `primary-foreground`),
                        KHÔNG phải chip phớt. Bản chip phớt
                        (`color-mix(--primary, --background 88%)` + icon màu
                        primary) đã bị loại vì đo được ~3:1 hoặc thấp hơn — nền
                        pha 12% quá gần nền trang để đỡ một icon.
                        Sau ADR-0015 cả hai vế đều là token brand nên chúng cùng
                        lật theo theme: đo 5.52:1 (light) / 4.11:1 (dark). Nội
                        dung chip là ICON 24px nên ngưỡng là 3.0 — qua ở cả hai
                        theme. Đây cũng đúng cặp màu của CTA `#tours` và chip lọc
                        đang chọn ở khu Tours, nên cả trang giữ MỘT kiểu accent. */}
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
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
