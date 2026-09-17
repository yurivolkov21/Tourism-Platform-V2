'use client';

import { ORPCError } from '@orpc/client';
import type { BookingCancellation } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@tourism/ui/components/alert-dialog';
import { Button } from '@tourism/ui/components/button';
import { Label } from '@tourism/ui/components/label';
import { Textarea } from '@tourism/ui/components/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { api, withBrowserAuth } from '@/lib/api/client';
import { classifySubmitError } from '@/lib/api/submit';
import type { BookingAction, BookingView } from '@/lib/booking-vm';
import { isCheckoutUrl } from '@/lib/checkout-url';
import { formatChipDate, formatDateRange, formatMoneyExact } from '@/lib/tours';

/** Trần `reason` của contract (`CancelBookingInputSchema.max(1000)`). */
const REASON_MAX = 1000;

/**
 * Phân loại lỗi hành động. 401 giữa chừng (session hết hạn khi đang thao tác)
 * có UI RIÊNG — message + link đăng nhập lại, KHÔNG auto-signout — tách khỏi
 * `classifySubmitError` (chỉ phân throttle/lỗi chung, không biết về 401).
 *
 * Khớp theo `code` của lỗi contract chứ không theo status: 422 của
 * `bookings.checkout` là `NOT_PENDING` còn 422 của `bookings.cancel` là
 * `NOT_CANCELLABLE` — cùng status, hai chuyện khác nhau (cùng khuôn
 * `bookingSubmitErrorCopy` ở `booking-form.ts`).
 */
type ActionErrorKind =
  | 'sessionExpired'
  | 'throttle'
  | 'refundFailed'
  | 'refundChanged'
  | 'notCancellable'
  | 'bookingClosed'
  | 'generic';

function classifyActionError(error: unknown): ActionErrorKind {
  if (error instanceof ORPCError) {
    if (error.status === 401) return 'sessionExpired';
    if (error.code === 'REFUND_FAILED') return 'refundFailed';
    if (error.code === 'REFUND_AMOUNT_CHANGED') return 'refundChanged';
    if (error.code === 'NOT_CANCELLABLE') return 'notCancellable';
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return 'bookingClosed';
  }
  return classifySubmitError(error) === 'throttle' ? 'throttle' : 'generic';
}

/** Copy tương ứng cho từng loại lỗi KHÔNG phải session (session có UI riêng). */
function errorCopy(kind: ActionErrorKind): string {
  const e = messages.accountActionErrors;
  switch (kind) {
    case 'throttle':
      return e.throttle;
    case 'refundFailed':
      return e.refundFailed;
    case 'refundChanged':
      return e.refundChanged;
    case 'notCancellable':
      return e.notCancellable;
    case 'bookingClosed':
      return e.bookingClosed;
    default:
      return e.generic;
  }
}

/**
 * Link chính sách huỷ — đứng NGAY CẠNH nút huỷ cụ thể (chuẩn Booking.com:
 * policy gắn vào đúng hành động). Chỉ hai case có gì để huỷ (`cancelPending`,
 * `cancelBooking`) mới render nó.
 */
function PolicyLink() {
  return (
    <Link
      href="/cancellation-policy"
      className="text-sm text-primary-emphasis underline-offset-4 hover:underline"
    >
      {messages.accountBookingDetail.policyLink}
    </Link>
  );
}

/** Phần booking mà hộp xác nhận huỷ cần — cắt đúng chừng này, không nhận cả entity. */
export interface CancelDialogBooking {
  /** Mã + tên tour + đợt + số khách: người ta phải NHẬN RA thứ mình sắp huỷ. */
  code: string;
  tourTitle: string;
  /** Dựng link `/tours/{slug}/enquire` cho ca quá hạn (ngoại lệ, spec §3.4). */
  tourSlug: string;
  departureStartDate: string;
  departureEndDate: string;
  numAdults: number;
  numChildren: number;
  currency: string;
  /**
   * Cờ, ngày chót và số tiền SERVER tính lúc đọc (`bookings.byCode.cancellation`)
   * — client chỉ in, KHÔNG tự so ngày chót với giờ trình duyệt (ADR-0041 §7).
   * `null` = booking không ở trạng thái huỷ online; khi đó không có nút huỷ.
   */
  cancellation: BookingCancellation | null;
}

/**
 * Hộp xác nhận huỷ booking ĐÃ TRẢ TIỀN — hai dạng theo cờ `withinDeadline`
 * server trả (spec §5.3):
 *
 * - Trong hạn: số tiền hoàn nằm ngay trong câu hỏi và trên nút — đó là thứ
 *   người ta mở hộp này ra để biết.
 * - Quá hạn: nói thẳng không hoàn, kèm lối sang form hỏi đáp của tour cho ca
 *   đặc biệt (hoàn thiện chí do admin quyết, spec §3.4).
 *
 * Lý do KHÔNG bắt buộc: huỷ không còn qua hàng đợi duyệt nên không ai cần nó để
 * quyết. Ô trống (kể cả chỉ khoảng trắng) thì gửi `undefined` để input không
 * mang `reason`.
 *
 * `AlertDialogAction` CỐ Ý không tự đóng dialog (xem `alert-dialog.tsx`): lỗi
 * hiện ngay trong hộp và khách không mất chữ đã gõ.
 */
