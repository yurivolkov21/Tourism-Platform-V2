import { messages } from '@tourism/i18n';
import { ListChecksIcon, type LucideIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';

/** Icon theo THỨ TỰ mục: nhóm nhỏ · hướng dẫn bản địa · minh bạch bao gồm gì.
    KHÁC bộ `CarIcon`/`RouteIcon`/`UtensilsCrossedIcon` của Nexora vì nội dung đã
    được viết lại — bản Nexora hứa "luxury transfers" và bữa ăn, thứ mà mock ở đây
    không có field nào đỡ. */
const ICONS: readonly LucideIcon[] = [UsersIcon, MapPinIcon, ListChecksIcon];

/**
 * Khu CUỐI trang vùng — "We've got you covered", băng trên nền `--region-hero`,
 * đóng khung trang bằng đúng màu vùng đã mở đầu ở hero.
 *
 * ⚠️ `data-flush-footer` nằm trên `<section>` này và đó là NỬA THỨ HAI của một cơ
 * chế hai nửa; nửa kia là luật `body:has(main [data-flush-footer]) footer` ở cuối
 * `apps/web/src/app/globals.css`. Nó tắt `mt-32` của footer cho RIÊNG trang này,
 * vì 128px margin ấy sơn màu `--background` và ở đây nó thành một dải sáng kẹp
 * giữa băng tối này với footer tối. Gỡ thuộc tính này thì dải trắng quay lại IM
 * LẶNG — Vitest không quét layout, jsdom không dựng `:has()`. Kiểm bằng mắt.
 *
 * Cùng cảnh báo với `region-hero.tsx`: băng tối ở CẢ HAI theme nên chữ dùng
 * `text-on-media`, KHÔNG `text-foreground`, và KHÔNG bọc class `dark`.
 */
export function RegionValueProps() {
  const t = messages.regionPage;

  return (
    <section
      data-flush-footer
      style={{ background: 'var(--region-hero)' }}
      className="w-full px-4 py-20 text-on-media md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          {/* `tone="onMedia"` là BẮT BUỘC ở đây: mặc định của `SectionEyebrow` là
              cặp `bg-foreground`/`text-foreground` — token LẬT theo theme — còn nền
              băng này là `--region-hero`, tối CỐ ĐỊNH ở cả hai theme. Để mặc định
              thì ở light mode chữ eyebrow thành tối-trên-tối, gần như vô hình.
              Eyebrow là một hàng flex chiếm trọn bề ngang nên `text-center` không
              kéo nó vào giữa được — phải bọc `flex justify-center`. */}
          <div className="flex justify-center">
            <SectionEyebrow tone="onMedia">{t.valuePropsEyebrow}</SectionEyebrow>
          </div>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance md:text-[40px]/12">
            {t.valuePropsHeading}
          </h2>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {t.valueProps.map((prop, i) => {
            const Icon = ICONS[i] ?? UsersIcon;
            return (
              <div key={prop.title} className="flex flex-col items-center gap-3 text-center">
                <span className="flex size-12 items-center justify-center rounded-full border border-on-media/25 bg-on-media/10">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="font-heading text-lg font-medium">{prop.title}</h3>
                <p className="text-pretty text-on-media/80">{prop.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
