'use client';

import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import { StarIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { TESTIMONIALS } from '@/mocks/testimonials';
import type { MockTestimonial } from '@/mocks/types';
import { SectionEyebrow } from './section-eyebrow';

// Convert từ Estate testimonials.tsx: cột trái heading, cột phải marquee dọc
// 2 cột chạy ngược chiều (keyframes marquee-up/down trong globals.css, hover
// thì tạm dừng). Avatar dùng fallback chữ cái thay ảnh người.
const col1 = TESTIMONIALS.slice(0, 4);
const col2 = TESTIMONIALS.slice(4, 8);

function TestimonialCard({ item }: { item: MockTestimonial }) {
  return (
    <div className="flex w-[280px] flex-col gap-4 rounded-xl bg-card p-6 select-none sm:w-[320px]">
      <div className="flex items-center gap-3">
        <Avatar className="size-11">
          <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-card-foreground">{item.name}</span>
          <span className="mt-0.5 text-sm text-muted-foreground">{item.location}</span>
        </div>
      </div>

      <div
        role="img"
        aria-label={`${item.rating} out of 5 stars`}
        className="flex items-center gap-1"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon
            // biome-ignore lint/suspicious/noArrayIndexKey: dãy sao tĩnh 5 phần tử, không reorder
            key={i}
            aria-hidden="true"
            className={
              i < Math.round(item.rating)
                ? 'size-3! fill-rating text-rating'
                : 'size-3! text-rating-muted'
            }
          />
        ))}
      </div>

      <p className="text-sm/5.5 text-muted-foreground">{item.quote}</p>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="w-full overflow-hidden bg-muted px-4 py-20 md:px-16 md:py-40 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start justify-start gap-4 lg:grid-cols-12 lg:gap-2">
        {/* Cột trái: heading */}
        <div className="mt-20 flex flex-col items-start lg:col-span-5">
          <SectionEyebrow>Reviews</SectionEyebrow>
          <div className="mt-3.5 h-[1.5px] w-[148px] bg-linear-to-r from-foreground to-transparent" />
          <motion.h2
            className="mt-5 max-w-[400px] font-heading text-3xl leading-tight font-medium text-foreground md:text-[34px]/12"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
          >
            Trusted by travelers. Proven by stories.
          </motion.h2>
          <motion.p
            className="mt-2.5 max-w-[340px] text-sm text-muted-foreground md:text-base"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
          >
            Honest words from people who trusted us with their time off.
          </motion.p>
        </div>

        {/* Cột phải: marquee 2 cột ngược chiều, fade mask trên dưới */}
        <div className="relative mt-10 flex h-[520px] justify-center gap-5 overflow-hidden md:h-[580px] md:justify-start lg:col-span-7 lg:mt-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-linear-to-b from-muted to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-linear-to-t from-muted to-transparent" />

          {/* Danh sách nhân đôi cho loop liền mạch — bản sao thứ hai ẩn khỏi a11y tree */}
          <div className="flex h-full flex-col overflow-hidden">
            <div className="animate-marquee-up flex flex-col gap-5 py-2">
              {col1.map((item) => (
                <TestimonialCard key={item.name} item={item} />
              ))}
              <div aria-hidden="true" className="flex flex-col gap-5">
                {col1.map((item) => (
                  <TestimonialCard key={`${item.name}-clone`} item={item} />
                ))}
              </div>
            </div>
          </div>

          <div className="hidden h-full flex-col overflow-hidden sm:flex">
            <div className="animate-marquee-down flex flex-col gap-5 py-2">
              {col2.map((item) => (
                <TestimonialCard key={item.name} item={item} />
              ))}
              <div aria-hidden="true" className="flex flex-col gap-5">
                {col2.map((item) => (
                  <TestimonialCard key={`${item.name}-clone`} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
