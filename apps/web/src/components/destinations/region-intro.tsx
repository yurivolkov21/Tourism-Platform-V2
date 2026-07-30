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
import { RevealBlock, RevealHeading, RevealLede } from '@/components/motion/reveal-header';
import { type EnterSignature, RevealItem } from '@/components/motion/reveal-item';
import { STAGGER } from '@/lib/motion';
import type { MockRegion } from '@/mocks/types';

export type IntroVariant = 'aside' | 'row' | 'stacked';

/**
 * Biến thể bố cục → chữ ký chuyển động của miền dùng nó (Task 5n).
 *
 * `intro` là khu DUY NHẤT (cùng `gallery`) có mặt ở cả ba miền, nên nó cũng là chỗ
 * duy nhất mà cả ba chữ ký cùng sống trong một file. Ánh xạ không phải tuỳ ý — mỗi
 * trục khớp với chính hình mà biến thể đó đã dựng:
 *
 *  · `aside` (Bắc) → `rise`: ba highlight xếp DỌC thành một cột, nên chúng dựng lên.
 *  · `row` (Trung) → `slide`: ba highlight thành một HÀNG NGANG ba cột, nên chúng
 *    trượt vào theo đúng trục mà mắt quét.
 *  · `stacked` (Nam) → `bloom`: khối chữ căn giữa là một nhịp NGHỈ giữa hai khu ảnh
 *    (xem JSDoc component), và một nhịp có hướng ở đây sẽ phá đúng cái nghỉ đó.
 *
 * `Record` đầy đủ chứ không `switch` có `default`: thêm biến thể thứ tư mà quên chữ
 * ký thì TS đỏ ngay, thay vì khu âm thầm chạy nhịp của vùng khác.
 */
const INTRO_ENTER: Record<IntroVariant, EnterSignature> = {
  aside: 'rise',
  row: 'slide',
  stacked: 'bloom',
};

/** Icon theo THỨ TỰ mục, đúng bộ `region-highlights.tsx` cũ dùng (khu đó đã gộp
    vào đây 29/07). Ba mục là hằng số của copy nên danh sách này không cần dài
    hơn; `?? SparklesIcon` là lưới an toàn nếu copy nở ra mục thứ tư. */
const HIGHLIGHT_ICONS: readonly LucideIcon[] = [SparklesIcon, CompassIcon, MapPinIcon];

/**
 * Khu đoạn dẫn của vùng — MỘT khu, BA bố cục.
 *
 * Cả ba biến thể nói cùng nội dung (eyebrow · tiêu đề · hai đoạn · tags · CTA ·
 * ba highlight) và khác nhau ở chỗ ĐẶT chúng. Vì sao phải khác: user đọc ba trang
 * bản trước và gọi chúng *"na ná, chỉ khác mỗi vài section"*; intro là khu thứ hai
 * hoặc thứ ba của cả ba trang nên nếu nó giống hệt thì ba trang giống nhau ngay ở
 * màn đầu, bất kể các khu sau khác đến đâu.
 *
 *  · **`aside`** (Bắc) — hai cột: chữ trái, ba highlight xếp dọc bên phải.
 *  · **`row`** (Trung) — chữ một khối `max-w-2xl` ở trên, ba highlight thành hàng
 *    ngang ba cột bên dưới.
 *  · **`stacked`** (Nam) — chữ CĂN GIỮA, ba highlight xếp dọc thành ba hàng trong
 *    khối `max-w-3xl` cũng căn giữa. Đây là biến thể thoáng nhất, và miền Nam nhận
 *    nó vì trang Nam dẫn bằng ảnh (bưu thiếp ngay trên, panorama ngay dưới) —
 *    khối chữ căn giữa giữa hai khu ảnh đọc thành một nhịp nghỉ.
 *
 * CTA trỏ neo `#tours` NGAY TRÊN TRANG này (Nexora trỏ `#itineraries`, một khu họ
 * không có).
 *
 * Cột phải KHÔNG còn là bento ảnh (29/07): gallery đã là khu ảnh riêng, nên ba ô
 * ảnh giữ chỗ ở đây là ảnh LẶP LẠI không thêm thông tin gì mới. Khu
 * `RegionHighlights` cũ (`What makes {region} special`) gộp hẳn vào đây.
 *
 * `tags` truyền từ page chứ không gõ tay trong i18n: chúng DẪN XUẤT từ
 * `regionGlance(tours).categories`, nên thêm/bớt tour là hàng chip tự đúng theo.
 * Nexora gõ tay nên chữ sai âm thầm mỗi lần catalogue đổi.
 */
