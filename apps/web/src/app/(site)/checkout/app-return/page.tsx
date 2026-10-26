import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { AppReturnRedirect } from '@/components/checkout/app-return-redirect';
import { ContentHero } from '@/components/content/content-hero';
import { appReturnTarget } from '@/lib/app-return';

export const metadata: Metadata = {
  title: messages.pageMeta.withBrand(messages.booking.appReturn.title),
  robots: { index: false, follow: false },
};

/**
 * Cổng thanh toán trả khách app mobile về đây (ADR-0062) — Stripe/PayPal chỉ nhận `https`, nên
 * trang này đứng giữa và chuyển tiếp sang URL app. KHÔNG cần phiên: khách trên app không có cookie
 * web, và trang không đọc dữ liệu đơn nào — app tự hỏi lại `bookings.byCode` sau khi về.
 */
export default async function CheckoutAppReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; code?: string; status?: string }>;
}) {
  const t = messages.booking.appReturn;
  const target = appReturnTarget(await searchParams);

  if (target === null) {
    return (
      <div>
        <ContentHero breadcrumb={messages.pendingReceipt.breadcrumb} title={t.invalidTitle} />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-10 pb-16 md:pb-20">
          <p className="text-muted-foreground">{t.invalidBody}</p>
          <div>
            <ButtonLink href="/account/bookings">{messages.booking.list.menuLink}</ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ContentHero breadcrumb={messages.pendingReceipt.breadcrumb} title={t.title} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-10 pb-16 md:pb-20">
        <p className="text-muted-foreground">{t.body}</p>
        <div>
          <AppReturnRedirect href={target} />
        </div>
      </div>
    </div>
  );
}
