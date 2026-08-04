'use client';

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
import type { BookingAction, BookingView } from '@/lib/booking-vm';

/**
 * Hành động trang `/account/bookings/[code]` (spec §3) — CHỈ render theo
 * `view.actions` (bảng quyết định `bookingView`, Task 2, map action→nút),
 * KHÔNG if/else theo status trong JSX (luật Task 4). A1: page KHÔNG truyền
 * `onAction` → nút thật, bấm không làm gì (KHÔNG console stub); A2 (Task 7)
 * mới truyền handler thật gọi API.
 */
export function BookingActions({
  view,
  deniedNote,
  onAction,
}: {
  view: BookingView;
  /** Lý do admin từ chối lần yêu cầu hủy trước — chỉ có ý nghĩa ở nhánh
   *  `resubmitCancellation` (đọc từ `MOCK_CANCELLATIONS`, page truyền vào). */
  deniedNote?: string | null;
  onAction?: (action: BookingAction) => void;
}) {
  const t = messages.accountBookingDetail.actions;

  if (view.actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {view.actions.map((action) => {
        switch (action) {
          case 'payNow':
            return (
              <Button key={action} type="button" onClick={() => onAction?.(action)}>
                {t.payNow}
              </Button>
            );
          case 'cancelPending':
            return (
              <AlertDialog key={action}>
                <AlertDialogTrigger
                  render={
                    <Button type="button" variant="outline">
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
                    <AlertDialogAction onClick={() => onAction?.(action)}>
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
                onClick={() => onAction?.(action)}
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
                <Button type="button" variant="outline" onClick={() => onAction?.(action)}>
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
  );
}
