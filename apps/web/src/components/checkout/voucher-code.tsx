import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { CopyCodeButton } from '@/components/checkout/copy-code-button';

/**
 * Ô mã đơn của voucher (spec P7 §6.3–6.4) — MỘT linh kiện cho hai chỗ: ô gọn ngay dưới tiêu
 * đề khi thẻ một cột (`VoucherOverview`) và ô đầu mảng teal khi thẻ hai cột (`VoucherPass`).
 * Chỗ gọi chọn bản nào hiện bằng class responsive truyền qua `className` (mốc `xl`).
 *
 * Nút chép giấu khi in: bấm vào giấy thì không được (spec §6.4).
 */
export function VoucherCode({ code, className }: { code: string; className?: string }) {
  return (
    <div
      data-slot="voucher-code"
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2.5',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
          {messages.voucher.codeLabel}
        </p>
        <p className="mt-1.5 font-mono text-xl font-semibold tracking-[0.1em]">{code}</p>
      </div>
      <div className="shrink-0 print:hidden">
        <CopyCodeButton code={code} />
      </div>
    </div>
  );
}

/**
 * Dải thay ô mã khi đơn đã huỷ (spec §2.6): voucher hết hiệu lực nên không còn mã nào để chìa
 * ra, và mã vạch — thứ nói "quét tôi ở cổng" — cũng không được vẽ.
 */
export function VoucherCancelledNotice({ text, className }: { text: string; className?: string }) {
  return (
    <p
      data-slot="voucher-cancelled"
      className={cn(
        'rounded-xl border border-dashed border-muted-foreground bg-muted px-3 py-2.5 text-sm font-medium',
        className,
      )}
    >
      {text}
    </p>
  );
}