function CancelBookingDialog({
  booking,
  cancellation,
  pending,
  error,
  onSubmit,
}: {
  booking: CancelDialogBooking;
  cancellation: BookingCancellation;
  pending: boolean;
  /** Lỗi render BÊN TRONG dialog. Để ngoài thì nó nằm sau lớp modal: `getByText`
   *  vẫn thấy nhưng `getByRole` thì không, tức người dùng bàn phím và trình đọc
   *  màn hình KHÔNG với tới được — kể cả link "đăng nhập lại". */
  error?: ReactNode;
  onSubmit: (reason: string | undefined) => void;
}) {
  const t = messages.accountBookingDetail;
  const d = t.cancelDialog;
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const amount = formatMoneyExact(cancellation.refundAmount, booking.currency);
  const within = cancellation.withinDeadline;

  return (
    // Trigger + policy link đứng CHUNG một hàng — "gắn liền vào hành động".
    <div className="inline-flex flex-wrap items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger
          render={
            // Text-link chứ không phải Button nổi: huỷ là hành động phụ của
            // trang. `h-auto px-0` gỡ khung/đệm của size mặc định.
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-destructive-emphasis"
              disabled={pending}
            >
              {t.actions.cancel}
            </Button>
          }
        />
        {/* `max-h`+`overflow-y-auto`: `AlertDialogContent` neo `top-1/2` và KHÔNG
            có trần chiều cao — trên laptop màn thấp nội dung tràn ra hai đầu mà
            không cuộn được, tức mất luôn nút xác nhận. */}
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.actions.cancelConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Một chuỗi duy nhất (một text node) cho cả hai dạng. */}
              {within
                ? d.withinBody(amount)
                : `${messages.cancellationDeadline.passed(formatChipDate(cancellation.deadline))} ${d.afterBody}`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Viền chứ không nền để tách khối: dialog là `bg-popover`, và
              `--card`/`--popover` trong bộ token có thể trùng nhau. */}
          <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
            <p className="font-medium text-foreground">{booking.tourTitle}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
            </p>
            <p className="text-sm text-muted-foreground">
              {messages.accountBookings.travellers(booking.numAdults, booking.numChildren)}
            </p>
            <p className="pt-1 font-mono text-xs text-muted-foreground">{booking.code}</p>
          </div>

          {within ? null : (
            <Link
              href={`/tours/${booking.tourSlug}/enquire`}
              className="w-fit text-sm text-primary-emphasis underline-offset-4 hover:underline"
            >
              {d.afterContact}
            </Link>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="cancel-reason">{d.reasonLabel}</Label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {d.reasonCounter(trimmed.length)}
              </span>
            </div>
            <Textarea
              id="cancel-reason"
              rows={3}
              maxLength={REASON_MAX}
              placeholder={d.reasonPlaceholder}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          {error}

          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancelDismiss}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => onSubmit(trimmed.length > 0 ? trimmed : undefined)}
            >
              {pending ? d.submitting : within ? d.withinCta(amount) : d.afterCta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PolicyLink />
    </div>
  );
}

/**
 * Hành động trang `/account/bookings/[code]` — CHỈ render theo `view.actions`
 * (bảng quyết định `bookingView`), KHÔNG if/else theo status trong JSX.
 *
 * Hai đường gọi handler:
 * - `onAction` truyền tay (spec jsdom truyền `vi.fn()` để soi tham số, KHÔNG
 *   đụng API thật) — override, LUÔN ưu tiên nếu có.
 * - `code` mà KHÔNG có `onAction` → nút thật gọi thẳng oRPC qua client browser
 *   (`credentials: 'include'`, ADR-0017 §1). Đây là đường page (Server
 *   Component) dùng — nó không truyền được hàm client qua ranh giới RSC, nên
 *   truyền DỮ LIỆU (`code`, `booking`) để component tự dựng handler.
 * - Thiếu cả hai → bấm không làm gì, không throw.
 */
