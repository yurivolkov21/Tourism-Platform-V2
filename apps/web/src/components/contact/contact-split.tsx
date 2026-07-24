'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { Separator } from '@tourism/ui/components/separator';
import { CompassIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { EMAIL, PHONE } from '@/components/home/contact';
import { PARTNERS } from '@/components/home/partners';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { REGIONS } from '@/mocks/regions';

// Contact §2 — section chính, convert ShadcnSpace Contact 01 "Project Inquiry":
// split 2 cột — TRÁI info (eyebrow + heading + Phone/Email/Location + separator
// + mini-marquee "Featured by" tái dùng danh sách Partners), PHẢI form trong
// card viền. Form nâng từ section Home (ContactField icon-in-field tái dùng)
// + MỚI: Select "Region of interest" — Nexora lấy option từ API categories
// (ISR 1h), đây mock từ REGIONS, ghi nợ API khi wire. Submit no-op static-first
// (nợ validate + honeypot + rate-limit đã ghi sổ từ Home).
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

const LOCATION = ['12 Hàng Bạc, Hoàn Kiếm', 'Hà Nội, Vietnam'];

// Chỗ trống trong "lá thư": gạch dưới nét đứt, chữ điền vào là serif italic
// màu primary — như mực khác màu trên thư in sẵn; focus đổi viền primary.
const LETTER_BLANK =
  'inline-block border-0 border-b-2 border-dashed border-border bg-transparent px-1 font-heading italic text-primary placeholder:text-muted-foreground/50 placeholder:not-italic outline-none transition-colors focus:border-primary';

export function ContactSplit() {
  return (
    <section id="enquiry" className="w-full px-4 py-20 md:px-16 md:py-28 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-8 md:gap-0">
        {/* Trái: info */}
        <div className="col-span-12 flex flex-col gap-8 md:col-span-6 md:gap-12">
          <motion.div
            className="flex flex-col gap-5"
            initial={{ x: -40, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={SPRING}
          >
            <SectionEyebrow>We can help</SectionEyebrow>
            <h2 className="max-w-md font-heading text-3xl leading-tight font-medium text-foreground md:text-4xl">
              Let’s plan your dates
              <span className="text-primary italic"> before the seats go.</span>
            </h2>
          </motion.div>

          <motion.div
            className="flex flex-col justify-between gap-6 sm:flex-row"
            initial={{ x: -40, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ...SPRING }}
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Phone</p>
              <a
                href={`tel:${PHONE.replace(/\s/g, '')}`}
                className="text-base font-medium text-primary"
              >
                {PHONE}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <a href={`mailto:${EMAIL}`} className="text-base font-medium text-primary">
                {EMAIL}
              </a>
            </div>
          </motion.div>

          <motion.div
            className="flex flex-col gap-1"
            initial={{ x: -40, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, ...SPRING }}
          >
            <p className="text-sm text-muted-foreground">Headquarters</p>
            <p className="text-base font-medium text-primary">{LOCATION.join(', ')}</p>
          </motion.div>

          <Separator />

          {/* Mini-marquee "Featured by" — tái dùng danh sách + cơ chế marquee nhà */}
          <motion.div
            className="flex flex-col gap-5"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, ...SPRING }}
          >
            <p className="text-sm text-muted-foreground">Featured by</p>
            <div className="relative max-w-md overflow-hidden">
              <div className="animate-marquee-left flex w-max">
                {[false, true].map((hidden) => (
                  <span
                    key={String(hidden)}
                    aria-hidden={hidden || undefined}
                    className="flex shrink-0 items-center"
                  >
                    {PARTNERS.slice(0, 6).map((name) => (
                      <span
                        key={name}
                        className="mr-8 text-sm font-semibold tracking-widest whitespace-nowrap text-muted-foreground/60 uppercase"
                      >
                        {name}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent" />
            </div>
          </motion.div>
        </div>

        <div className="hidden md:col-span-1 md:block" />

        {/* Phải: "LÁ THƯ" — chữ ký của trang (nâng cấp 6.5→wow, skill
            frontend-design: đặt cược táo bạo ở MỘT chỗ = chính form, vì luận
            đề trang là "not a hotline" mà form kiểu hotline thì tự phản bội).
            Form mad-libs: người dùng điền vào CHỖ TRỐNG giữa câu văn Literata
            italic; tem thư góc card; tái bút cam kết người thật đọc thư.
            A11y: mỗi blank có aria-label (ngữ cảnh câu văn là label thị giác). */}
        <motion.div
          className="col-span-12 md:col-span-5"
          initial={{ x: 40, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, ...SPRING }}
        >
          <form
            className="relative flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-(--shadow-card) md:p-9"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Tem thư góc trên-phải: viền răng cưa dashed + la bàn, nghiêng nhẹ */}
            <div
              aria-hidden="true"
              className="absolute top-5 right-5 flex rotate-3 flex-col items-center gap-1 rounded-sm border-2 border-dashed border-primary/40 px-3 py-2 text-primary"
            >
              <CompassIcon className="size-5" />
              <span className="text-[9px] font-semibold tracking-widest uppercase">
                Hà Nội · Sa Pa
              </span>
            </div>

            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Write us a letter
            </p>

            {/* Thân thư — câu văn với chỗ trống gạch dưới nét đứt */}
            <div className="font-heading text-lg/relaxed text-card-foreground md:text-xl/relaxed">
              <span>Hello tourism, we are </span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="How many travellers"
                placeholder="2"
                className={`${LETTER_BLANK} w-10 text-center`}
              />
              <span> travellers, dreaming of </span>
              <Select>
                <SelectTrigger
                  aria-label="Region of interest"
                  className={`${LETTER_BLANK} inline-flex h-auto w-auto gap-1 rounded-none py-0 font-heading text-lg text-primary italic shadow-none focus-visible:ring-0 md:text-xl`}
                >
                  <SelectValue placeholder="anywhere in Vietnam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {/* Option mock từ REGIONS — nợ API categories như Nexora */}
                    <SelectItem value="any">anywhere in Vietnam</SelectItem>
                    {REGIONS.map((region) => (
                      <SelectItem key={region.key} value={region.key}>
                        {region.name.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <span> sometime around </span>
              <input
                type="text"
                aria-label="Travel dates"
                placeholder="Oct 12 – 18"
                className={`${LETTER_BLANK} w-32`}
              />
              <span>. What we love most: </span>
              <input
                type="text"
                aria-label="What you love when travelling"
                placeholder="easy pace, food markets"
                className={`${LETTER_BLANK} w-full md:w-72`}
              />
              <span>. Write back to </span>
              <input
                type="email"
                aria-label="Your email address"
                placeholder="michael@example.com"
                className={`${LETTER_BLANK} w-56`}
              />
              <span>.</span>
              <div className="mt-5 flex items-baseline justify-end gap-2">
                <span>—</span>
                <input
                  type="text"
                  aria-label="Your name"
                  placeholder="your name"
                  className={`${LETTER_BLANK} w-40`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="cursor-pointer self-start rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Send the letter
              </button>
              <p className="text-xs text-muted-foreground italic">
                P.S. A human reads every letter — no bots on this side.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
