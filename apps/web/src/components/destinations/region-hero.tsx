'use client';

import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronRightIcon, CompassIcon, MoveRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { RegionTile } from '@/components/destinations/region-tile';
import { CountUp } from '@/components/motion/count-up';
import { RevealLine } from '@/components/motion/reveal-line';
import { regionTheme } from '@/lib/region-theme';
import type { MockRegion } from '@/mocks/types';

/** Một ô của hàng số liệu trong hero. Giá trị ĐÃ ĐỊNH DẠNG XONG ở tầng trang —
    component này không biết tiền tệ, không biết bậc độ khó, chỉ biết in.
    (Kiểu này trước ở `region-signature-stats.tsx`; khu đó đã bị xoá vì số liệu
    chuyển lên đây, in cả hai chỗ là lặp bốn con số trên một trang.) */
export interface RegionStat {
  value: string;
  label: string;
}

/** Chỉ chữ số, không dấu, không đơn vị — điều kiện để một giá trị chạy được
    `CountUp`. `$68`, `8 days`, `Challenging` rơi ra ngoài và in thẳng: ép chúng
    qua bộ đếm số thì hoặc mất đơn vị, hoặc ra `NaN`. */
const PURE_NUMBER = /^\d+$/;

/**
 * Accent của vùng, ĐÃ KÉO SÁNG để đứng được trên nền tối của hero.
 *
 * `--region-spark` trần KHÔNG dùng được ở đây, và đây là số đo chứ không phải
 * cảm tính: spark của miền Nam là đỏ sẫm (oklch L≈0.485), của miền Bắc là tím
 * (L≈0.56) — trên nền hero chúng đo được 1.35–2.88:1, dưới cả ngưỡng 3.0 của chữ
 * lớn. Chỉ spark miền Trung (vàng, L≈0.8) là qua. Trộn 45% về `--on-media` kéo cả
 * ba lên cùng một dải sáng mà VẪN giữ sắc riêng của vùng.
 *
 * `in oklab` chứ KHÔNG `in oklch`: oklch nội suy HUE, nên đỏ (29°) trộn với
 * on-media (180°) đi vòng qua vàng-lục và miền Nam ra màu khác hẳn. oklab trộn
 * theo toạ độ vuông góc — đỏ nhạt đi và sáng lên, không đổi sắc.
 */
const ACCENT_ON_MEDIA = 'color-mix(in oklab, var(--region-spark), var(--on-media) 45%)';

/**
 * Hero trang vùng — dựng theo `components/about/about-hero.tsx` (user chốt 29/07):
 * ô ảnh phủ toàn khu, gradient quét TRÁI→PHẢI, nội dung căn trái theo nhịp
 * breadcrumb → badge → h1 reveal → tagline → hai nút → hàng số liệu, cộng chỉ báo
 * cuộn dọc mép phải.
 *
 * Hai điểm KHÁC `AboutHero`, cả hai đều có lý do:
 *
 *  1. Chữ dùng `text-on-media` (token CỐ ĐỊNH) chứ không `text-foreground`. Nền
 *     đây không phải token theo-theme mà là ô gradient phủ scrim — nó tối ở CẢ
 *     hai theme, nên chữ cũng phải cố định sáng.
 *  2. Class `dark` nằm trên hai wrapper (nền + nội dung) đúng như `AboutHero`, và
 *     đây KHÔNG mâu thuẫn với điều 1: nó không đổi màu chữ (chữ đã là `on-media`),
 *     nó chỉ khiến những token TRUNG TÍNH mà `buttonVariants` kéo vào (`--input`,
 *     `--muted`, `--ring`) giải theo bảng tối — đúng bề mặt mà chúng đang nằm lên.
 *     Bỏ `dark` đi thì ở light theme nút viền có nền `--background` gần trắng và
 *     chữ `on-media` gần trắng trên đó là tàng hình.
 *
 * `heroMinH` và `scrim` đến từ `regionTheme(key)` — mỗi vùng một "mood": Bắc cao
 * hơn (80vh) và scrim đặc hơn, hai vùng kia 70vh và nhẹ hơn.
 *
 * MỌI nội dung vào bằng PROP (page tra `messages.regionPage.regions[key]` và dẫn
 * xuất `stats`/`styles` từ catalogue) — cùng khuôn với các khu khác của cụm, và
 * như thế mới test được với fixture.
 */
