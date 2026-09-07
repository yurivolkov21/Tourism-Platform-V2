import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentHero } from '@/components/content/content-hero';
import { ConfirmPanel } from '@/components/newsletter/confirm-panel';
import { api } from '@/lib/api/client';
import { settle } from '@/lib/api/resilience';
import { parseUnsubscribeParams } from '@/lib/unsubscribe';

// Trang `/newsletter/confirm?id=&token=` (W4 E3 — double opt-in), CÙNG khuôn
// với `/newsletter/unsubscribe`: đi vào từ link trong email, per-token nên
// dynamic rendering (đọc searchParams), không sitemap, noindex. GET
// `confirmInfo` KHÔNG side effect — mail client prefetch link, khách phải tự
// bấm nút trên trang thì POST claim mới chạy.
export const metadata: Metadata = {
  title: `${messages.newsletterConfirmPage.title} — Nexora`,
  description: messages.newsletterConfirmPage.subtitle,
  robots: { index: false },
};

function StaticPanel({
  heading,
  body,
  homeLink,
}: {
  heading: string;
  body: string;
  homeLink: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center shadow-(--shadow-card) md:p-9">
      <h2 className="font-heading text-2xl font-medium text-balance text-foreground">{heading}</h2>
      <p className="mt-3 text-pretty text-muted-foreground">{body}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        {homeLink}
      </Link>
    </div>
  );
}

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const t = messages.newsletterConfirmPage;
  // Cùng parser với trang unsubscribe (`id` uuid + `token` non-empty) —
  // link hỏng không xứng một round-trip API.
  const params = parseUnsubscribeParams(await searchParams);
  const infoRes = params
    ? await settle(api.newsletter.confirmInfo({ id: params.id, token: params.token }))
    : null;

  // Token hỏng/thiếu param/GET lỗi → panel lỗi thân thiện, KHÔNG 404 — người
  // bấm link email xứng đáng một lời giải thích (cùng luật trang unsubscribe).
  if (!params || !infoRes?.ok) {
    return (
      <>
        <ContentHero breadcrumb={t.breadcrumbCurrent} title={t.title} />
        <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
          <StaticPanel
            heading={t.invalidToken.heading}
            body={t.invalidToken.body}
            homeLink={t.invalidToken.homeLink}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHero breadcrumb={t.breadcrumbCurrent} title={t.title} subtitle={t.subtitle} />
      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-md">
          {infoRes.data.alreadyConfirmed ? (
            // Bấm lại link cũ — không có gì để làm, panel tĩnh là đủ (không
            // dựng client island cho một khối không có hành vi).
            <StaticPanel
              heading={t.alreadyConfirmed.heading}
              body={t.alreadyConfirmed.body(infoRes.data.email)}
              homeLink={t.alreadyConfirmed.homeLink}
            />
          ) : (
            <ConfirmPanel id={params.id} token={params.token} email={infoRes.data.email} />
          )}
        </div>
      </div>
    </>
  );
}
