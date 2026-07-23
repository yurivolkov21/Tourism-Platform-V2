'use client';

import { ArrowUpRightIcon, ClockIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { JOURNAL_POSTS } from '@/mocks/journal';
import { SectionEyebrow } from './section-eyebrow';

// Review #33: convert từ forged/Blog ("Insight Hub") — header hai bên (heading
// 2 dòng + nút outline phải), grid 3 card bài viết (ảnh chip category, meta
// đồng hồ · ngày, title hover đổi màu, excerpt cắt 2 dòng, tác giả + nút tròn
// mũi tên). Da thịt theo chuẩn dự án: bỏ ALL-CAPS 900 (bài học #25 — heading
// sentence case + dòng accent italic), token thuần, ảnh dùng placeholder tới
// khi trang chốt. Khôi phục section Journal từng bị bỏ rơi ở vòng convert #2.
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function Journal() {
  return (
    <section id="journal" className="w-full px-4 py-24 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        {/* Header: heading trái + nút outline phải (bố cục forged) */}
        <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <SectionEyebrow>Journal</SectionEyebrow>
            <motion.h2
              className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
            >
              Notes from the road,
              <br />
              <span className="text-primary italic">written by locals.</span>
            </motion.h2>
          </div>

          <motion.a
            href="#journal"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, ...SPRING }}
          >
            <span>Read all stories</span>
            <ArrowUpRightIcon className="size-4" aria-hidden="true" />
          </motion.a>
        </div>

        {/* Grid 3 card bài viết */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {JOURNAL_POSTS.map((post, index) => (
            <motion.article
              key={post.slug}
              className="group cursor-pointer"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: index * 0.1, ...SPRING }}
            >
              {/* Ảnh: placeholder + gradient chân + chip category */}
              <div className="relative mb-5 h-56 overflow-hidden rounded-2xl">
                <ImagePlaceholder
                  label={post.title}
                  className="h-full w-full transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-overlay/60 to-transparent" />
                <span className="absolute top-4 left-4 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold tracking-widest text-primary-foreground uppercase">
                  {post.category}
                </span>
              </div>

              {/* Meta: phút đọc · ngày */}
              <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ClockIcon className="size-2.5" aria-hidden="true" />
                  {post.readMinutes} min read
                </span>
                <span aria-hidden="true" className="opacity-50">
                  ·
                </span>
                <span>{DATE_FMT.format(new Date(post.date))}</span>
              </div>

              <h3 className="mb-3 font-heading text-xl leading-tight font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
                {post.title}
              </h3>

              <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>

              {/* Tác giả + nút tròn mũi tên */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{post.author}</span>
                <span className="flex size-8 items-center justify-center rounded-full border text-muted-foreground transition-all duration-300 group-hover:border-primary group-hover:text-primary">
                  <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