export function RegionHero({
  region,
  tagline,
  styles,
  stats,
}: {
  region: MockRegion;
  tagline: string;
  /** Hai chuyên mục đầu của vùng, đã nối sẵn bằng ` · `. Chuỗi RỖNG khi vùng chưa
      có tour nào (nhánh có thật khi gắn API) → bỏ hẳn badge pill. */
  styles: string;
  stats: RegionStat[];
}) {
  const t = messages.regionPage;
  const theme = regionTheme(region.key);

  return (
    <section
      className={cn(
        'relative flex w-full items-center overflow-hidden text-on-media',
        theme.heroMinH,
      )}
    >
      {/* ── Nền: ô vùng + gradient trái→phải (chữ nằm bên trái) ──
          `decorative`: nhãn ô sẽ là TÊN VÙNG, mà `<h1>` ngay dưới cũng là tên
          vùng — để `role="img"` ở đây là trình đọc màn hình đọc "Northern
          Vietnam" hai lần liền. Ô này là nền, không mang thông tin nào riêng. */}
      <div className="dark absolute inset-0 -z-10">
        <RegionTile label={region.name} decorative className="h-full w-full rounded-none" />
        <div aria-hidden="true" className={cn('absolute inset-0 bg-linear-to-r', theme.scrim)} />
      </div>

      {/* Full-bleed pad mép, KHÔNG container giữa — đúng `AboutHero`. Padding trên
          rộng hơn dưới: navbar trong suốt nằm đè lên đầu khu này. */}
      <div className="dark w-full px-4 pt-28 pb-12 md:px-16 lg:px-24 xl:px-32">
        <nav
          aria-label={messages.common.breadcrumbLabel}
          className="flex flex-wrap items-center gap-1.5 text-sm text-on-media/80"
        >
          <a href="/" className="transition-colors hover:text-on-media">
            {messages.common.home}
          </a>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <a href="/destinations" className="transition-colors hover:text-on-media">
            {t.backToAll}
          </a>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <span aria-current="page">{region.name}</span>
        </nav>

        {/* ── Badge pill viền accent ──
            Viền và icon mang accent vùng (đã kéo sáng), nhưng CHỮ thì `on-media`
            thuần: accent qua ngưỡng 3.0 của đường viền và icon, còn chữ 12px cần
            4.5 nên nó phải là token sáng nhất có. */}
        {styles ? (
          <motion.div
            style={{ borderColor: ACCENT_ON_MEDIA }}
            className="mt-8 inline-flex items-center gap-2 rounded-full border bg-on-media/10 px-4 py-2 backdrop-blur-sm"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <CompassIcon
              style={{ color: ACCENT_ON_MEDIA }}
              className="size-3.5"
              aria-hidden="true"
            />
            <span className="text-xs font-medium tracking-widest text-on-media uppercase">
              {styles}
            </span>
          </motion.div>
        ) : null}

        {/* MỘT `RevealLine`, không ép ba dòng như `/about`: tên vùng là cụm hai
            chữ, cắt nó ra thành nhiều dòng là bẻ một danh từ riêng làm đôi.
            Dừng ở `text-6xl` (không lên `text-7xl` như About) để dòng chữ không
            chạy quá nửa màn, nơi gradient đã nhạt và chữ mất tương phản. */}
        <h1 className="mt-8 max-w-2xl font-heading text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl md:text-6xl">
          <RevealLine delay={0.3}>{region.name}</RevealLine>
        </h1>

        <motion.div
          className="mt-6 flex flex-col gap-6"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
        >
          {/* `tagline` chứ KHÔNG phải `intro`: intro là đoạn dẫn của khu ngay bên
              dưới, in cả hai chỗ là lặp nguyên một câu trên cùng một màn hình. */}
          <p className="max-w-md text-base leading-relaxed text-pretty text-on-media/85">
            {tagline}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {/* Nền là token VÙNG nên đặt qua `style`, và inline style luôn thắng
                `hover:bg-primary/80` của variant mặc định — hover đổi độ mờ thay vì
                đổi nền, nếu không nút này không phản hồi gì khi rê chuột. */}
            <ButtonLink
              href="#tours"
              style={{ background: 'var(--region-primary)' }}
              className="group h-11 rounded-full px-6 text-on-media transition-opacity hover:opacity-90"
            >
              {t.browseCta(region.name)}
              <MoveRightIcon
                className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                aria-hidden="true"
              />
            </ButtonLink>

            {/* Các lớp `dark:` LẶP LẠI bản không-modifier là CỐ Ý: wrapper mang
                class `dark`, mà `.dark .dark\:bg-input\/30` của variant `outline`
                có độ đặc hiệu cao hơn `.bg-transparent`, nên không ghi đè cả hai
                dạng thì nền `--input` vẫn thắng. */}
            <ButtonLink
              href="/destinations"
              variant="outline"
              className="h-11 rounded-full border-on-media/30 bg-transparent px-6 text-on-media hover:bg-on-media/10 hover:text-on-media dark:border-on-media/30 dark:bg-transparent dark:hover:bg-on-media/10"
            >
              {t.backToAll}
            </ButtonLink>
          </div>
        </motion.div>

        {/* ── Hàng số liệu trên hairline ──
            `stats` rỗng (vùng chưa có tour nào — nhánh có thật khi gắn API) thì bỏ
            CẢ hàng LẪN hairline: một đường kẻ không đỡ thứ gì là một vết xước. */}
        {stats.length > 0 ? (
          <motion.dl
            className="mt-12 flex max-w-2xl flex-wrap gap-x-10 gap-y-6 border-t border-on-media/15 pt-7"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 1.05 }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col">
                {/* `text-3xl` = 30px, tức CHỮ LỚN: accent vùng ở đây qua ngưỡng
                    3.0 chứ không qua 4.5. Đừng thu nhỏ cỡ chữ này. */}
                <dt
                  style={{ color: ACCENT_ON_MEDIA }}
                  className="order-1 font-heading text-3xl leading-none font-semibold tabular-nums"
                >
                  {PURE_NUMBER.test(stat.value) ? (
                    <CountUp to={Number(stat.value)} delay={1.1} />
                  ) : (
                    stat.value
                  )}
                </dt>
                {/* `order` lật lại thứ tự NHÌN THẤY: DOM phải là `<dt>` rồi `<dd>`
                    (nhãn của cặp mô tả đi trước), còn mắt đọc số trước nhãn. */}
                <dd className="order-2 mt-1 text-xs tracking-wide text-on-media/80 uppercase">
                  {stat.label}
                </dd>
              </div>
            ))}
          </motion.dl>
        ) : null}
      </div>

      {/* ── Chỉ báo cuộn dọc mép phải ──
          Chỉ animate `opacity`, không transform: `MotionConfig reducedMotion="user"`
          ở root layout tắt transform/layout chứ không tắt opacity, nên đây đã là
          dạng an toàn sẵn với người bật giảm chuyển động. */}
      <motion.div
        className="dark absolute right-8 bottom-8 z-10 hidden flex-col items-center gap-2 md:right-16 md:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
      >
        <span
          aria-hidden="true"
          className="h-16 w-px bg-linear-to-b from-transparent to-on-media/60"
        />
        <span className="origin-center translate-x-4 rotate-90 text-[10px] tracking-widest text-on-media uppercase">
          {messages.common.scrollHint}
        </span>
      </motion.div>
    </section>
  );
}
