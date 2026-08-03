import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentHero } from '@/components/content/content-hero';
import { UnsubscribePanel } from '@/components/newsletter/unsubscribe-panel';
import { api } from '@/lib/api/client';
import { settle } from '@/lib/api/resilience';
import { parseUnsubscribeParams } from '@/lib/unsubscribe';

// Trang MỚI `/newsletter/unsubscribe?id=&token=` (spec §4) — ĐI VÀO TỪ LINK
// TRONG EMAIL, KHÁC hẳn các trang catalogue ISR (blog/tours/destinations):
// nội dung phụ thuộc `id`/`token` per-khách trong query string, không có gì
// chung để cache/tag/revalidate theo lịch — mỗi lượt xem là một token khác
// nhau. Đọc `searchParams` tự đưa route vào dynamic rendering (Next App
// Router); KHÔNG khai `export const revalidate` như các trang catalogue.
// KHÔNG vào sitemap (utility route per-token, không có giá trị index — cùng
// lý do các trang auth bị loại khỏi `lib/sitemap.ts`).
export const metadata: Metadata = {
  title: `${messages.unsubscribePage.title} — Tourism`,
  description: messages.unsubscribePage.subtitle,
  robots: { index: false },
};

function InvalidTokenPanel() {
  const t = messages.unsubscribePage.invalidToken;
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center shadow-(--shadow-card) md:p-9">
      <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
        {t.heading}
      </h2>
      <p className="mt-3 text-pretty text-muted-foreground">{t.body}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        {t.homeLink}
      </Link>
    </div>
  );
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  // Thiếu param hoặc `id` không phải uuid → panel lỗi token luôn, KHỎI gọi
  // API — link hỏng không xứng một round-trip.
  const params = parseUnsubscribeParams(await searchParams);

  // GET `unsubscribeConfirm` KHÔNG có side effect theo contract (an toàn cho
  // email client prefetch link trong hộp thư) — nhưng vẫn CHỈ gọi khi param
  // hợp lệ, đúng nguyên tắc "đường link hỏng thì đừng đụng API".
  //
  // Fetch KHÔNG truyền `context.next` (khác các trang catalogue luôn kèm
  // `{revalidate, tags}`) → `OpenAPILink` không gắn cờ cache/tag nào cho
  // request này. Next 16 (xem apps/web/package.json) mặc định KHÔNG cache
  // fetch khi không có chỉ định cache tường minh — đúng ý "mutation-adjacent
  // read, không cache" mà không cần thêm cấu hình gì thêm.
  const confirmRes = params
    ? await settle(api.newsletter.unsubscribeConfirm({ id: params.id, token: params.token }))
    : null;

  // Token hỏng/thiếu param HOẶC `settle` fail đều dẫn về CÙNG một panel lỗi
  // thân thiện — KHÔNG 404, KHÔNG throw. `settle` gom MỌI exception (kể cả
  // lỗi định danh contract `INVALID_UNSUBSCRIBE_TOKEN`, phát hiện được bằng
  // `isDefinedError` từ `@orpc/client` nếu cần soi riêng) lẫn lỗi mạng/5xx
  // khác vào cùng `{ok:false}` — ở đây không cần tách hai loại vì UI xử lý
  // giống hệt nhau cho cả hai: người bấm link email cũ xứng đáng một lời
  // giải thích, không phải một trang trắng.
  if (!params || !confirmRes?.ok) {
    return (
      <>
        <ContentHero
          breadcrumb={messages.unsubscribePage.breadcrumbCurrent}
          title={messages.unsubscribePage.title}
        />
        <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
          <InvalidTokenPanel />
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHero
        breadcrumb={messages.unsubscribePage.breadcrumbCurrent}
        title={messages.unsubscribePage.title}
        subtitle={messages.unsubscribePage.subtitle}
      />
      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-md">
          <UnsubscribePanel
            id={params.id}
            token={params.token}
            email={confirmRes.data.email}
            alreadyUnsubscribed={confirmRes.data.alreadyUnsubscribed}
          />
        </div>
      </div>
    </>
  );
}
