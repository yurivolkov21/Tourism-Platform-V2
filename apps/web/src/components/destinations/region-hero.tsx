'use client';

import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronRightIcon, CompassIcon, MoveRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { CountUp } from '@/components/motion/count-up';
import { RevealLine } from '@/components/motion/reveal-line';
import { TopoPattern } from '@/components/topo-pattern';
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
 * Chiều cao hero — HẰNG chung cho cả ba vùng (ADR-0015: bỏ "mood" riêng từng
 * vùng, bản sắc vùng do CẤU TRÚC khu Signature gánh chứ không do màu và kích
 * thước). Đo bằng `vh` chứ không bằng `rem`: hero mang breadcrumb, badge, h1,
 * tagline, hai nút và hàng số liệu nên nó phải chiếm phần lớn màn đầu; `rem` cố
 * định làm nội dung tràn trên màn cao và thừa trên màn thấp.
 */
const HERO_MIN_H = 'min-h-[70vh]';

/**
 * Hero trang vùng — đúng khuôn BA LỚP của mọi hero khác trong site (`/tours`,
 * `/contact`, `/destinations`), nhịp nội dung giữ theo `about/about-hero.tsx`:
 * breadcrumb → badge → h1 reveal → tagline → hai nút → hàng số liệu, cộng chỉ báo
 * cuộn dọc mép phải.
 *
 * Ba lớp, và thứ tự scope `dark` là phần dễ làm sai nhất:
 *
 *  1. `<section>` nền đặc `bg-hero` — KHÔNG bọc class `dark`. Đặt `dark` lên
 *     chính section thì ở dark mode `bg-hero` bị đọc trong scope dark và hero
 *     trùng màu nền trang (lỗi đã sửa một lần ở `ToursHero`).
 *  2. `TopoPattern` NGOÀI scope dark — biến thể `dark:opacity-*` phải đọc theme
 *     của TRANG, vì nền hero tối thêm ở dark nên vân phải đậm lên mới thấy.
 *  3. `<div className="dark contents">` bọc NỘI DUNG. Nó không đổi màu chữ (chữ
 *     đã là `on-media`, token cố định), nó chỉ khiến các token TRUNG TÍNH mà
 *     `buttonVariants` kéo vào (`--input`, `--muted`, `--ring`) giải theo bảng
 *     tối — đúng bề mặt mà chúng đang nằm lên. `contents` để wrapper không tạo
 *     hộp; biến CSS vẫn kế thừa qua `display: contents`.
 *
 * Nền cũ là `RegionTile` phủ toàn khu + scrim. BỎ (ADR-0015): tile nằm trong
 * scope `dark` nên sau khi đổi sang token brand thì gradient bị ghim bảng tối ở
 * CẢ HAI theme và ra một sắc NHẠT — hero từ tối hoá sáng, navbar chưa-cuộn (chữ
 * `on-media` trắng) thành tàng hình, đúng thứ luật "hero luôn tối" sinh ra để
 * chặn. Nền đặc `bg-hero` không có đường hỏng đó: nó tối 0.25 ở light và 0.17 ở
 * dark, tức chữ sáng cố định chỉ nổi hơn (đo 15.09:1 / 18.07:1).
 *
 * Chữ dùng `text-on-media` (token CỐ ĐỊNH) chứ không `text-foreground`: nền tối
 * ở CẢ hai theme nên chữ cũng phải cố định sáng.
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

  return (
    <section
      className={cn(
        'relative flex w-full items-center overflow-hidden bg-hero text-on-media',
        HERO_MIN_H,
      )}
    >
      {/* Vệt gradient chéo cho băng đỡ phẳng — cùng công thức `ContactHero` và
          hero `/destinations` dùng. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
      {/* NGOÀI scope dark — xem điều 2 ở docstring. */}
      <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />

      <div className="dark contents">
        {/* Full-bleed pad mép, KHÔNG container giữa — đúng `AboutHero`. Padding
            trên rộng hơn dưới: navbar trong suốt nằm đè lên đầu khu này. */}
        <div className="relative z-10 w-full px-4 pt-28 pb-12 md:px-16 lg:px-24 xl:px-32">
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
              Viền và icon mang `--rating` (hổ phách brand), nhưng CHỮ thì
              `on-media` thuần: accent đo 7.80:1 (light) / 9.34:1 (dark) nên qua
              cả ngưỡng 4.5, còn `on-media` vẫn là token sáng nhất có nên chữ
              12px giữ nguyên nó. */}
          {styles ? (
            <motion.div
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-rating bg-on-media/10 px-4 py-2 backdrop-blur-sm"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <CompassIcon className="size-3.5 text-rating" aria-hidden="true" />
              <span className="text-xs font-medium tracking-widest text-on-media uppercase">
                {styles}
              </span>
            </motion.div>
          ) : null}

          {/* MỘT `RevealLine`, không ép ba dòng như `/about`: tên vùng là cụm hai
              chữ, cắt nó ra thành nhiều dòng là bẻ một danh từ riêng làm đôi.
              Dừng ở `text-6xl` (không lên `text-7xl` như About) để dòng chữ
              không chạy quá nửa màn. */}
          <h1 className="mt-8 max-w-2xl font-heading text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl md:text-6xl">
            <RevealLine delay={0.3}>{region.name}</RevealLine>
          </h1>

          <motion.div
            className="mt-6 flex flex-col gap-6"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.85 }}
          >
            {/* `tagline` chứ KHÔNG phải `intro`: intro là đoạn dẫn của khu ngay
                bên dưới, in cả hai chỗ là lặp nguyên một câu trên cùng một màn
                hình. */}
            <p className="max-w-md text-base leading-relaxed text-pretty text-on-media/85">
              {tagline}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {/* Nút primary MẶC ĐỊNH của hệ (`bg-primary`/`text-primary-foreground`)
                  — không còn inline style nên `hover:bg-primary/80` của variant
                  chạy lại bình thường, khỏi mẹo `hover:opacity-90`.
                  Đo: 4.11:1 ở CẢ hai theme (nút nằm trong scope `dark` nên
                  `--primary` bị ghim bảng tối). Con số này DƯỚI 4.5 nhưng đúng
                  BẰNG cặp mặc định của mọi nút primary khác trong repo ở dark —
                  ta thừa kế nợ toàn site, không tạo lớp lỗi mới. Xem
                  ADR-0015 §Hệ quả. */}
              <ButtonLink href="#tours" className="group h-11 rounded-full px-6">
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
              `stats` rỗng (vùng chưa có tour nào — nhánh có thật khi gắn API) thì
              bỏ CẢ hàng LẪN hairline: một đường kẻ không đỡ thứ gì là một vết
              xước. */}
          {stats.length > 0 ? (
            <motion.dl
              className="mt-12 flex max-w-2xl flex-wrap gap-x-10 gap-y-6 border-t border-on-media/15 pt-7"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.05 }}
            >
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <dt className="order-1 font-heading text-3xl leading-none font-semibold text-rating tabular-nums">
                    {PURE_NUMBER.test(stat.value) ? (
                      <CountUp to={Number(stat.value)} delay={1.1} />
                    ) : (
                      stat.value
                    )}
                  </dt>
                  {/* `order` lật lại thứ tự NHÌN THẤY: DOM phải là `<dt>` rồi
                      `<dd>` (nhãn của cặp mô tả đi trước), còn mắt đọc số trước
                      nhãn. */}
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
          className="absolute right-8 bottom-8 z-10 hidden flex-col items-center gap-2 md:right-16 md:flex"
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
      </div>
    </section>
  );
}
