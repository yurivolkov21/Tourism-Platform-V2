import { messages } from '@tourism/i18n';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';

/**
 * Khối "Plan your trip" cuối trang nội dung (sổ nợ E1, spec 25/07 của cụm pháp lý). Copy
 * port nguyên từ Nexora ở `messages.enquiryCta`; trang gọi truyền biến thể tiêu đề của
 * mình (`headings.faq`, …) để cùng một khối không đọc y hệt nhau ở mọi nơi.
 *
 * Là MỘT THẺ trong cột nội dung, không phải băng full-bleed sát footer: CTA bỏ ở
 * `/destinations` 28/07 vì vài dòng chữ căn giữa trên nền `bg-muted/30` tạo hai dải màu
 * ngay trên footer, đọc rời rạc. Thẻ dùng lại da panel "What happens next" của form liên
 * hệ trang chủ (gradient primary → `--region-deep`, eyebrow màu spark) cho cùng một giọng.
 *
 * CTA sang `/contact`, trang enquiry có thật và chạy được cả khi trợ lý chat đang tắt;
 * nút nổi "Plan your trip" ở góc màn hình vẫn là lối vào chat. Phần form ba ô của
 * `enquiryCta.form` không dựng ở đây: `/contact` đã là form đầy đủ.
 */
export function EnquiryCta({ heading }: { heading: string }) {
  const t = messages.enquiryCta;
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl bg-linear-to-b from-primary to-(--region-deep) p-8 text-primary-foreground sm:p-10"
    >
      <span className="text-xs font-semibold tracking-[0.2em] text-(--region-spark) uppercase">
        {t.heading}
      </span>
      <h2
        id={headingId}
        className="mt-3 font-heading text-2xl leading-snug font-medium md:text-3xl"
      >
        {heading}
      </h2>
      <p className="mt-3 max-w-xl text-pretty text-primary-foreground/80">{t.subtitle}</p>

      <ul className="mt-6 flex flex-col gap-2.5 text-sm">
        {t.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2.5">
            <CheckIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-(--region-spark)"
            />
            {benefit}
          </li>
        ))}
      </ul>

      {/* Nút đảo màu trên nền primary — cùng dáng pill chữ hoa của nút gửi form liên hệ. */}
      <Link
        href="/contact"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-6 py-3.5 text-xs font-medium tracking-wide text-primary uppercase transition-colors duration-200 outline-none hover:bg-primary-foreground/90 focus-visible:ring-3 focus-visible:ring-primary-foreground/50"
      >
        {t.cta}
        <ArrowRightIcon aria-hidden="true" className="size-3.5" />
      </Link>
    </section>
  );
}
