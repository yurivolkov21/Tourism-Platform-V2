'use client';

import {
  BadgeDollarSignIcon,
  CalendarCheckIcon,
  CompassIcon,
  HandCoinsIcon,
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

const VALUES = [
  {
    icon: UsersIcon,
    title: 'Small groups',
    tag: 'Twelve max',
    description:
      'Twelve travellers, never more. Enough for stories around the table, few enough for silence on the water.',
  },
  {
    icon: HandCoinsIcon,
    title: 'Local pay stays local',
    tag: 'Fair share',
    description:
      'Guides set their own rates and keep them. What you pay reaches the valley you walk through.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Safety first',
    tag: 'Every route',
    description:
      'Every path walked by our own team before it goes on the map, every departure insured end to end.',
  },
  {
    icon: CalendarCheckIcon,
    title: 'Free cancellation',
    tag: '48 hours',
    description:
      'Plans change. Cancel up to 48 hours before departure for a full refund — no forms, no phone queue.',
  },
  {
    icon: BadgeDollarSignIcon,
    title: 'Fair pricing',
    tag: 'No hidden fees',
    description:
      'Every fee itemized before you book. The price you see is the price you pay, in any season.',
  },
  {
    icon: CompassIcon,
    title: 'No scripts',
    tag: 'The promise',
    description:
      'Guides tell their own stories at their own pace. If a market is better today than the plan, we follow the market.',
    highlight: true,
  },
];

export function AboutValues() {
  return (
    <section id="values" className="w-full bg-background px-4 py-24 md:px-16 md:py-32">
      <div className="mx-auto max-w-7xl">
        {/* Header 2 bên kiểu forged: heading trái, mô tả neo đáy phải */}
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <SectionEyebrow>What we promise</SectionEyebrow>
            <motion.h2
              className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={SPRING_HEADING}
            >
              Six promises,
              <br />
              <span className="text-primary-emphasis italic">kept since the minivan.</span>
            </motion.h2>
          </div>
          <motion.p
            className="max-w-xs text-sm leading-relaxed text-muted-foreground"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, ...SPRING }}
          >
            Written into how tours are priced, staffed, and led — not into a poster on the office
            wall.
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
