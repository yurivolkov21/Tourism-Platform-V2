import { messages } from '@tourism/i18n';
import { LOGO_MARK } from '@/components/logo';

/**
 * Logo, wordmark và dòng liên hệ của đầu trang in trên ảnh bìa (G40, spec §2.2). Nằm trong scope
 * `dark` mà `DocLetterhead` tông `photo` gắn: viên sau và chữ "ora" theo `primary-emphasis` — ở scope
 * ấy là teal nhạt; viên trước, wordmark trắng `on-media`; dòng liên hệ chỉ còn website.
 */
export function PrintBrand() {
  return (
    <div data-slot="print-brand" className="flex items-center gap-[3mm]">
      <svg viewBox={LOGO_MARK.viewBox} aria-hidden="true" className="h-auto w-[11mm] shrink-0">
        <path className="fill-primary-emphasis" d={LOGO_MARK.back} />
        <path className="fill-on-media" d={LOGO_MARK.front} />
      </svg>
      <div>
        <p className="font-heading text-[17pt] leading-none font-semibold tracking-[-0.01em] text-on-media">
          Nex<span className="text-primary-emphasis">ora</span>
        </p>
        <p className="mt-[1.2mm] text-[7.5pt] text-on-media/80">{messages.printDoc.website}</p>
      </div>
    </div>
  );
}
