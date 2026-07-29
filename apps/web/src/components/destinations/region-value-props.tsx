import { messages } from '@tourism/i18n';
import { ListChecksIcon, type LucideIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';

/** Icon theo THỨ TỰ mục: nhóm nhỏ · hướng dẫn bản địa · minh bạch bao gồm gì.
    KHÁC bộ `CarIcon`/`RouteIcon`/`UtensilsCrossedIcon` của Nexora vì nội dung đã
    được viết lại — bản Nexora hứa "luxury transfers" và bữa ăn, thứ mà mock ở đây
    không có field nào đỡ. */
const ICONS: readonly LucideIcon[] = [UsersIcon, MapPinIcon, ListChecksIcon];

/**
 * Khu CUỐI trang vùng — "We've got you covered", băng tối đóng khung trang, đối
 * xứng với hero đã mở đầu.
 *
 * Nền là `dark` + `bg-background` — ĐÚNG công thức `site-footer.tsx` dùng, và đó
 * là chủ đích chứ không phải trùng hợp: footer luôn giải ra L 0.25 ở CẢ hai
 * theme, nên băng này phải bám đúng giá trị ấy thì mối nối mới liền. Dùng
 * `bg-hero` sẽ đúng ở light (0.25 = 0.25) nhưng ở dark hero tụt xuống 0.17 trong
 * khi footer vẫn 0.25 — sinh một MỐI NỐI mới ΔL 0.08 ngay chỗ mà
 * `data-flush-footer` sinh ra để xoá. Đo: `text-on-media` trên nền này 15.09:1 ở
 * cả hai theme.
 *
 * ⚠️ `data-flush-footer` nằm trên `<section>` này và đó là NỬA THỨ HAI của một cơ
 * chế hai nửa; nửa kia là luật `body:has(main [data-flush-footer]) footer` ở cuối
 * `apps/web/src/app/globals.css`. Nó tắt `mt-32` của footer cho RIÊNG trang này,
 * vì 128px margin ấy sơn màu `--background` và ở đây nó thành một dải sáng kẹp
 * giữa băng tối này với footer tối. Gỡ thuộc tính này thì dải trắng quay lại IM
 * LẶNG — Vitest không quét layout, jsdom không dựng `:has()`. Kiểm bằng mắt.
 *
 * Cùng cảnh báo với `region-hero.tsx`: băng tối ở CẢ HAI theme nên chữ dùng
 * `text-on-media` (token cố định), KHÔNG `text-foreground`.
 */
export function RegionValueProps() {
  const t = messages.regionPage;

  return (
    <section
      data-flush-footer
      className="dark w-full bg-background px-4 py-20 text-on-media md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          {/* `tone="onMedia"` — cặp token CỐ ĐỊNH, đúng thứ một bề mặt tối-ở-cả-
              hai-theme cần. (Scope `dark` của section cũng đã ghim mặc định
              `bg-foreground`/`text-foreground` về bảng tối nên mặc định không
              còn hỏng như trước; vẫn khai tường minh để ai gỡ class `dark` đi
              cũng không làm eyebrow tối-trên-tối trở lại.)
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
