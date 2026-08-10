import type { ReactNode } from 'react';

/**
 * LƯỚI DUY NHẤT của khu account. Mọi mục ở cả năm màn đi qua đây, không màn nào
 * tự khai lưới riêng — đó là cách duy nhất bảo đảm bốn trang thẳng lề nhau.
 *
 * Cả khu chỉ có BA toạ độ x (đo ở 1440px, container `max-w-7xl` + `xl:px-32`
 * cho W = 1184):
 *
 *   x=128   mép trái container = H1 = tiêu đề mục = nhãn tab đầu = đầu kẻ tầng A
 *   x=536   mép trái cột phải  = đầu mọi dòng dữ liệu = đầu kẻ tầng B
 *   x=1312  mép phải container = mép phải MỌI giá trị và MỌI nút hành động
 *
 * Không có máng, không có ray, không có thụt lề. Bản thiết kế trước bị bác đúng
 * vì nó đẻ ra toạ độ thứ tư (chữ nav thụt 32px, ray dọc ở x=10).
 *
 * `lg:grid-cols-3` + `gap-x-10` chính là lưới 12 cột span-4/span-8 gap-40 mà
 * `site-footer.tsx` và `testimonials.tsx` đã dùng, viết gọn lại: với 12 cột
 * gap g, span-4 = 4·(T−11g)/12 + 3g = (T−2g)/3 — đúng bề rộng một cột của
 * `grid-cols-3 gap-10`. Kiểm được: W 1184 → (1184−80)/3 = 368 = cột trái.
 */

/**
 * Bọc các mục của một màn. Trước đây dùng `divide-y` để kẻ hairline ngăn mục;
 * từ 11/08 việc ngăn cách do CARD ở cột phải đảm nhiệm, nên chỉ còn khoảng
 * thở dọc.
 */
export function AccountSections({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

/**
 * Một mục: cột trái là tiêu đề + một dòng mô tả (giọng nói), cột phải là card
 * chứa nội dung thật (dữ liệu). Hai họ chữ đứng ở hai cột và không lẫn sang nhau.
 *
 * Nhịp dọc: mục cách mục 24px (`gap-6` ở `AccountSections`), cột trái `lg:py-6`
 * để tiêu đề ngang tầm dòng đầu trong card. Trước 11/08 nhịp là `py-12` cộng
 * hairline ngăn mục; nay card tự ngăn nên không cần cả hai.
 */
export function AccountSection({
  title,
  description,
  meta,
  id,
  children,
}: {
  title: string;
  /** Luôn truyền. Mục im lặng cạnh mục đang nói đọc như lỗi tải, không như chủ ý. */
  description: string;
  /** Dòng số liệu tuỳ chọn dưới mô tả (vd "3 trips"). Mono để nó đọc như dữ
   *  liệu chứ không như câu văn tiếp theo của mô tả. */
  meta?: ReactNode;
  /** Id DOM tuỳ chọn — đích cho anchor `#id` từ trang khác (Task 7: `TripCard`
   *  row trỏ `/account/bookings/{code}#review` vào mục review). KHÁC
   *  `headingId` bên dưới (id của riêng thẻ `h2`, dùng cho `aria-labelledby`) —
   *  đây là id của cả `<section>` để trình duyệt cuộn tới đúng khối. */
  id?: string;
  children: ReactNode;
}) {
  // `<section>` chỉ được ánh xạ thành role `region` khi nó CÓ TÊN. Trỏ
  // `aria-labelledby` vào chính h2 của mục: trình đọc màn hình nhảy được giữa
  // các mục thay vì phải cuộn tuần tự, và test khoanh được đúng một mục thay
  // vì quét cả trang. Id suy ra từ tiêu đề nên không cần `useId` (component
  // này chạy phía server); tiêu đề là duy nhất trong một trang.
  const headingId = `account-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <section id={id} aria-labelledby={headingId} className="grid gap-x-10 gap-y-4 lg:grid-cols-3">
      <div className="lg:py-6">
        <h2 id={headingId} className="font-heading text-lg font-medium text-foreground">
          {title}
        </h2>
        {/* `leading-relaxed` cho cột trái đọc như văn xuôi; cột phải giữ nhịp
            dòng mặc định để đọc như dữ liệu. Cùng cỡ 14px, hai tốc độ đọc. */}
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {meta ? (
          <p className="mt-3 font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
            {meta}
          </p>
        ) : null}
      </div>
      {/* CARD ở cột phải — chốt 11/08 thay hairline ngăn mục.
          Mép card rơi ĐÚNG hai toạ độ đã có: trái x=536, phải x=1312. Nên card
          không đẻ toạ độ mới ở hai mép ngoài; chỉ nội dung bên trong thụt vào
          đúng `px-6` của card, giống hệt cách mọi card trên site hành xử và
          giống ô nội dung bên phải của mẫu Airbnb.
          `rounded-2xl border bg-card` là thành ngữ card sẵn có của site (16
          chỗ dùng) — không phát minh kiểu card thứ hai.
          `self-start`: ô lưới mặc định giãn cho bằng ô cao nhất trong hàng, nên
          một card một dòng đứng cạnh cột mô tả ba dòng sẽ phình ra và chừa một
          mảng trống dưới nội dung. Card phải ôm sát nội dung của nó. */}
      <div className="min-w-0 self-start rounded-2xl border bg-card px-6 lg:col-span-2">
        {children}
      </div>
    </section>
  );
}

/**
 * Bọc các dòng dữ liệu TRONG cột phải. Kẻ tầng B — chỉ rộng bằng cột phải
 * (776px ở 1440), vĩnh viễn không dùng chung toạ độ x với kẻ tầng A của
 * `AccountSections` (1184px). Một đường kẻ trong khu này hoặc rộng đúng bề rộng
 * container, hoặc đúng bề rộng cột phải. Không có giá trị thứ ba.
 */
export function AccountRows({ children }: { children: ReactNode }) {
  return <ul className="divide-y">{children}</ul>;
}

/**
 * Một dòng dữ liệu: nhãn (+ dòng phụ) bên trái, giá trị hoặc hành động bám ĐÚNG
 * mép phải container. Khuôn lấy từ mẫu Airbnb "Personal info" — cột nội dung
 * của họ rộng ~780px, cột phải ở đây 776px, nên nhịp đọc gần như y hệt.
 *
 * Dùng `justify-between` chứ KHÔNG cột phải cố định (`w-24 text-right`): cột cố
 * định làm "$980" và "$1,240" lệch mép nhau. Giá trị bằng số nên thêm
 * `tabular-nums` để chữ số dóng dọc giữa các dòng.
 */
export function AccountRow({
  label,
  sub,
  children,
}: {
  label: ReactNode;
  sub?: ReactNode;
  /** Phần bám mép phải: giá trị, hoặc một link hành động. */
  children?: ReactNode;
}) {
  return (
    <li className="flex items-baseline justify-between gap-6 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {sub ? <div className="mt-0.5 text-sm text-muted-foreground">{sub}</div> : null}
      </div>
      {children ? <div className="shrink-0 text-right text-sm">{children}</div> : null}
    </li>
  );
}
