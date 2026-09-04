'use client';

import { ORPCError } from '@orpc/client';
import {
  daysBeforeDeparture,
  isWithinGracePeriod,
  refundPercentForRequest,
} from '@tourism/contract';
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
import { formatMoney } from '@/lib/tours';

/** Trần `reason` của contract (`CancelBookingInputSchema.max(1000)`). */
const REASON_MAX = 1000;

/**
 * Phân loại lỗi hành động (Task 7/A2, spec §5): 401 giữa chừng (session hết
 * hạn khi đang thao tác) có UI RIÊNG — message + link đăng nhập lại, KHÔNG
 * auto-signout — tách khỏi `classifySubmitError` (chỉ phân throttle/lỗi
 * chung cho đường oRPC, không biết về 401).
 */
type ActionErrorKind =
  | 'sessionExpired'
  | 'throttle'
  | 'alreadyRequested'
  | 'notCancellable'
  | 'generic';

function classifyActionError(error: unknown): ActionErrorKind {
  if (error instanceof ORPCError) {
    if (error.status === 401) return 'sessionExpired';
    // 409/422 từ `bookings.cancel` có copy RIÊNG đã tồn tại sẵn; trước đây cả
    // hai rơi vào 'generic', tức khách bị báo "có gì đó sai" trong khi hệ
    // thống biết chính xác chuyện gì và nói được.
    if (error.status === 409) return 'alreadyRequested';
    if (error.status === 422) return 'notCancellable';
  }
  return classifySubmitError(error) === 'throttle' ? 'throttle' : 'generic';
}

/** Copy tương ứng cho từng loại lỗi KHÔNG phải session (session có UI riêng). */
function errorCopy(kind: ActionErrorKind): string {
  const e = messages.accountActionErrors;
  switch (kind) {
    case 'throttle':
      return e.throttle;
    case 'alreadyRequested':
      return e.alreadyRequested;
    case 'notCancellable':
      return e.notCancellable;
    default:
      return e.generic;
  }
}

/**
 * Link chính sách hủy — Task 7: chuyển từ footer chung chung của trang (mọi
 * mục "Manage" đều thấy, kể cả khi không còn hành động hủy nào) sang đứng
 * NGAY CẠNH text-link hủy cụ thể, chuẩn Booking.com (policy gắn vào đúng
 * hành động). Chỉ ba case còn có gì để hủy (`cancelPending`/
 * `requestCancellation`/`resubmitCancellation`) mới render cạnh nó —
 * `payNow`/`viewCancellationPending` không có action hủy để gắn vào.
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

/**
 * Dialog xin huỷ booking ĐÃ TRẢ TIỀN, có ô nhập lý do.
 *
 * CHỈ dùng cho `requestCancellation`/`resubmitCancellation`. Tuyệt đối không
 * gắn vào `cancelPending`: nhánh đó nhận input chỉ `{code}`, không lý do,
 * không qua admin, không đụng ghế — hai luồng khác nhau về bản chất chứ không
 * chỉ khác nhãn nút.
 *
 * Lý do là BẮT BUỘC vì contract khai `min(1)`, và vì nó đi thẳng vào hàng đợi
 * duyệt hoàn tiền — đơn không lý do thì người duyệt không có gì để quyết. Chặn
 * ở client trước khi gọi API để khách biết ngay, thay vì gõ xong rồi ăn 400.
 *
 * `AlertDialogAction` CỐ Ý không tự đóng dialog (xem `alert-dialog.tsx`): lỗi
 * hiện ngay trong dialog và khách không mất chữ đã gõ.
 */
function CancelRequestDialog({
  label,
  pending,
  error,
  refund,
  onSubmit,
}: {
  label: string;
  pending: boolean;
  /** Ước tính hoàn tiền; vắng khi trang chưa truyền booking (spec jsdom cũ). */
  refund?: RefundEstimateInput;
  /** Lỗi render BÊN TRONG dialog. Để ngoài thì nó nằm sau lớp modal: `getByText`
   *  vẫn thấy nhưng `getByRole` thì không, tức người dùng bàn phím và trình đọc
   *  màn hình KHÔNG với tới được — kể cả link "đăng nhập lại". */
  error?: ReactNode;
  onSubmit: (reason: string) => void;
}) {
  const t = messages.booking.detail;
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const invalid = touched && trimmed.length === 0;

  return (
    // Task 7: trigger + policy link đứng CHUNG một hàng — "gắn liền vào hành
    // động", KHÔNG phải hai mẩu rời rạc trên trang.
    <div className="inline-flex flex-wrap items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger
          render={
            // Giáng cấp từ Button nổi (`variant="outline"`) xuống text-link —
            // dialog/textarea/submit bên dưới GIỮ NGUYÊN, chỉ trình bày nút
            // mở dialog đổi. `h-auto px-0` gỡ khung/đệm còn sót của size mặc
            // định (tiền lệ `profile-summary.tsx`, nút "Change" cạnh field).
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-destructive-emphasis"
              disabled={pending}
            >
              {label}
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.requestTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.requestBody}</AlertDialogDescription>
          </AlertDialogHeader>

          {refund ? <RefundEstimate booking={refund} /> : null}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="cancel-reason">{t.reasonLabel}</Label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {t.reasonCounter(trimmed.length)}
              </span>
            </div>
            <Textarea
              id="cancel-reason"
              rows={4}
              maxLength={REASON_MAX}
              placeholder={t.reasonPlaceholder}
              value={reason}
              aria-invalid={invalid}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            {invalid ? (
              <p role="alert" className="text-sm text-destructive-emphasis">
                {t.reasonRequired}
              </p>
            ) : null}
          </div>

          {error}

          <AlertDialogFooter>
            <AlertDialogCancel>
              {messages.accountBookingDetail.actions.cancelDismiss}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setTouched(true);
                if (trimmed.length === 0) return;
                onSubmit(trimmed);
              }}
            >
              {pending ? t.submitting : t.submitRequest}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PolicyLink />
    </div>
  );
}

