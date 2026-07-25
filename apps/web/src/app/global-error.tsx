'use client';

import { resilience } from '@tourism/i18n';
import { ErrorState } from '@/components/feedback/error-state';
import './globals.css';

// Boundary cuối: lỗi ở chính root layout. Phải tự dựng <html>/<body> vì root
// layout đã hỏng. Nút Reload dùng <button> trần, không phụ thuộc gói UI.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = resilience.globalError;

  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorState title={t.title} body={t.body}>
          <button
            type="button"
            onClick={reset}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            {t.retry}
          </button>
        </ErrorState>
      </body>
    </html>
  );
}
