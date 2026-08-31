'use client';

import { messages } from '@tourism/i18n';
import { Button, buttonVariants } from '@tourism/ui/components/button';
import Link from 'next/link';

/**
 * Boundary lỗi runtime cho TOÀN admin (review F1 31/08 — trước đó không có
 * boundary nào, 401 phiên chết giữa chừng/timeout 10s/API sập đều nổ ra trang
 * lỗi thô của Next). Đặt ở ROOT để hứng cả lỗi từ layout gác (getServerSession
 * ném khi API không với tới); cố ý KHÔNG dựng shell — lỗi có thể phát từ chính
 * đường lấy session mà shell cần (cùng lý do web/error.tsx không bọc chrome).
 */
const t = messages.admin.errors;

// Không đặt tên `Error`: che mất global Error mà annotation bên dưới cần.
export default function AdminRouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t.body}</p>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={reset}>
          {t.retry}
        </Button>
        {/* Phiên hết hạn là nguyên nhân đời thường nhất — cho lối ra thẳng. */}
        <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
          {t.signIn}
        </Link>
      </div>
    </main>
  );
}
