'use client';

import { messages } from '@tourism/i18n';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { classifySubmitError, submitToast } from '@/lib/api/submit';

// Panel client cho trang `/newsletter/confirm` (W4 E3 — double opt-in, cùng
// khuôn `UnsubscribePanel`): GET đã chạy ở page (không side effect — mail
// client prefetch), khách phải BẤM nút thì POST claim mới chạy. Hai trạng
// thái có nút/na: `confirm` (chưa xác nhận) → `confirmed` (vừa bấm xong);
// `alreadyConfirmed` render tĩnh ở page, không cần client island.
export function ConfirmPanel({
  id,
  token,
  email,
}: {
  id: string;
  /** Token mục đích `confirm` lấy thẳng từ URL email. */
  token: string;
  email: string;
}) {
  const [state, setState] = useState<'confirm' | 'confirmed'>('confirm');
  const [pending, setPending] = useState(false);
  const t = messages.newsletterConfirmPage;

  async function submit() {
    setPending(true);
    try {
      await api.newsletter.confirm({ id, token });
      submitToast('success', {
        title: t.toast.confirmed.title,
        description: t.toast.confirmed.body,
      });
      setState('confirmed');
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
            onClick={submit}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t.confirm.submitting : t.confirm.button}
          </button>
        </>
      )}

      {state === 'confirmed' && (
        <>
          <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
            {t.confirmed.heading}
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">{t.confirmed.body}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t.confirmed.homeLink}
          </Link>
        </>
      )}
    </div>
  );
}
