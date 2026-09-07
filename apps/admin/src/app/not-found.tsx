import { messages } from '@tourism/i18n';
import { buttonVariants } from '@tourism/ui/components/button';
import Link from 'next/link';
import { connection } from 'next/server';

/**
 * 404 của admin (review F1 31/08): hứng cả route lạ lẫn `notFound()` từ các
 * trang chi tiết (vd `/bookings/[code]` với mã không tồn tại) — trước đó rơi
 * về 404 trắng mặc định của Next, không lối về. Không dựng shell: 404 có thể
 * đến từ URL gõ tay khi chưa đăng nhập, kéo session ở đây là thêm một đường
 * ném lỗi nữa vào trang báo lỗi.
 */
const t = messages.admin.errors;

export default async function AdminNotFound() {
  // Ép render động (W3-H2): /_not-found tĩnh không nhận nonce → script
  // hydrate bị CSP chặn, console 404 đầy "Refused" dù trang vẫn hiện.
  // not-found được phép async + dynamic API (doc file convention của bản
  // Next này, §"mark it as async").
  await connection();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t.notFoundTitle}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t.notFoundBody}</p>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        {t.backHome}
      </Link>
    </main>
  );
}
