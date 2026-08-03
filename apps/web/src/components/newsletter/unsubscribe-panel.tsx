'use client';

import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { classifySubmitError, submitToast } from '@/lib/api/submit';
import { nextPanelState, type PanelState } from '@/lib/unsubscribe';

// Panel client cho trang `/newsletter/unsubscribe` (spec §4). 3 trạng thái CÓ
// COPY riêng trong `messages.unsubscribePage` — trạng thái `invalidToken` là
// trạng thái thứ 4 của CẢ TRANG, render ở page.tsx (server), KHÔNG qua
// component này (đúng khuôn task-4-brief: page tự quyết panel lỗi token khi
// thiếu/sai param, khỏi dựng client island cho một khối tĩnh).
export function UnsubscribePanel({
  id,
  token,
  email,
  alreadyUnsubscribed,
}: {
  id: string;
  token: string;
  email: string;
  alreadyUnsubscribed: boolean;
}) {
  const [state, setState] = useState<PanelState>(
    alreadyUnsubscribed ? 'alreadyUnsubscribed' : 'confirm',
  );
  const [pending, setPending] = useState(false);
  const t = messages.unsubscribePage;

  // Dùng chung một khung try/catch cho cả hai POST (unsubscribe/resubscribe):
  // gọi đúng procedure ứng với `action`, thành công → toast + chuyển state
  // qua `nextPanelState` (hàm thuần, xem lib/unsubscribe.ts); lỗi → toast
  // phân loại (`classifySubmitError`) bằng copy lỗi CHUNG (`t.toast.error`) —
  // trang này không có copy throttle riêng, chỉ khác MÀU toast (warning/error).
  async function submitAction(action: 'unsubscribe-success' | 'resubscribe-success') {
    setPending(true);
    try {
      if (action === 'unsubscribe-success') {
        await api.newsletter.unsubscribe({ id, token });
        submitToast('success', {
          title: t.toast.unsubscribed.title,
          description: t.toast.unsubscribed.body,
        });
      } else {
        await api.newsletter.resubscribe({ id, token });
        submitToast('success', {
          title: t.toast.resubscribed.title,
          description: t.toast.resubscribed.body,
        });
      }
      setState((current) => nextPanelState(current, action));
    } catch (submitError) {
      const kind = classifySubmitError(submitError);
      submitToast(kind, { title: t.toast.error.title, description: t.toast.error.body });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 text-center shadow-(--shadow-card) md:p-9">
      {state === 'confirm' && (
        <>
          <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
            {t.confirm.heading}
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">{t.confirm.body(email)}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => submitAction('unsubscribe-success')}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t.confirm.submitting : t.confirm.button}
          </button>
        </>
      )}

      {state === 'alreadyUnsubscribed' && (
        <>
          <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
            {t.alreadyUnsubscribed.heading}
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            {t.alreadyUnsubscribed.body(email)}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => submitAction('resubscribe-success')}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? t.alreadyUnsubscribed.resubscribing
              : t.alreadyUnsubscribed.resubscribeButton}
          </button>
        </>
      )}

      {state === 'unsubscribed' && (
        <>
          <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
            {t.unsubscribed.heading}
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">{t.unsubscribed.body}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => submitAction('resubscribe-success')}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t.unsubscribed.resubscribing : t.unsubscribed.resubscribeButton}
          </button>
        </>
      )}
    </div>
  );
}
