import { ChevronRightIcon, ClockIcon } from 'lucide-react';
import Link from 'next/link';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { MockJournalPost } from '@/mocks/types';

// Hero bài viết: ảnh cover thật + scrim tối. Bọc scope `dark` vì navbar chưa
// cuộn dùng chữ on-media — hero sáng làm navbar tàng hình (pattern chốt ở
// /contact). Khác ContentHero của trang pháp lý ở chỗ có ảnh: bài viết vốn
// bán bằng hình.
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function PostHero({ post }: { post: MockJournalPost }) {
  return (
    <section className="dark relative w-full overflow-hidden px-4 pt-36 pb-16 text-foreground md:px-16 md:pb-20 lg:px-24 xl:px-32">
      {/* CHÍNH SÁCH ẢNH (user chốt 25/07): toàn site dùng placeholder, chỉ đổi
          sang ảnh thật khi user yêu cầu riêng. `corner` nép nhãn xuống góc để
          không đè lên tiêu đề bài viết. */}
      <ImagePlaceholder
        corner
        label={post.title}
        className="absolute inset-0 -z-20 h-full w-full"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/90 to-background/60"
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
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
        </nav>

        <h1 className="mt-6 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance md:text-5xl">
          {post.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="text-foreground">{post.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{DATE_FMT.format(new Date(post.date))}</time>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {post.readMinutes} min read
          </span>
          {post.updated ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Updated {DATE_FMT.format(new Date(post.updated))}</span>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
