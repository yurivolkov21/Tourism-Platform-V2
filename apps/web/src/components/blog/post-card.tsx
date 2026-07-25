import { ClockIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { MockJournalPost } from '@/mocks/types';

// Card bài viết dùng chung cho lưới /blog và khối "More from the journal"
// cuối bài. `featured` là bài mới nhất — chiếm 2 cột, ảnh cao hơn (lối lưới
// tạp chí của Nexora). Ảnh mock là ảnh THẬT nên dùng next/image.
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function PostCard({
  post,
  featured = false,
}: {
  post: MockJournalPost;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40 ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <div className={`relative overflow-hidden ${featured ? 'aspect-16/9' : 'aspect-4/3'}`}>
        <Image
          src={post.image}
          alt=""
          fill
          sizes={featured ? '(min-width: 640px) 66vw, 100vw' : '(min-width: 640px) 33vw, 100vw'}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-4 left-4 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
          {post.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {post.readMinutes} min read
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{DATE_FMT.format(new Date(post.date))}</time>
        </div>

        <h3
          className={`font-heading font-medium text-balance text-foreground transition-colors group-hover:text-primary ${
            featured ? 'text-2xl md:text-3xl' : 'text-lg'
          }`}
        >
          {post.title}
        </h3>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
        <p className="mt-auto pt-5 text-xs text-muted-foreground">{post.author}</p>
      </div>
    </Link>
  );
}
