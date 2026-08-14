'use client';

import { QuoteIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { CountUp } from '@/components/motion/count-up';
import { SlotImage } from '@/components/slot-image';
import type { SiteMediaItem } from '@/lib/api/site-media';
import { SPRING } from '@/lib/motion';

// About §2 Story (convert 100% lối forged/About, da thịt token + án lệ #25):
// grid 5/7 — trái ảnh cao 600-700px + floating box accent "12+" đè góc
// dưới-phải (scale-in trễ); phải eyebrow + heading 2 dòng (dòng 2 accent
// italic) + 2 đoạn mission + hàng feature pill + 2 mini-quote card guide bản
// địa (quote của Mai hồi sinh từ WhyChooseUs #26→#27). Motion: ảnh SlideIn
// từ trái, cột phải FadeUp bậc thang — spring nhà 320/70.

const PILLS = ['Local guides only', 'Twelve travellers max', 'Three regions', 'No scripts'];

const QUOTES = [
  {
    text: 'I take people across the terraces my grandfather planted. That is the whole job.',
    name: 'Mai',
    role: 'Sa Pa guide',
  },
  {
    text: 'The river taught me its schedule. I just translate it for our guests.',
    name: 'Tâm',
    role: 'Cần Thơ guide',
  },
];

function FadeUp({
  delay,
  className,
  children,
}: {
  delay: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      initial={{ y: 40, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

export function AboutStory({ storyImage = null }: { storyImage?: SiteMediaItem | null }) {
  return (
    <section id="story" className="w-full px-4 py-24 md:px-16 md:py-32 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-12">
        {/* Trái: ảnh cao + floating box accent */}
        <motion.div
          className="relative lg:col-span-5"
          initial={{ x: -60, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING}
        >
          <div className="relative h-[600px] overflow-hidden rounded-2xl lg:h-[700px]">
            <SlotImage
              image={storyImage}
              corner
              label="Story — the first minivan, Sa Pa 2014"
              className="absolute inset-0 h-full w-full"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-overlay/60 to-transparent" />
          </div>
          {/* Floating box "12+ years" — scale-in trễ như forged */}
          <motion.div
            className="absolute -right-4 -bottom-6 rounded-xl bg-primary px-6 py-5 text-primary-foreground shadow-(--shadow-card) md:-right-6"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ ...SPRING, delay: 0.4 }}
          >
            <p className="font-heading text-4xl leading-none font-semibold">
              <CountUp to={12} />+
            </p>
            <p className="mt-1 text-xs font-medium tracking-widest uppercase opacity-75">
              Years
              <br />
              on the road
            </p>
          </motion.div>
        </motion.div>

        {/* Phải: eyebrow + heading + mission + pill + 2 quote */}
        <div className="lg:col-span-7">
          <SectionEyebrow>Our story</SectionEyebrow>

          <FadeUp delay={0.1}>
            <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
              We don’t sell tours.
              <br />
              <span className="text-primary-emphasis italic">We introduce you to home.</span>
            </h2>
          </FadeUp>

          <FadeUp delay={0.2}>
            <p className="mt-6 max-w-[560px] text-sm leading-relaxed text-muted-foreground md:text-base">
              tourism started in 2014 with a simple bet: the person who grew up on a path shows it
              better than any brochure. Three guides, one borrowed minivan, and the misty terraces
              of the north.
            </p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-muted-foreground md:text-base">
              Eleven years later we are still small on purpose — twelve travellers at most, three
              regions, and guides who set the pace of their own valleys. Growth, for us, means
              deeper roads, not more of them.
            </p>
          </FadeUp>

          {/* Hàng feature pill */}
          <FadeUp delay={0.4} className="mt-7 flex flex-wrap gap-2.5">
            {PILLS.map((pill) => (
              <span
                key={pill}
                className="rounded-full border px-4 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {pill}
              </span>
            ))}
          </FadeUp>

          {/* 2 mini-quote guide */}
          <FadeUp delay={0.5} className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUOTES.map((quote) => (
              <figure key={quote.name} className="rounded-xl border bg-card p-5">
                <QuoteIcon className="size-4 text-primary-emphasis" aria-hidden="true" />
                <blockquote className="mt-3 font-heading text-sm text-card-foreground/85 italic">
                  “{quote.text}”
                </blockquote>
                <figcaption className="mt-3 text-xs text-muted-foreground">
                  {quote.name} — {quote.role}
                </figcaption>
              </figure>
            ))}
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
