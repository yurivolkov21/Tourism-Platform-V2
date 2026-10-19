'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import type { ConciergeMessage } from './use-concierge';

export type EnquiryPart = Extract<
  ConciergeMessage['parts'][number],
  { type: 'tool-submitEnquiry' }
>;

/**
 * Thẻ xác nhận trước khi trợ lý gửi enquiry thay khách (spec §2c). Model chỉ đề xuất;
 * enquiry chỉ được tạo khi khách bấm Send. Tên tour lấy từ `approval.requestReason`: API
 * tra slug ra tour đang bán ngay lúc dựng thẻ, nên khách thấy đúng tour sẽ được gắn.
 */
export function EnquiryConfirmCard({
  part,
  disabled,
  onRespond,
}: {
  part: EnquiryPart;
  /** Khoá hai nút khi còn lượt đang chạy. */
  disabled: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const t = messages.chatBot.confirm;
  const input = part.input;
  if (input === undefined) return null;

  const rows: Array<[string, string | number | undefined]> = [
    [t.name, input.name],
    [t.email, input.email],
    [t.tour, part.approval?.requestReason],
    [t.travelDate, input.travelDate],
    [t.groupSize, input.groupSize],
  ];

  return (
    <section
      aria-label={t.title}
      className="rounded-xl border bg-card p-3 text-sm text-card-foreground"
    >
      <p className="font-medium">{t.title}</p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rows.map(([label, value]) =>
          value === undefined || value === '' ? null : (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="wrap-break-word">{value}</dd>
            </div>
          ),
        )}
      </dl>
      {input.message ? (
        <div className="mt-2">
          <p className="text-muted-foreground">{t.message}</p>
          <p className="mt-0.5 whitespace-pre-line wrap-break-word">{input.message}</p>
        </div>
      ) : null}
      <EnquiryStatus part={part} disabled={disabled} onRespond={onRespond} />
    </section>
  );
}

function EnquiryStatus({
  part,
  disabled,
  onRespond,
}: {
  part: EnquiryPart;
  disabled: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const t = messages.chatBot.confirm;
  switch (part.state) {
    case 'approval-requested':
      return (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={disabled} onClick={() => onRespond(part.approval.id, true)}>
            {t.send}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onRespond(part.approval.id, false)}
          >
            {t.cancel}
          </Button>
        </div>
      );
    case 'approval-responded':
      return (
        <p className="mt-3 text-muted-foreground">
          {part.approval.approved ? t.sending : t.cancelled}
        </p>
      );
    case 'output-available':
      return (
        <p className="mt-3 text-muted-foreground">{part.output.sent ? t.sent : t.cancelled}</p>
      );
    case 'output-denied':
      return <p className="mt-3 text-muted-foreground">{t.cancelled}</p>;
    case 'output-error':
      return <p className="mt-3 text-destructive-emphasis">{messages.chatBot.error}</p>;
    default:
      return null;
  }
}
