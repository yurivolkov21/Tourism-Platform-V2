import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { MockJournalPost } from '@/mocks/types';

// Dải điều hướng cuối bài. Ô trống được giữ chỗ bằng <div /> để bài mới nhất
// và bài cũ nhất vẫn có ô còn lại nằm đúng bên phải/trái của nó.
export function PostNav({ newer, older }: { newer?: MockJournalPost; older?: MockJournalPost }) {
  if (!newer && !older) return null;

  return (
    <nav
      aria-label="More articles"
      className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2"
    >
      {newer ? (
        <Link
          href={`/blog/${newer.slug}`}
          className="group rounded-2xl border p-5 transition-colors hover:border-primary/40"
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            Newer
          </span>
          <p className="mt-2 font-heading text-base font-medium text-balance text-foreground transition-colors group-hover:text-primary">
            {newer.title}
          </p>
        </Link>
      ) : (
        <div />
      )}

      {older ? (
        <Link
          href={`/blog/${older.slug}`}
          className="group rounded-2xl border p-5 text-right transition-colors hover:border-primary/40"
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Older
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </span>
          <p className="mt-2 font-heading text-base font-medium text-balance text-foreground transition-colors group-hover:text-primary">
            {older.title}
          </p>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
