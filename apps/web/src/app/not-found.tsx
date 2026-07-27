import { resilience } from '@tourism/i18n';
import Link from 'next/link';
import { NotFoundBody } from '@/components/feedback/not-found-body';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { SiteChrome } from '@/components/site-chrome';
import { TopoPattern } from '@/components/topo-pattern';

// 404 là trang utility khách THẬT SỰ nhìn thấy nên làm hẳn màn ảnh (mẫu
// Intrepid): ảnh nền + scrim + câu ấm + đường thoát. Ảnh dùng placeholder
// (chính sách toàn site — task 3c mục 0); file ảnh thật + credit vẫn giữ
// trong public/mock/CREDITS.md chờ lúc chốt trang thay lại.
//
// Nút dùng thẻ <Link> bo tròn tự style theo idiom của site (home/call-to-action,
// contact/contact-cta) chứ không dùng Button của @tourism/ui: Button là Base UI,
// không có asChild, và cả site đang dựng CTA bằng pill như thế này.
const PILL_PRIMARY =
  'inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80';
const PILL_OUTLINE =
  'inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted';

export default function NotFound() {
  const t = resilience.notFound;

  return (
    <SiteChrome>
      <section className="dark relative flex min-h-[80vh] w-full items-center overflow-hidden px-4 py-32 text-foreground md:px-16 lg:px-24 xl:px-32">
        <ImagePlaceholder
          corner
          label="404 — Ha Long Bay panorama"
          className="absolute inset-0 -z-20 h-full w-full"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/85 to-background/60"
        />
        <TopoPattern className="bg-primary opacity-[0.10]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          {/* on-media chứ không phải primary: jade trên ảnh vịnh (cũng xanh)
              chỉ đạt tương phản 1.96 — đo bằng pixel, dưới ngưỡng WCAG 3:1.
              Nét jade của brand đã có ở nút chính bên dưới. */}
          <p className="font-mono text-xs tracking-widest text-on-media/80 uppercase">Error 404</p>
          <h1 className="mt-5 max-w-2xl font-heading text-4xl leading-tight font-medium text-balance md:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-md text-pretty text-muted-foreground">{t.body}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={PILL_PRIMARY}>
              {t.home}
            </Link>
            <Link href="/#tours" className={PILL_OUTLINE}>
              {t.tours}
            </Link>
            <Link href="/blog" className={PILL_OUTLINE}>
              {t.blog}
            </Link>
          </div>
        </div>
      </section>

      <NotFoundBody />
    </SiteChrome>
  );
}
