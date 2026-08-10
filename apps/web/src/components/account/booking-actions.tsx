'use client';

import { ORPCError } from '@orpc/client';
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
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { api, withBrowserAuth } from '@/lib/api/client';
import { classifySubmitError } from '@/lib/api/submit';
import type { BookingAction, BookingView } from '@/lib/booking-vm';

/**
 * Contract `bookings.cancel` yêu cầu `reason` không rỗng
 * (`CancelBookingInputSchema`, min 1 — `libs/shared/contract/src/schemas/
 * bookings.ts`), nhưng markup chốt ở pha A1 (AMENDED 06/08 trong spec — "vòng
 * thiết kế lại" nằm ở session khác, do user tự lo) KHÔNG có textarea thu lý
 * do. Gửi một câu trung tính để thoả contract mà không bịa lý do cụ thể thay
 * khách — dùng CHUNG cho `requestCancellation` lẫn `resubmitCancellation`
 * (cùng route `POST /api/bookings/{code}/cancel`).
 */
const DEFAULT_CANCELLATION_REASON = 'Requested via account portal.';

/**
 * Phân loại lỗi hành động (Task 7/A2, spec §5): 401 giữa chừng (session hết
 * hạn khi đang thao tác) có UI RIÊNG — message + link đăng nhập lại, KHÔNG
 * auto-signout — tách khỏi `classifySubmitError` (chỉ phân throttle/lỗi
 * chung cho đường oRPC, không biết về 401).
 */
type ActionErrorKind = 'sessionExpired' | 'throttle' | 'generic';

function classifyActionError(error: unknown): ActionErrorKind {
  if (error instanceof ORPCError && error.status === 401) return 'sessionExpired';
  return classifySubmitError(error) === 'throttle' ? 'throttle' : 'generic';
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
  deniedNote,
  code,
  onAction,
}: {
  view: BookingView;
  /** Lý do admin từ chối lần yêu cầu hủy trước — chỉ có ý nghĩa ở nhánh
   *  `resubmitCancellation`. Task 6 (A2): page dựng qua `toCancellationView`
   *  từ `Booking['cancellationStatus']` thật — LUÔN `null` (contract khách
   *  không mang lý do admin, xem JSDoc `CancellationView` ở `booking-vm.ts`). */
  deniedNote?: string | null;
  /** Mã booking — cần để hành động thật gọi đúng route. Optional vì spec
   *  jsdom truyền `onAction` giả lập, không cần mã thật. */
  code?: string;
  onAction?: (action: BookingAction) => void;
}) {
  const t = messages.accountBookingDetail.actions;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<ActionErrorKind | null>(null);

  async function performAction(action: BookingAction) {
    if (!code || pending) return;
    setPending(true);
    setErrorKind(null);
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
            { code, reason: DEFAULT_CANCELLATION_REASON },
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
    } finally {
      setPending(false);
    }
  }

  const handleClick = onAction ?? (code ? performAction : undefined);

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
                <AlertDialog key={action}>
                  <AlertDialogTrigger
                    render={
                      <Button type="button" variant="outline" disabled={pending}>
                        {t.cancelPending}
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.cancelConfirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>{t.cancelConfirmBody}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.cancelDismiss}</AlertDialogCancel>
                      <AlertDialogAction disabled={pending} onClick={() => handleClick?.(action)}>
                        {t.cancelConfirmCta}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              );
            case 'requestCancellation':
              return (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleClick?.(action)}
                >
                  {t.requestCancellation}
                </Button>
              );
            case 'viewCancellationPending':
              return (
                <p key={action} className="text-sm text-muted-foreground">
                  {t.viewCancellationPending}
                </p>
              );
            case 'resubmitCancellation':
              return (
                <div key={action} className="flex flex-col gap-2">
                  {deniedNote ? (
                    <p className="text-sm text-destructive">
                      {messages.accountBookingDetail.deniedNote(deniedNote)}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleClick?.(action)}
                  >
                    {t.resubmitCancellation}
                  </Button>
                </div>
              );
            default:
              // `BookingAction` đã cạn hết 5 nhánh ở trên — case này không
              // bao giờ chạy, chỉ để thoả `useIterableCallbackReturn` (Biome
              // không suy ra được switch trên union đã exhaustive).
              return null;
          }
        })}
      </div>
      {errorKind ? (
        <AccountActionError
          expired={errorKind === 'sessionExpired'}
          redirectTo={`/account/bookings/${code}`}
          className="mt-3"
          fallback={
            errorKind === 'throttle'
              ? messages.accountActionErrors.throttle
              : messages.accountActionErrors.generic
          }
        />
      ) : null}
    </>
  );
}