export function BookingActions({
  view,
  code,
  booking,
  onAction,
}: {
  view: BookingView;
  /** Mã booking — cần để hành động thật gọi đúng route. Optional vì spec
   *  jsdom truyền `onAction` giả lập, không cần mã thật. */
  code?: string;
  /** Dữ liệu cho hộp xác nhận huỷ booking đã trả; vắng thì không bày nút huỷ đó. */
  booking?: CancelDialogBooking;
  onAction?: (action: BookingAction, reason?: string) => void;
}) {
  const t = messages.accountBookingDetail;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<ActionErrorKind | null>(null);
  // Hành động nào vừa hỏng — cần biết để đặt thông báo ĐÚNG chỗ: lỗi của một
  // hành động trong dialog phải hiện trong dialog đó.
  const [errorAt, setErrorAt] = useState<BookingAction | null>(null);

  async function performAction(action: BookingAction, reason?: string) {
    if (!code || pending) return;
    setPending(true);
    setErrorKind(null);
    setErrorAt(null);
    try {
      switch (action) {
        case 'payNow': {
          const result = await api.bookings.checkout({ code }, { context: withBrowserAuth() });
          // isCheckoutUrl (W3-O4): URL không https (dev cho localhost) thì
          // coi như hỏng — không assign chuỗi lạ vào location.
          if (!result.checkoutUrl || !isCheckoutUrl(result.checkoutUrl)) {
            setErrorKind('generic');
            break;
          }
          // Rời trang ngay — KHÔNG router.refresh() (đích tiếp theo là cổng
          // thanh toán ngoài app, không phải một trang Next khác).
          window.location.assign(result.checkoutUrl);
          return;
        }
        case 'cancelPending': {
          await api.bookings.cancelPending({ code }, { context: withBrowserAuth() });
          toast.success(t.toast.cancelledTitle, { description: t.toast.cancelPendingBody });
          router.refresh();
          break;
        }
        case 'cancelBooking': {
          // Số tiền hộp xác nhận vừa in đi kèm lệnh huỷ: server từ chối nếu số nó sắp
          // hoàn đã khác (qua hạn chót khi tab để lâu) thay vì huỷ với số khách chưa thấy.
          const expectedRefundAmount = booking?.cancellation?.refundAmount;
          if (expectedRefundAmount === undefined) {
            setErrorKind('generic');
            setErrorAt(action);
            break;
          }
          // Lý do chỉ đi kèm khi khách có gõ: contract để `optional`, còn một
          // chuỗi rỗng sẽ ăn 400 vì `min(1)`.
          const result = await api.bookings.cancel(
            reason ? { code, reason, expectedRefundAmount } : { code, expectedRefundAmount },
            { context: withBrowserAuth() },
          );
          // Số tiền lấy từ KẾT QUẢ huỷ, không từ con số hộp xác nhận đã in: sổ
          // có thể đổi giữa lúc mở hộp và lúc bấm (admin hoàn thiện chí cùng lúc).
          const refunded = Number(result.refundedAmount) > 0;
          toast.success(t.toast.cancelledTitle, {
            description: refunded
              ? t.refundLine.full(formatMoneyExact(result.refundedAmount, result.booking.currency))
              : t.refundLine.none,
          });
          router.refresh();
          break;
        }
      }
    } catch (error) {
      const kind = classifyActionError(error);
      setErrorKind(kind);
      setErrorAt(action);
      // Server nói booking không còn huỷ online được (đã huỷ ở tab khác, đã tới
      // ngày khởi hành), hoặc số hoàn đã đổi: đọc lại trang để nút, trạng thái và
      // con số trong hộp xác nhận khớp sự thật.
      if (kind === 'notCancellable' || kind === 'refundChanged') router.refresh();
    } finally {
      setPending(false);
    }
  }

  const handleClick = onAction ?? (code ? performAction : undefined);

  const errorNode = errorKind ? (
    <AccountActionError
      expired={errorKind === 'sessionExpired'}
      redirectTo={`/account/bookings/${code}`}
      className="mt-3"
      fallback={errorCopy(errorKind)}
    />
  ) : null;
  /** Hai hành động này sống trong dialog — lỗi của chúng đi vào trong. */
  const IN_DIALOG: BookingAction[] = ['cancelPending', 'cancelBooking'];
  const errorInDialog = errorAt !== null && IN_DIALOG.includes(errorAt);

  if (view.actions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {view.actions.map((action) => {
          switch (action) {
            case 'payNow':
              return (
                <Button
                  key={action}
                  type="button"
                  disabled={pending}
                  onClick={() => handleClick?.(action)}
                >
                  {t.actions.payNow}
                </Button>
              );
            case 'cancelPending':
              return (
                <div key={action} className="inline-flex flex-wrap items-center gap-3">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto px-0 text-destructive-emphasis"
                          disabled={pending}
                        >
                          {t.actions.cancel}
                        </Button>
                      }
                    />
                    {/* Khổ hẹp mặc định: booking chưa trả tiền thì không có tiền
                        để bày, dialog này chỉ là một câu hỏi có/không. */}
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.actions.cancelConfirmTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.actions.cancelConfirmBody}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {errorInDialog ? errorNode : null}
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.actions.cancelDismiss}</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={() => handleClick?.(action)}>
                          {t.actions.cancelConfirmCta}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <PolicyLink />
                </div>
              );
            case 'cancelBooking':
              // Thiếu dữ liệu hộp xác nhận thì không bày nút: một nút huỷ đụng
              // tiền thật mà không nói được số tiền là mời khách bấm mù.
              if (!booking?.cancellation) return null;
              return (
                <CancelBookingDialog
                  key={action}
                  booking={booking}
                  cancellation={booking.cancellation}
                  pending={pending}
                  error={errorInDialog ? errorNode : null}
                  onSubmit={(reason) => handleClick?.(action, reason)}
                />
              );
            default:
              // `BookingAction` đã cạn ba nhánh ở trên — case này không bao giờ
              // chạy, chỉ để thoả `useIterableCallbackReturn` của Biome.
              return null;
          }
        })}
      </div>
      {errorInDialog ? null : errorNode}
    </>
  );
}
