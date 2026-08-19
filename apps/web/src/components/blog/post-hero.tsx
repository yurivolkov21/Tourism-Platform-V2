'use client';

import { ChevronRightIcon, ClockIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { SlotImage } from '@/components/slot-image';
import type { JournalPost } from '@/lib/api/posts';
import { SPRING, SPRING_HEADING } from '@/lib/motion';

// Hero bài viết: ảnh cover thật + scrim tối. Bọc scope `dark` vì navbar chưa
// cuộn dùng chữ on-media — hero sáng làm navbar tàng hình (pattern chốt ở
// /contact). Khác ContentHero của trang pháp lý ở chỗ có ảnh: bài viết vốn
// bán bằng hình.
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function PostHero({ post }: { post: JournalPost }) {
  return (
    <section className="dark relative w-full overflow-hidden px-4 pt-36 pb-16 text-foreground md:px-16 md:pb-20 lg:px-24 xl:px-32">
      {/* CHÍNH SÁCH ẢNH (user chốt 25/07): toàn site dùng placeholder, chỉ đổi
          sang ảnh thật khi user yêu cầu riêng. `corner` nép nhãn xuống góc để
          không đè lên tiêu đề bài viết.
          Review Task 4 (Minor, trợ năng): KHÔNG dùng post.title làm label —
          nó trùng y hệt <h1> ngay bên dưới nên trình đọc màn hình đọc tiêu đề
          bài hai lần liên tiếp. Dùng mô tả riêng cho ảnh cover thay vào đó. */}
      <SlotImage
        image={post.cover}
        corner
        label={`${post.category} · cover image`}
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 h-full w-full"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/90 to-background/60"
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Nhịp vào CÙNG SỐ với `ContentHero` (nhóm motion 5, 19/08): breadcrumb
            hạ xuống (−16, delay .1) → h1 trồi lên (40, SPRING_HEADING, .2) → meta
            (20, .3). Đây là hero màn đầu nên dùng `animate` lúc mount, cùng lệ
            với các hero khác — không phải `whileInView`. */}
        <motion.nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, ...SPRING }}
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <Link href="/blog" className="transition-colors hover:text-foreground">
            Journal
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            {post.category}
          </span>
        </motion.nav>

        <motion.h1
          className="mt-6 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance md:text-5xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING_HEADING, delay: 0.2 }}
        >
          {post.title}
        </motion.h1>

        <motion.div
          className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.3 }}
        >
          <span className="text-foreground">{post.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{DATE_FMT.format(new Date(post.date))}</time>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {post.readMinutes} min read
          </span>
          {/* Nhánh "Updated …" cũ đọc post.updated — cắt có chủ đích: contract
              PostDetail không có updatedAt, JournalPost/JournalPostDetail
              không mang field này (lib/api/posts.ts). */}
        </motion.div>
      </div>
    </section>
  );
}
