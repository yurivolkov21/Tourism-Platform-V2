'use client';

import { messages } from '@tourism/i18n';
import { RotateCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Panel lỗi tải section (ADR-0016 §4). Retry = router.refresh() — chạy lại
 * RSC fetch của trang, đúng mẫu LoadErrorState Nexora. KHÔNG dùng cho lỗi
 * validate form (inline cạnh field) — chỉ cho section dữ liệu API.
 */
export function LoadErrorState({ className = '' }: { className?: string }) {
  const router = useRouter();
  const t = messages.feedback.loadError;
  return (
    <div role="alert" className={`rounded-2xl border border-dashed p-12 text-center ${className}`}>
      <h2 className="font-heading text-xl font-medium text-foreground">{t.title}</h2>
      <p className="mt-2 text-pretty text-muted-foreground">{t.body}</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <RotateCwIcon className="size-3.5" aria-hidden="true" />
        {t.retry}
      </button>
    </div>
  );
}