/**
 * Hành động trang `/account/bookings/[code]` (spec §3) — CHỈ render theo
 * `view.actions` (bảng quyết định `bookingView`, Task 2, map action→nút),
 * KHÔNG if/else theo status trong JSX (luật Task 4).
 *
 * Hai đường gọi handler (Task 7/A2):
 * - `onAction` truyền tay (spec jsdom truyền `vi.fn()` để soi tham số, KHÔNG
 *   đụng API thật) — override, LUÔN ưu tiên nếu có.
 * - `code` (mã booking thật) mà KHÔNG có `onAction` → nút thật gọi thẳng oRPC
 *   qua client browser (`credentials: 'include'`, ADR-0017 §1). Đây là
 *   đường page `/account/bookings/[code]/page.tsx` (Server Component) dùng —
 *   Server Component KHÔNG truyền được một hàm client thật xuống Client
 *   Component, nên "truyền handler" ở đây là truyền DỮ LIỆU (`code`) để
 *   component TỰ dựng handler, không phải truyền function qua RSC boundary.
 * - Thiếu cả hai (chưa từng xảy ra ở A2, chỉ còn ở spec cũ) → bấm không làm
 *   gì, không throw.
 */
export function BookingActions({
  view,
  code,
  refund,
  onAction,
}: {
  view: BookingView;
  /** Ước tính hoàn tiền cho dialog xin huỷ (ADR-0030 §3b). */
  refund?: RefundEstimateInput;
  /** Mã booking — cần để hành động thật gọi đúng route. Optional vì spec
   *  jsdom truyền `onAction` giả lập, không cần mã thật. */
  code?: string;
  onAction?: (action: BookingAction, reason?: string) => void;
}) {
  const t = messages.accountBookingDetail.actions;
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
          const booking = await api.bookings.checkout({ code }, { context: withBrowserAuth() });
          if (!booking.checkoutUrl) {
            setErrorKind('generic');
            break;
          }
          // Rời trang ngay — KHÔNG router.refresh() (đích tiếp theo là cổng
          // thanh toán ngoài app, không phải một trang Next khác).
          window.location.assign(booking.checkoutUrl);
          return;
        }
        case 'cancelPending': {
          await api.bookings.cancelPending({ code }, { context: withBrowserAuth() });
          toast.success(messages.accountBookingDetail.toast.cancelPendingTitle, {
            description: messages.accountBookingDetail.toast.cancelPendingBody,
          });
          router.refresh();
          break;
        }
        case 'requestCancellation':
        case 'resubmitCancellation': {
          await api.bookings.cancel(
            // Lý do do KHÁCH gõ. Trước đây chỗ này gửi một hằng số cứng, và
            // chuỗi đó còn được email NGƯỢC lại cho chính họ ("Your reason:
            // Requested via account portal.") — copy sai đang sống, không phải
            // nợ thẩm mỹ.
            { code, reason: reason ?? '' },
            { context: withBrowserAuth() },
          );
          toast.success(messages.accountBookingDetail.toast.cancelRequestedTitle, {
            description: messages.accountBookingDetail.toast.cancelRequestedBody,
          });
          router.refresh();
          break;
        }
        case 'viewCancellationPending':
          // Nhánh này chỉ render text (xem JSX bên dưới) — không có nút nào
          // gọi `performAction` với action này, giữ ở đây chỉ để switch cạn
          // hết union (exhaustiveness), khỏi cần `default`.
          break;
      }
    } catch (error) {
      setErrorKind(classifyActionError(error));
      setErrorAt(action);
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
  /** Ba hành động này sống trong dialog — lỗi của chúng đi vào trong. */
  const IN_DIALOG: BookingAction[] = [
    'cancelPending',
    'requestCancellation',
    'resubmitCancellation',
  ];
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
                  {t.payNow}
                </Button>
              );
            case 'cancelPending':
              return (
                // Task 7: cùng khuôn `PolicyLink` cạnh trigger như
                // `CancelRequestDialog` — trigger + policy đứng chung hàng.
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
                          {t.cancelPending}
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.cancelConfirmTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{t.cancelConfirmBody}</AlertDialogDescription>
                      </AlertDialogHeader>
                      {errorInDialog ? errorNode : null}
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.cancelDismiss}</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={() => handleClick?.(action)}>
                          {t.cancelConfirmCta}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <PolicyLink />
                </div>
              );
            case 'requestCancellation':
              return (
                <CancelRequestDialog
                  key={action}
                  label={t.requestCancellation}
                  pending={pending}
                  refund={refund}
                  error={errorInDialog ? errorNode : null}
                  onSubmit={(reason) => handleClick?.(action, reason)}
                />
              );
            case 'viewCancellationPending':
              return (
                <p key={action} className="text-sm text-muted-foreground">
                  {t.viewCancellationPending}
                </p>
              );
            case 'resubmitCancellation':
              return (
                <CancelRequestDialog
                  key={action}
                  label={t.resubmitCancellation}
                  pending={pending}
                  refund={refund}
                  error={errorInDialog ? errorNode : null}
                  onSubmit={(reason) => handleClick?.(action, reason)}
                />
              );
            default:
              // `BookingAction` đã cạn hết 5 nhánh ở trên — case này không
              // bao giờ chạy, chỉ để thoả `useIterableCallbackReturn` (Biome
              // không suy ra được switch trên union đã exhaustive).
              return null;
          }
        })}
      </div>
      {errorInDialog ? null : errorNode}
    </>
  );
}

