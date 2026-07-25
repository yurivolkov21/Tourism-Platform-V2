'use client';

import { ArrowUpRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { PostCard } from '@/components/blog/post-card';
import { homeTeaserPosts } from '@/lib/blog';
import { JOURNAL_POSTS } from '@/mocks/journal';
import { SectionEyebrow } from './section-eyebrow';

// Review #33: convert từ forged/Blog ("Insight Hub") — header hai bên (heading
// 2 dòng + nút outline phải), grid 3 card bài viết. Da thịt theo chuẩn dự án:
// bỏ ALL-CAPS 900 (bài học #25 — heading sentence case + dòng accent italic),
// token thuần, ảnh dùng placeholder tới khi trang chốt. Khôi phục section
// Journal từng bị bỏ rơi ở vòng convert #2.
// Task 3c mục 1+2: card giờ dùng chung PostCard (Home là bản chuẩn, /blog kế
// thừa) — đồng thời vá lỗi lưới 3 cột từng hiện tràn 9 bài (Task 1 nâng mock
// 3→9 nhưng vòng lặp không giới hạn); giờ luôn cắt 3 bài mới nhất bằng
// sortPostsByDate + slice, không phụ thuộc thứ tự khai báo trong mock.
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
            href="/blog"
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

        {/* Grid 3 card bài viết — chỉ 3 bài mới nhất, lưới là 3 cột */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {homeTeaserPosts(JOURNAL_POSTS).map((post, index) => (
            <motion.div
              key={post.slug}
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: index * 0.1, ...SPRING }}
            >
              <PostCard post={post} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
