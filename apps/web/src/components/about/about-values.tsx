'use client';

import { aboutPage } from '@tourism/i18n';
import {
  BadgeDollarSignIcon,
  CalendarCheckIcon,
  CompassIcon,
  HandCoinsIcon,
  type LucideIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SPRING, SPRING_HEADING } from '@/lib/motion';

// About §Values "The promises we keep" (convert 100% lối forged/Services —
// quán quân hạng values của bản quét 12 template): header 2 bên (heading trái,
// mô tả phải), lưới 6 thẻ hairline gap-px (cùng ngôn ngữ lưới Numbers nhưng
// bản SÁNG), mỗi thẻ tag pill + icon trong ô bo + tiêu đề + mô tả + mũi tên
// "hiện khi hover"; MỘT thẻ highlight (No scripts) có thanh accent trên đỉnh
// + tag/icon nền primary. Vai trò tự sự: giải thích các lời hứa mới chỉ được
// teaser ở pill Story / ô "0 Scripts" Numbers / marquee CTA. Da thịt token +
// án lệ #25 (bỏ uppercase 900); hover đổi nền bằng CSS class thay JS
// whileHover backgroundColor của bản gốc.

const t = aboutPage.values;

// Kiểu khai tường minh: phần chữ trải ra từ object `as const` nên TS không còn tự thêm
// `highlight?: undefined` cho năm thẻ thường, đọc `value.highlight` sẽ báo lỗi.
interface ValueCard {
  icon: LucideIcon;
  title: string;
  tag: string;
  description: string;
  /** Thẻ nổi bật duy nhất: thanh accent trên đỉnh + tag/icon nền primary. */
  highlight?: boolean;
}

// Chữ của từng thẻ (`title`, `tag`, `description`) trải ra từ `aboutPage.values.items` — lý do
// câu chữ thẻ "Free cancellation" (vá 04/09, ADR-0041) ghi ngay cạnh chuỗi đó.
const VALUES: ValueCard[] = [
  { icon: UsersIcon, ...t.items.smallGroups },
  { icon: HandCoinsIcon, ...t.items.localPay },
  { icon: ShieldCheckIcon, ...t.items.safety },
  { icon: CalendarCheckIcon, ...t.items.freeCancellation },
  { icon: BadgeDollarSignIcon, ...t.items.fairPricing },
  { icon: CompassIcon, ...t.items.noScripts, highlight: true },
];

export function AboutValues() {
  return (
    <section id="values" className="w-full bg-background px-4 py-24 md:px-16 md:py-32">
      <div className="mx-auto max-w-7xl">
        {/* Header 2 bên kiểu forged: heading trái, mô tả neo đáy phải */}
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
            <motion.h2
              className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={SPRING_HEADING}
            >
              {t.titleLead}
              <br />
              <span className="text-primary-emphasis italic">{t.titleAccent}</span>
            </motion.h2>
          </div>
          <motion.p
            className="max-w-xs text-sm leading-relaxed text-muted-foreground"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, ...SPRING }}
          >
            {t.intro}
          </motion.p>
        </div>

        {/* Lưới 6 thẻ hairline — gap-px trên nền border, bo cả cụm */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((value, index) => (
            <motion.div
              key={value.title}
              className={`group relative cursor-default p-8 transition-colors duration-300 ${
                value.highlight
                  ? 'bg-muted/40 hover:bg-muted/70'
                  : 'bg-background hover:bg-muted/50'
              }`}
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ ...SPRING, delay: index * 0.08 }}
            >
              {/* Thanh accent đỉnh thẻ highlight */}
              {value.highlight && (
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
              )}

              <span
                className={`mb-6 inline-block rounded-full px-3 py-1 text-[10px] font-semibold tracking-widest uppercase ${
                  value.highlight
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {value.tag}
              </span>

              <div
                className={`mb-5 flex size-12 items-center justify-center rounded-xl transition-all duration-300 ${
                  value.highlight
                    ? 'bg-primary text-primary-foreground group-hover:scale-110'
                    : 'bg-muted text-primary-emphasis group-hover:bg-primary/10'
                }`}
              >
                <value.icon className="size-5.5" aria-hidden="true" />
              </div>

              <h3 className="mb-3 font-heading text-xl font-semibold text-foreground transition-colors duration-300 group-hover:text-primary-emphasis">
                {value.title}
              </h3>

              <p className="text-sm leading-relaxed text-muted-foreground">{value.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