/**
 * Ước tính hoàn tiền, hiện NGAY TRONG dialog xin huỷ (ADR-0030 §3b).
 *
 * Trước đây khách bấm gửi rồi mới biết được hoàn bao nhiêu — mà chính sách thì
 * cố định, tính được ngay. Con số ở đây do `refundPercentForBooking` +
 * `daysBeforeDeparture` của contract tính, tức ĐÚNG hàm mà màn quyết định của
 * admin dùng: khách và admin không thể nhìn hai con số khác nhau.
 *
 * Đếm ngày từ BÂY GIỜ vì yêu cầu chưa gửi; khi đã gửi thì mốc chính thức là
 * `CancellationRequest.createdAt` — cùng ngày lịch, nên con số không đổi.
 */
function RefundEstimate({ booking }: { booking: RefundEstimateInput }) {
  const t = messages.booking.detail;
  const now = new Date();
  const days = daysBeforeDeparture(now, booking.departureStartDate);
  // ĐIỂM VÀO DUY NHẤT, dùng chung với màn quyết định của admin — đã gồm cả cửa
  // sổ ân hạn 24h (ADR-0030 §3c), nên khách đặt sát ngày rồi đổi ý vẫn thấy
  // 100% chứ không phải một con số thấp rồi bất ngờ ở bước sau.
  const percent = refundPercentForRequest({
    requestedAt: now,
    paidAt: booking.paidAt,
    departureStartDate: booking.departureStartDate,
    freeCancellationDays: booking.freeCancellationDays,
  });
  const inGrace = isWithinGracePeriod(booking.paidAt, now);
  // Bậc tính trên TỔNG rồi trừ phần đã hoàn — không thì hoàn đúp (ADR-0030 §7).
  const gross = (Number(booking.totalAmount) * percent) / 100;
  const already = Number(booking.refundedTotal);
  const net = Math.max(0, gross - already);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
      <p className="font-medium text-foreground">{t.refundEstimateHeading}</p>
      <p className="text-muted-foreground">{t.refundEstimateDays(days)}</p>
      {/* Nói RÕ vì sao được 100%: không có câu này thì con số trông như may
          mắn, và khách không biết mình đang trong một cửa sổ sắp hết. */}
      {inGrace ? <p className="text-muted-foreground">{t.refundEstimateGrace}</p> : null}
      <p className="text-muted-foreground">
        {t.refundEstimateAmount(percent, formatMoney(net.toFixed(2), booking.currency))}
      </p>
      {already > 0 ? (
        <p className="text-muted-foreground">
          {t.refundEstimateAlreadyRefunded(formatMoney(already.toFixed(2), booking.currency))}
        </p>
      ) : null}
      <Link
        href="/cancellation-policy"
        className="w-fit text-sm underline-offset-4 hover:underline"
      >
        {t.refundEstimateLink}
      </Link>
    </div>
  );
}

/** Phần booking mà ước tính cần — cắt đúng chừng này, không nhận cả entity. */
export interface RefundEstimateInput {
  departureStartDate: string;
  /** ISO; `null` = chưa trả tiền, nên không có ân hạn. */
  paidAt: string | null;
  freeCancellationDays: number | null;
  totalAmount: string;
  refundedTotal: string;
  currency: string;
}