export function RegionIntro({
  region,
  variant,
  tags,
  highlights,
}: {
  region: MockRegion;
  variant: IntroVariant;
  tags: string[];
  highlights: readonly { title: string; body: string }[];
}) {
  const t = messages.regionPage;
  const copy = t.regions[region.key];
  const hasHighlights = highlights.length > 0;

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div
        data-intro={variant}
        className={cn(
          'mx-auto max-w-7xl gap-12',
          // CHỈ `aside` là lưới hai cột. Hai biến thể kia xếp DỌC, nên chúng dùng
          // `flex flex-col` — một `grid` một cột cộng `gap` cho cùng kết quả nhưng
          // đọc code thì tưởng còn cột thứ hai ở đâu đó.
          variant === 'aside' && hasHighlights
            ? 'grid lg:grid-cols-2 lg:items-center lg:gap-16'
            : 'flex flex-col gap-12 md:gap-16',
        )}
      >
        {/* ── Khối chữ: eyebrow + tiêu đề + hai đoạn + tags + CTA ──
            `highlights` rỗng (nhánh có thật khi gắn API: vùng chưa có copy
            highlight) thì khối này trải rộng `max-w-2xl` thay vì bó theo một lưới
            hai cột không còn cột kia để cân. */}
        <div
          data-intro-copy={variant}
          className={cn(
            variant === 'stacked' && 'mx-auto max-w-2xl text-center',
            variant === 'row' && 'max-w-2xl',
            variant === 'aside' && !hasHighlights && 'max-w-2xl',
          )}
        >
          {/* Vạch accent `h-1 w-12` màu vùng đã BỎ (29/07): chấm vuông của
              `SectionEyebrow` đã là dấu accent chuẩn của site, hai dấu chồng nhau
              trên cùng một header là thừa một.
              `stacked` phải bọc eyebrow trong `flex justify-center`: nó là một hàng
              flex chiếm trọn bề ngang nên `text-center` của khối cha KHÔNG kéo được
              nó vào giữa — cùng bẫy `home/gallery.tsx` đã ghi. */}
          {variant === 'stacked' ? (
            <div className="flex justify-center">
              <SectionEyebrow>{t.introEyebrow}</SectionEyebrow>
            </div>
          ) : (
            <SectionEyebrow>{t.introEyebrow}</SectionEyebrow>
          )}
          {/* ── Cascade header (Task 5m) — xem `motion/reveal-header.tsx` ──
              Đây là khu DUY NHẤT của trang vùng dùng cả ba nhịp: tiêu đề → hai đoạn
              → (hàng chip + CTA). Hai đoạn CÙNG một nhịp `lede` là cố ý — chúng là
              một khối văn liền, tách chúng ra hai nhịp là biến đoạn dẫn thành một
              hàng đợi. Khu vẫn là Server Component. */}
          <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.introHeading(region.name)}
          </RevealHeading>
          <RevealLede className="mt-2 text-lg text-pretty text-muted-foreground">
            {copy.intro}
          </RevealLede>
          <RevealLede className="mt-4 text-pretty text-muted-foreground">{copy.intro2}</RevealLede>

          {/* Vùng chưa có tour nào thì `tags` rỗng (chúng dẫn xuất từ chuyên mục
              của tour) — bỏ CẢ hàng, không để lại mỗi nhãn "Best for:" treo lơ
              lửng không theo sau thứ gì. */}
          {tags.length > 0 ? (
            <RevealBlock
              beat="cta"
              className={cn(
                'mt-6 flex flex-wrap items-center gap-2',
                variant === 'stacked' && 'justify-center',
              )}
            >
              <span className="text-sm font-medium text-foreground">{t.bestForLabel}:</span>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </RevealBlock>
          ) : null}

          {/* Nút primary MẶC ĐỊNH của hệ (ADR-0015: hết inline style theo vùng),
              nên `hover:bg-primary/80` của variant chạy lại bình thường. Nút này
              KHÔNG nằm trong scope `dark` nên cặp nền/chữ lật theo theme thật:
              đo 5.52:1 (light) / 4.11:1 (dark) — con số dark đúng bằng cặp
              `bg-primary`/`primary-foreground` mặc định của mọi nút primary
              trong repo, tức nợ toàn site đã ghi, không phải lớp lỗi mới. */}
          {/* `mt-8` dời từ nút LÊN khối bọc: nút là `inline-flex` nên nó vẫn ăn theo
              `text-center` của biến thể `stacked` qua căn chữ của khối này. */}
          <RevealBlock beat="cta" className="mt-8">
            <ButtonLink href="#tours">
              {t.browseCta(region.name)}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </ButtonLink>
          </RevealBlock>
        </div>

        {/* ── Ba highlight — khu `What makes X special` cũ, GỘP vào đây 29/07 ──
            Rỗng thì bỏ hẳn khối: khối chữ đã trải rộng ở trên, một khối rỗng bên
            cạnh là khoảng trống không giải thích được (cùng lý lẽ đã áp cho bento
            cũ và hàng `tags`). */}
        {hasHighlights ? (
          <div
            data-intro-highlights={variant}
            className={cn(
              variant === 'stacked' && 'mx-auto w-full max-w-3xl',
              variant === 'row' && 'w-full',
            )}
          >
            {/* ── Nhịp thân khu (Task 5n) — chữ ký của miền dùng biến thể này ──
                Tiêu đề khối là phần tử MỞ MÀN của cùng nhịp với ba mục dưới nó
                (`delay: 0`, rồi các mục `(i + 1) * STAGGER.grid`). Để nó đứng im trên
                một danh sách đang chuyển động thì nó đọc thành một mẩu sót lại — đúng
                lý lẽ 5m đã áp cho nhãn `Best months` của khu mùa. */}
            <RevealItem
              as="h3"
              enter={INTRO_ENTER[variant]}
              className={cn(
                'font-heading text-xl font-medium text-foreground md:text-2xl',
                variant === 'stacked' && 'text-center',
              )}
            >
              {t.highlightsHeading(region.name)}
            </RevealItem>

            <div
              data-intro-items={variant}
              className={cn(
                'mt-6',
                // `row` là HÀNG NGANG ba cột; hai biến thể kia xếp DỌC. Đây là chỗ
                // ba biến thể tách khỏi nhau rõ nhất.
                variant === 'row'
                  ? 'grid gap-8 sm:grid-cols-3'
                  : 'flex flex-col gap-6 sm:mt-8 sm:gap-7',
              )}
            >
              {highlights.map((item, i) => {
                const Icon = HIGHLIGHT_ICONS[i] ?? SparklesIcon;
                return (
                  <RevealItem
                    key={item.title}
                    enter={INTRO_ENTER[variant]}
                    // `+ 1` vì tiêu đề khối ở trên đã chiếm nhịp 0.
                    delay={(i + 1) * STAGGER.grid}
                    className={cn(
                      // `row` xếp icon TRÊN chữ (cột hẹp, icon bên cạnh chữ thì
                      // chữ chỉ còn ~10 chữ mỗi dòng); hai biến thể kia icon bên
                      // trái vì chúng có cả bề ngang.
                      variant === 'row'
                        ? 'flex flex-col items-start gap-3'
                        : 'flex items-start gap-4',
                    )}
                  >
                    {/* Chip ĐẶC (`bg-primary` + icon `primary-foreground`), KHÔNG
                        phải chip phớt. Bản chip phớt
                        (`color-mix(--primary, --background 88%)` + icon màu
                        primary) đã bị loại vì đo được ~3:1 hoặc thấp hơn — nền pha
                        12% quá gần nền trang để đỡ một icon.
                        Sau ADR-0015 cả hai vế đều là token brand nên chúng cùng lật
                        theo theme: đo 5.52:1 (light) / 4.11:1 (dark). Nội dung chip
                        là ICON 24px nên ngưỡng là 3.0 — qua ở cả hai theme. Đây
                        cũng đúng cặp màu của CTA `#tours` và chip lọc đang chọn ở
                        khu Tours, nên cả trang giữ MỘT kiểu accent. */}
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h4 className="font-heading text-lg font-medium text-foreground">
                        {item.title}
                      </h4>
                      {/* ── Hợp đồng SỐ DÒNG (Task 5o) ──
                          Đo ở 1440 trước khi vá: ba mục của miền Bắc cao 56/80/56 vì
                          mục giữa có câu dài hơn nên xuống hai dòng. Ở `aside` ba mục
                          xếp DỌC nên đây KHÔNG phải "lệch pha giữa hai thẻ cùng
                          hàng" — nó là NHỊP: khoảng giữa các chip icon thành 80px rồi
                          104px, ba mục không còn đứng trên một thang đều.
                          Chỉ GIỮ CHỖ, KHÔNG `line-clamp` — cùng lý lẽ `region-days`:
                          câu biên tập ngắn trong hộp rộng, cắt chữ ở đây là đổi lỗi
                          hình thành lỗi nội dung. Ở `row` hộp hẹp hơn nên câu vốn đã
                          3–4 dòng và `min-h` là no-op; ba mục ở đó cao bằng nhau nhờ
                          `grid` stretch, không nhờ luật này. */}
                      <p
                        data-highlight-body
                        className="mt-1 min-h-[2lh] text-pretty text-muted-foreground"
                      >
                        {item.body}
                      </p>
                    </div>
                  </RevealItem>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
