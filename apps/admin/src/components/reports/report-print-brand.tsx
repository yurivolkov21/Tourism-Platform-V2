import { messages } from '@tourism/i18n';
import { LOGO_MARK } from '@/components/logo';

/**
 * Logo, wordmark và dòng liên hệ của đầu trang báo cáo in (G40 Phần 2, spec §2.2) — giọng nội bộ trên
 * giấy (ADR-0057 §3): viên sau `primary`, viên trước và wordmark màu mực, "ora" `primary-emphasis`
 * như bản thảo C2; dòng liên hệ "Back office · {website}".
 */
export function ReportPrintBrand() {
  return (
    <div data-slot="print-brand" className="flex items-center gap-[3mm]">
      <svg viewBox={LOGO_MARK.viewBox} aria-hidden="true" className="h-auto w-[11mm] shrink-0">
        <path className="fill-primary" d={LOGO_MARK.back} />
        <path className="fill-foreground" d={LOGO_MARK.front} />
      </svg>
      <div>
        <p className="font-heading text-[17pt] leading-none font-semibold tracking-[-0.01em]">
          Nex<span className="text-primary-emphasis">ora</span>
        </p>
        <p className="mt-[1.2mm] text-[7.5pt] tracking-[0.02em] text-muted-foreground">
          {messages.admin.reports.printDoc.contact(messages.printDoc.website)}
        </p>
      </div>
    </div>
  );
}
