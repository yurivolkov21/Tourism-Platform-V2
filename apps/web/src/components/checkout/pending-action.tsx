import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { BookingActions } from '@/components/account/booking-actions';
import { CheckoutAutoRefresh } from '@/components/checkout/checkout-auto-refresh';
import { CopyCodeButton } from '@/components/checkout/copy-code-button';
import type { BookingView } from '@/lib/booking-vm';
import type { PendingAction as PendingActionView } from '@/lib/pending-receipt';

/**
 * Ô mã của đơn chưa trả: nhãn nói rõ CHƯA là voucher khi đơn còn mở, mã, nút chép. Viền đứt theo
 * bản vẽ A user duyệt 13/10 (cùng ngôn ngữ vé của trang chi tiết đơn, duyệt 05/10). Mã không bẻ dòng
 * — cùng luật `VoucherCode`: thiếu chỗ thì nút chép xuống hàng.
 */
export function PendingCode({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      data-slot="pending-code"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border-[1.5px] border-dashed bg-card px-3 py-2.5',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1.5 font-mono text-xl font-semibold tracking-[0.1em] whitespace-nowrap">
          {code}
        </p>
      </div>
      <div className="shrink-0">
        <CopyCodeButton code={code} />
      </div>
    </div>
  );
}

/** Bảng quyết định cho `BookingActions`: chỉ nút Pay now — huỷ giữ chỗ vẫn ở trang chi tiết đơn. */
const PAY_NOW_ONLY: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['payNow'] };

/**
 * Hành động chính của thẻ, theo `pendingView`:
 *
 * - Pay now — `BookingActions` có sẵn của trang chi tiết đơn (cùng lời gọi `bookings.checkout`, cùng
 *   xử lý lỗi), không viết lại đường thanh toán.
 * - "Checking with {cổng}…" và Refresh — khách về trước webhook. `autoRefresh` bật bộ hẹn giờ
 *   `router.refresh()`; chỉ MỘT bản trên trang được bật (xem `CheckoutAutoRefresh`).
 * - Book again — sang trang tour chọn ngày mới.
 *
 * `compact`: bản ô gọn của cột trái — nút theo bề ngang nội dung từ `sm`; bản cột phải trải hết cột.
 */
export function PendingAction({
  booking,
  action,
  autoRefresh = false,
  compact = false,
}: {
  booking: Pick<BookingDetail, 'code'>;
  action: PendingActionView;
  autoRefresh?: boolean;
  compact?: boolean;
}) {
  switch (action.kind) {
    case 'payNow':
      return (
        // Nút nằm trong `BookingActions` (không nhận lớp) — cỡ nút đặt từ ngoài, như nút của voucher.
        <div
          data-slot="pending-action"
          className={cn(
            '[&_button]:h-11 [&_button]:w-full',
            compact && 'sm:[&_button]:w-auto sm:[&_button]:px-6',
          )}
        >
          <BookingActions view={PAY_NOW_ONLY} code={booking.code} />
        </div>
      );
    case 'refresh':
      return (
        <div
          data-slot="pending-action"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          <p className="text-sm font-medium">{action.checking}</p>
          <CheckoutAutoRefresh auto={autoRefresh} />
        </div>
      );
    case 'bookAgain':
      return (
        <ButtonLink
          href={action.href}
          className={cn('h-11 w-full', compact && 'sm:w-auto sm:px-6')}
        >
          {messages.printDoc.receipt.bookAgain}
        </ButtonLink>
      );
  }
}
