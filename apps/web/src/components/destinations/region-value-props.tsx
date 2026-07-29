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
 * Nền là `dark` + **`bg-muted`** (đổi 29/07 từ `bg-background`).
 *
 * Bản trước bám đúng giá trị của `site-footer.tsx` để mối nối liền tuyệt đối —
 * và đó chính là lỗi: user nhìn ra ngay. Đo được ba vế, cả hai theme:
 *
 *  | nền băng          | ΔL vs nền trang | ΔL vs footer |
 *  | `bg-background`   | light −0.9167 · **dark 0.0000** | **0.0000** |
 *  | `bg-muted` (nay)  | +0.0350 | +0.0350 |
 *
 * Tức ở dark mode băng cũ KHÔNG tách khỏi bất cứ thứ gì — nền trang, băng và
 * footer đều `rgb(26,36,34)`, cả đáy trang thành một khối phẳng; còn ở light thì
 * nó trùng khít footer nên người đọc tưởng đã vào footer rồi. Tối ưu "mối nối
 * liền" là tối ưu ngược hướng: khu này CẦN được nhận ra là một tấm riêng.
 *
 * `bg-muted` tách rõ nhất trong ba ứng viên đo được — gấp 2,4× `bg-card`
 * (+0.0145) và 3,2× `bg-hero` (−0.0109). KHÔNG chọn `bg-hero` dù nó cũng tách:
 * nó biến băng thành thứ tối nhất trang rồi footer lại sáng lên, bậc sáng đọc
 * ngược. Cả ba ứng viên đều **bất biến theo theme** (giải trong scope `dark`)
 * nên sửa một lần đúng cả hai chế độ.
 *
 * Đo lại sau khi đổi: `text-on-media` trên nền này 9.86:1 (h2) và 6.15:1 (chữ
 * thường) — vẫn vượt xa AA, ở cả hai theme.
 *
 * ⚠️ Đổi nền ở đây KHÔNG được đụng `data-flush-footer` bên dưới: khoảng hở 128px
 * vẫn phải tắt. Thứ ta muốn là một BƯỚC MÀU giữa băng và footer, không phải một
 * dải nền trang chen vào giữa.
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
      className="dark w-full bg-muted px-4 py-20 text-on-media md:px-16 md:py-24 lg:px-24 xl:px-32"
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
