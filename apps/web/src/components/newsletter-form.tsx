'use client';

import { messages } from '@tourism/i18n';
import { ArrowUpRightIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { classifySubmitError, submitToast } from '@/lib/api/submit';
import { validateNewsletterEmail } from '@/lib/newsletter-form';

// Form newsletter footer (spec §3, task-3-brief.md) — TÁCH riêng khỏi
// `SiteFooter` (client lớn vì motion, chứa link groups/social/watermark
// không liên quan) để: (1) diff footer chỉ khoanh vùng import + 1 dòng JSX,
// (2) spec jsdom của form này không phải stub IntersectionObserver hay render
// cả cây stagger của footer chỉ để test một input+nút. Markup/token GIỮ
// NGUYÊN nhìn cũ (input rounded-l-full nối liền nút rounded-r-full) — chỉ
// thêm state/validate/submit, cùng khuôn honeypot với `contact-split.tsx`.
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  // Submit: validate CLIENT bằng `validateNewsletterEmail` (chính
  // `SubscribeInputSchema`) trước; server vẫn là chốt cuối. Response server
  // LUÔN `{subscribed: true}` (anti-enumeration, spec §3) → toast MỘT KIỂU
  // DUY NHẤT cho mọi email hợp lệ, KHÔNG thêm nhánh nào phân biệt email
  // mới/đã tồn tại — kể cả trong code path này.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validateNewsletterEmail(email);
    setError(nextError);
    if (nextError) {
      return;
    }

    setPending(true);
    try {
      // Honeypot: passthrough NGUYÊN GIÁ TRỊ khi non-empty — người thật luôn
      // để rỗng nên field vắng mặt trong đa số request thật (cùng khuôn
      // `buildEnquiryPayload`).
      await api.newsletter.subscribe(website ? { email, website } : { email });
      submitToast('success', {
        title: messages.newsletterForm.toast.success.title,
        description: messages.newsletterForm.toast.success.body,
      });
      setEmail('');
      setWebsite('');
    } catch (submitError) {
      // Lỗi mạng/5xx/429 → toast phân loại (spec §3, cùng `classifySubmitError`
      // với contact). GIỮ NGUYÊN email đã nhập.
      const kind = classifySubmitError(submitError);
      const copy =
        kind === 'throttle'
          ? messages.newsletterForm.toast.throttle
          : messages.newsletterForm.toast.error;
      submitToast(kind, { title: copy.title, description: copy.body });
    } finally {
      setPending(false);
    }
  }

  return (
    // `relative` để wrapper honeypot `absolute` neo đúng vào form này (khớp
    // `contact-split.tsx`) — thiếu class này wrapper sẽ neo theo ancestor
    // positioned gần nhất phía trên, sai vị trí (final review).
    <form onSubmit={handleSubmit} noValidate className="relative">
      <label
        htmlFor="footer-newsletter"
        className="mb-3 block text-xs font-semibold tracking-widest uppercase"
      >
        {messages.newsletterForm.heading}
      </label>

      {/* Honeypot — cùng kỹ thuật `contact-split.tsx` (spec §2): wrapper
          aria-hidden + tabIndex -1 kéo cả input ra khỏi accessibility tree và
          tab order; CSS đẩy khỏi viewport (KHÔNG display:none) để bot ngây
          thơ đọc DOM/CSS thô vẫn tưởng đây là field thật. */}
      <div
        aria-hidden="true"
        tabIndex={-1}
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="footer-newsletter-website">Website</label>
        <input
          id="footer-newsletter-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="flex">
        <input
          id="footer-newsletter"
          type="email"
          placeholder={messages.newsletterForm.inputPlaceholder}
          className="min-w-0 flex-1 rounded-l-full border border-r-0 bg-card px-5 py-3 text-sm text-card-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={messages.newsletterForm.submitLabel}
          className="cursor-pointer rounded-r-full bg-primary px-5 py-3 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowUpRightIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive-emphasis">
          {error}
        </p>
      )}
    </form>
  );
}
