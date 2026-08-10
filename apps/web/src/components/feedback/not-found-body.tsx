'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { SPRING } from '@/lib/motion';

// Thân trang 404 (nền sáng, dưới hero tối). Tách thành client component vì cả
// khối có motion; not-found.tsx giữ nguyên là server component.
//
// Số 404 dựng bằng HAI LỚP kiểu in lệch (offset print): lớp bóng nằm sau,
// lệch xuống phải; lớp đặc nằm trên. Bóng làm lớp đặc nhấc hẳn khỏi nền thay
// vì nằm phẳng lì. Đây là chi tiết duy nhất được phép nổi bật ở thân trang;
// mọi thứ khác giữ im lặng.

const NUMERAL =
  'font-heading text-[30vw] leading-[0.8] font-semibold tracking-tight lg:text-[17vw]';

const PILL_PRIMARY =
  'inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80';

const INLINE_LINK = 'font-medium text-primary-emphasis underline-offset-4 hover:underline';

/** Trồi lên + hiện dần, dùng chung cho từng dòng ở cột trái. */
function Line({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ y: 18, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

export function NotFoundBody() {
  return (
    // py-24 chứ không phải py-32: cộng với `mt-32` của footer ra 224px — khớp
    // nhịp 208px các trang khác đang có (section pb-20 + mt-32).
    <section className="w-full px-4 py-24 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 max-w-lg lg:order-1">
          <Line delay={0}>
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              No route found
            </p>
          </Line>

          <Line delay={0.08}>
            <h2 className="mt-6 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
              We lost this page,
              <br />
              <span className="text-primary-emphasis italic">not you.</span>
            </h2>
          </Line>

          <Line delay={0.16}>
            <p className="mt-5 text-pretty text-muted-foreground">
              The link may be broken, or the page may have moved — nothing lives at this URL.
            </p>
          </Line>

          {/* Link nhúng thẳng trong câu (lối Mailchimp) hữu ích hơn một hàng
              nút trống: người đang lạc đọc được ngay mình có thể đi đâu.
              CHỈ trỏ tới trang CÓ THẬT — /tours và /destinations chưa dựng,
              gợi ý sang đó là đẩy người ta vào một 404 nữa. */}
          <Line delay={0.24}>
            <p className="mt-4 text-pretty text-muted-foreground">
              While you&rsquo;re here, read the latest notes in{' '}
              <Link href="/blog" className={INLINE_LINK}>
                the journal
              </Link>
              , meet{' '}
              <Link href="/about" className={INLINE_LINK}>
                the guides behind the trips
              </Link>
              , or skim the{' '}
              <Link href="/faq" className={INLINE_LINK}>
                questions travellers ask most
              </Link>
              .
            </p>
          </Line>

          {/* CHỈ một nút. Bản trước có thêm "Report a broken link" trỏ về
              /contact — đã bỏ: mình KHÔNG có tính năng nhận báo link hỏng,
              để nút đó là hứa một thứ không tồn tại. */}
          <Line delay={0.32}>
            {/* Nút căn GIỮA cột trái (chữ vẫn căn trái) — nút đứng một mình
                nên đặt giữa khối trông cân hơn là nép sát mép trái. */}
            <div className="mt-9 flex justify-center">
              <Link href="/" className={PILL_PRIMARY}>
                Back to home
              </Link>
            </div>
          </Line>
        </div>

        {/* Cột 404: lớp ĐẶC nằm trong luồng để định kích thước cho cả khối,
            lớp BÓNG absolute chồng khít rồi lệch xuống phải. */}
        <div
          aria-hidden="true"
          className="relative order-1 flex items-center justify-center select-none lg:order-2 lg:justify-end"
        >
          {/* Bóng: cùng chữ, cùng cỡ, tông nhạt, lệch xuống-phải. Vào TRƯỚC
              lớp đặc và trượt từ xa về nên mắt thấy bóng "đặt xuống" rồi lớp
              đặc mới đè lên. */}
          <motion.span
            className={`${NUMERAL} absolute inset-0 flex items-center justify-center text-primary-emphasis/25 lg:justify-end`}
            initial={{ x: 26, y: 26, opacity: 0 }}
            whileInView={{ x: 14, y: 14, opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', stiffness: 260, damping: 60, mass: 1 }}
          >
            404
          </motion.span>

          {/* Lớp đặc — nhân vật chính */}
          <motion.span
            className={`${NUMERAL} relative text-primary-emphasis`}
            initial={{ scale: 0.94, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', stiffness: 260, damping: 60, mass: 1, delay: 0.12 }}
          >
            404
          </motion.span>
        </div>
      </div>
    </section>
  );
}
