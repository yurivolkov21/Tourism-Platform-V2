'use client';

import { resilience } from '@tourism/i18n';
import Link from 'next/link';
import { ErrorState } from '@/components/feedback/error-state';

// Boundary lỗi runtime. Cố ý KHÔNG bọc SiteChrome: lỗi có thể phát ra từ
// chính chrome, bọc lại là mời lỗi tái diễn ngay trong màn báo lỗi.
const PILL_PRIMARY =
  'inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80';
const PILL_OUTLINE =
  'inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted';

// Tên KHÔNG đặt là `Error`: nó che global `Error`, mà chính annotation
// `error: Error` bên dưới lại trỏ vào global đó. Next chỉ quan tâm default
// export, tên hàm là gì cũng được.
export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = resilience.error;

  return (
    <ErrorState title={t.title} body={t.body}>
      <button type="button" onClick={reset} className={PILL_PRIMARY}>
        {t.retry}
      </button>
      <Link href="/" className={PILL_OUTLINE}>
        {t.home}
      </Link>
    </ErrorState>
  );
}
