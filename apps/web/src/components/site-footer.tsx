'use client';

import { messages } from '@tourism/i18n';
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
// Ba nhóm link phản ánh ĐÚNG bản đồ route của site (rà 19/08 theo góp ý user:
// bản cũ còn 'Destinations' → `/#gallery` dù /destinations đã có từ 30/07, và
// bốn mục Company 'Our guides/Careers/Press/Partners' trỏ `#top` — link chết
// cho trang không tồn tại). Luật: mỗi href là một route/anchor CÓ THẬT; không
// có trang thì không có link. `/account/*` đi qua `proxy.ts` — chưa đăng nhập
// thì về /login rồi quay lại, nên để được ở footer cho mọi khách.
// Chữ ở `messages.siteFooter` (W-09, 14/10); nhãn trùng chữ và nghĩa với navbar đọc `messages.nav`.
const t = messages.siteFooter;
const LINK_GROUPS: { title: string; links: [string, string][] }[] = [
  {
    title: t.groups.explore,
    links: [
      [messages.nav.tours, '/tours'],
      [messages.nav.destinations, '/destinations'],
      [messages.nav.blog, '/blog'],
      [t.links.about, '/about'],
      // Reviews vẫn là section của Home (quyết định review navbar #3) — anchor thật.
      [t.links.reviews, '/#reviews'],
    ],
  },
  {
    title: t.groups.account,
    links: [
      [t.links.bookings, '/account/bookings'],
      [t.links.saved, '/account/saved'],
      [t.links.profile, '/account/profile'],
      [t.links.settings, '/account/settings'],
      [messages.nav.login, '/login'],
    ],
  },
  {
    title: t.groups.support,
    links: [
      [t.links.contact, '/contact'],
      [t.links.faq, '/faq'],
      [t.links.cancellation, '/cancellation-policy'],
      [t.links.terms, '/terms'],
      [t.links.privacy, '/privacy'],
    ],
  },
];

const SOCIALS = [
  { Icon: InstagramIcon, label: messages.social.instagram },
  { Icon: TwitterIcon, label: messages.social.x },
  { Icon: YoutubeIcon, label: messages.social.youtube },
  { Icon: FacebookIcon, label: messages.social.facebook },
];

export function SiteFooter() {
  // KHÔNG margin-top (gỡ `mt-32` 12/08 theo góp ý user): margin đó sơn màu
  // nền body thành một dải sáng "lưng chừng" trước footer trên mọi trang nền
  // sáng (account/checkout), và các khu cuối có nền riêng phải vá để che
  // (region-reviews/day-trips). Khoảng thở trên footer giờ do pb của từng
  // trang + pt-20 nội bộ footer lo.
  return (
    <footer className="dark relative w-full overflow-hidden border-t bg-background px-4 pt-20 pb-10 text-foreground md:px-16 lg:px-24 xl:px-32">
      {/* Watermark khổng lồ kiểu forged: fill mờ, căn giữa đáy, tràn chiều rộng —
          nằm dưới nội dung (z-10 ở container) nên không che link (bài học #8) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center overflow-hidden select-none"
      >
        <span className="footer-watermark translate-y-6 font-heading text-[22vw] leading-none font-semibold tracking-tighter">
          nexora
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
            <a
              href="/"
              aria-label={messages.a11y.homeLink}
              className="mb-6 inline-block select-none"
            >
              <Logo />
            </a>
            <p className="mb-8 max-w-xs text-sm/5.5 text-muted-foreground">{t.blurb}</p>

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
              cùng lúc với ảnh thật (cùng cách đã làm ở auth-screen.tsx).
              Chữ dòng đáy KHÔNG làm mờ thêm (review F3, 20/10): `muted-foreground/70` trên
              nền tối của footer chỉ 4.05:1 theo axe, dưới ngưỡng 4.5:1 của chữ 12px; màu
              muted đủ đậm là 6.66:1. Cỡ `text-xs` đã đủ cho dòng này lùi sau các cột link. */}
          <p className="text-xs text-muted-foreground">{t.copyright}</p>

          <div className="flex items-center gap-3">
            {SOCIALS.map(({ Icon, label }) => (
              <motion.a
                key={label}
                href="#top"
                aria-label={label}
                whileHover={{ scale: 1.15, y: -2 }}
                whileTap={{ scale: 0.9 }}
                className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-primary-emphasis"
              >
                <Icon className="size-3.5" />
              </motion.a>
            ))}
          </div>

          {/* Hai link pháp lý THẬT thay chuỗi chữ trơ "Privacy · Terms · Cookies":
              không có trang Cookies nên không hứa. */}
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <a href="/privacy" className="transition-colors hover:text-foreground">
              {t.legalPrivacy}
            </a>
            <span aria-hidden="true">·</span>
            <a href="/terms" className="transition-colors hover:text-foreground">
              {t.legalTerms}
            </a>
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
