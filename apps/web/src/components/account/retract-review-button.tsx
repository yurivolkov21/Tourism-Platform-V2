'use client';

import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { classifySubmitError, submitToast } from '@/lib/api/submit';

// W4 U2 (ADR-0032 AMEND 1): nút rút review ĐÃ ĐĂNG — đứng dưới SlotNote của
// nhánh `approved` trên trang booking. Hai bước bấm (nút → câu xác nhận nói
// rõ tính chung cuộc) thay vì dialog kit: đây là một hành vi hiếm, một khối
// xác nhận inline đọc được trọn câu quan trọng nhất — "không hoàn tác".
export function RetractReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const t = messages.reviews.retract;

  async function retract() {
    setPending(true);
    try {
      await api.reviews.retract({ id: reviewId });
      submitToast('success', { title: t.toast.done.title, description: t.toast.done.body });
      // Server component đọc lại booking → slot chuyển sang `retracted`.
      router.refresh();
    } catch (submitError) {
      // Mã lỗi định danh của contract (vòng vá review W4): 409
      // REVIEW_NOT_RETRACTABLE = review đã đổi trạng thái sau khi trang
      // render (admin vừa gỡ/bác, hoặc bấm hai tab) — nói đúng chuyện, và
      // kéo trang tươi để slot khớp thực tế thay vì mời bấm lại mãi.
      const code =
        submitError instanceof ORPCError && submitError.defined ? submitError.code : null;
      const known = code ? t.errors[code as keyof typeof t.errors] : undefined;
      const kind = classifySubmitError(submitError);
      submitToast(known ? 'error' : kind, {
        title: t.toast.error.title,
        description: known ?? t.toast.error.body,
      });
      setConfirming(false);
      if (code === 'REVIEW_NOT_RETRACTABLE' || code === 'REVIEW_NOT_FOUND') router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-fit cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t.button}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/40 p-3">
      <p className="text-sm text-pretty">{t.confirm}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={retract}
          className="cursor-pointer rounded-full bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t.retracting : t.button}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
