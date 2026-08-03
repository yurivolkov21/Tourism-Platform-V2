'use client';

import { motion } from 'motion/react';
import { SPRING } from '@/lib/motion';
import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from './icons/social';
import { Logo } from './logo';
import { NewsletterForm } from './newsletter-form';

// Review #28: làm lại footer theo forged/Footer (convert 100% lối thiết kế,
// da thịt token + font dự án): grid 12 — brand 4 cột (logo + mô tả +
// newsletter) / 8 cột chia 3 nhóm link; bottom bar 3 phần (copyright · social
// icon tròn · legal); watermark chữ khổng lồ fill mờ căn giữa đáy (thay bản
// stroke góc phải của Estate). Motion phủ theo yêu cầu user: các cột trồi lên
// stagger khi vào viewport, social hover nhấc lên + scale (y bản gốc).
// Tối ở CẢ hai theme qua scope `dark`.
const LINK_GROUPS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Explore',
    links: [
      // 'Tours' trỏ TRANG thật, không còn trỏ `/#tours` — cái anchor đó nằm trên
      // section Stats ở trang chủ, hợp lý khi chưa có /tours, nay thì sai hẳn.
      ['Tours', '/tours'],
      // Hai mục dưới vẫn là anchor trang chủ CÓ THẬT (`#gallery`, `#reviews`):
      // /destinations chưa tồn tại, còn Reviews mãi là section của Home (quyết
      // định review navbar #3). Không đổi tới khi có trang riêng.
      ['Destinations', '/#gallery'],
      ['Reviews', '/#reviews'],
      ['Contact', '/contact'],
      ['Journal', '/blog'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About us', '/about'],
      ['Our guides', '#top'],
      ['Careers', '#top'],
      ['Press', '#top'],
      ['Partners', '#top'],
    ],
  },
  {
    title: 'Support',
    links: [
      ['FAQ', '/faq'],
      ['Booking help', '/faq'],
      ['Cancellation policy', '/cancellation-policy'],
      ['Terms', '/terms'],
      ['Privacy policy', '/privacy'],
    ],
  },
];

const SOCIALS = [
  { Icon: InstagramIcon, label: 'Instagram' },
  { Icon: TwitterIcon, label: 'X' },
  { Icon: YoutubeIcon, label: 'YouTube' },
  { Icon: FacebookIcon, label: 'Facebook' },
];

export function SiteFooter() {
  return (
    <footer className="dark relative mt-32 w-full overflow-hidden border-t bg-background px-4 pt-20 pb-10 text-foreground md:px-16 lg:px-24 xl:px-32">
      {/* Watermark khổng lồ kiểu forged: fill mờ, căn giữa đáy, tràn chiều rộng —
          nằm dưới nội dung (z-10 ở container) nên không che link (bài học #8) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center overflow-hidden select-none"
      >
        <span className="footer-watermark translate-y-6 font-heading text-[22vw] leading-none font-semibold tracking-tighter">
          tourism
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-20 grid grid-cols-1 gap-16 lg:grid-cols-12">
          {/* Cột brand: logo + mô tả + newsletter */}
          <motion.div
            className="lg:col-span-4"
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={SPRING}
          >
            <a href="/" aria-label="tourism — home" className="mb-6 inline-block select-none">
              <Logo />
            </a>
            <p className="mb-8 max-w-xs text-sm/5.5 text-muted-foreground">
              Small-group tours across Vietnam, led by people who grew up there. Limestone bays,
              misty terraces, lantern towns — at your pace.
            </p>

            {/* Newsletter — form client nhỏ tách riêng (`newsletter-form.tsx`,
                spec §3, task-3-brief.md): validate + honeypot + submit
                `newsletter.subscribe`, anti-enumeration. Markup/token nhìn
                giữ NGUYÊN như bản no-op cũ. */}
            <NewsletterForm />
          </motion.div>

          {/* 3 nhóm link — trồi lên stagger */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 lg:col-span-8">
            {LINK_GROUPS.map((group, index) => (
              <motion.div
                key={group.title}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING, delay: 0.1 + index * 0.1 }}
              >
                <h4 className="mb-5 text-xs font-semibold tracking-widest uppercase">
                  {group.title}
                </h4>
                <ul className="space-y-3">
                  {group.links.map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom bar 3 phần: copyright · social tròn · legal */}
        <motion.div
          className="flex flex-col items-center justify-between gap-6 border-t pt-8 md:flex-row"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ ...SPRING, delay: 0.2 }}
        >
          {/* Ghi công ảnh tạm bỏ khỏi UI — toàn site đang dùng ImagePlaceholder
              (static-first), ghi công cho ảnh không hiển thị là sai. Thêm lại
              cùng lúc với ảnh thật (cùng cách đã làm ở auth-screen.tsx). */}
          <p className="text-xs text-muted-foreground/70">© 2026 tourism. All rights reserved.</p>

          <div className="flex items-center gap-3">
            {SOCIALS.map(({ Icon, label }) => (
              <motion.a
                key={label}
                href="#top"
                aria-label={label}
                whileHover={{ scale: 1.15, y: -2 }}
                whileTap={{ scale: 0.9 }}
                className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-primary"
              >
                <Icon className="size-3.5" />
              </motion.a>
            ))}
          </div>

          <p className="text-xs text-muted-foreground/70">Privacy · Terms · Cookies</p>
        </motion.div>
      </div>
    </footer>
  );
}
