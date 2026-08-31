'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tourism/ui/components/dialog';
import { Label } from '@tourism/ui/components/label';
import { Textarea } from '@tourism/ui/components/textarea';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { isUncertainOutcome } from '@/lib/api/write-error';
import { formatAmount } from '@/lib/bookings-view';
import {
  type DecideAction,
  type DecideFailureCode,
  decideErrorCopy,
  isStaleStateCode,
} from '@/lib/cancellations-decide';
import { remainingRefundable } from '@/lib/refund';

/**
 * Cụm quyết định của MỘT hàng đang mở trong `/cancellations` (spec P4b
 * §3-F3) — hành vi GHI thứ hai của admin, và approve là money-path trọn gói
 * (refund phần còn lại + booking CANCELLED + nhả ghế, nguyên tử trong một
 * advisory lock phía API).
 *
 * Bất biến giữ từ F2 (`refund-panel.tsx`) + vòng vá review F3 31/08:
 * - Confirm trước khi bắn (§2.4); dialog KHÔNG đóng được khi đang bắn.
 * - MỘT dialog cho mỗi hàng, nhánh approve/deny là STATE chứ không phải hai
 *   instance (trang 50 hàng từng mount 100 cây dialog).
 * - Dialog approve hiện SỐ TIỀN sẽ hoàn (phần còn lại, số thật server trả) —
 *   không bấm lệnh tiền mù.
 * - Lỗi TRẠNG-THÁI-CŨ (NOT_FOUND/ALREADY_DECIDED/NOT_REFUNDABLE) và kết cục
 *   KHÔNG RÕ (GENERIC): đóng dialog + toast + refresh — copy hứa "queue has
 *   been refreshed" thì UI làm thật. REFUND_FAILED (retryable) ở lại dialog.
 * - `useTransition` quanh `router.refresh()`: hai nút bị khoá cho tới khi
 *   sự thật mới về — hàng vừa quyết không còn cửa sổ bấm-tiếp (nếp F2).
 *
 * Component KHÔNG tự import server action: nhận `decide` từ trang — test dựng
 * cụm nút với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.cancellations.decide;

/** Phần request mà cụm nút thật sự cần — bảng cắt ĐÚNG các field này. */
export interface DecideTarget {
  id: string;
  bookingCode: string;
  tourTitle: string;
  customerName: string;
  reason: string;
  /** Tiền từ server (review F3): dialog approve tính phần-còn-lại từ đây. */
  totalAmount: string;
  refundedTotal: string;
  currency: string;
}

type DecideVariant = 'approve' | 'deny';

export function DecideActions({
  request,
  decide,
}: {
  request: DecideTarget;
  decide: DecideAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  /** Nhánh đang mở — `null` là dialog đóng. Một dialog, hai nút mở. */
  const [variant, setVariant] = useState<DecideVariant | null>(null);

  /** Sau MỌI kết cục đã-chạm-server: kéo queue tươi về, khoá nút tới khi xong. */
  function refreshQueue() {
    startRefresh(() => router.refresh());
  }

  return (
    // `<fieldset>` (role=group ngầm) chứ không phải div trần: aria-label chỉ
    // có nghĩa trên một role thật, và nhóm hai nút của MỘT hàng cần tên riêng
    // để trình đọc màn hình không đọc ra 20 nút "Approve" giống hệt nhau.
    <fieldset aria-label={t.actionsLabel(request.bookingCode)} className="flex items-center gap-2">
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={isRefreshing}
        onClick={() => setVariant('approve')}
      >
        {t.approve}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRefreshing}
        onClick={() => setVariant('deny')}
      >
        {t.deny}
      </Button>
      {variant ? (
        <DecideDialog
          request={request}
          decide={decide}
          variant={variant}
          onClose={() => setVariant(null)}
          onSettled={refreshQueue}
        />
      ) : null}
    </fieldset>
  );
}

function DecideDialog({
  request,
  decide,
  variant,
  onClose,
  onSettled,
}: {
  request: DecideTarget;
  decide: DecideAction;
  variant: DecideVariant;
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  const approve = variant === 'approve';
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<DecideFailureCode | null>(null);
  const [pending, setPending] = useState(false);

  // Nhánh approve/deny là DỮ LIỆU, không phải ternary rải trong JSX (review
  // F3 31/08 — sáu ternary từng rải trong 130 dòng).
  const copy = approve ? t.approveDialog : t.denyDialog;
  const submitVariant = approve ? 'default' : 'destructive';
  const noteId = `decide-note-${request.id}`;
  const remaining = remainingRefundable(request.totalAmount, request.refundedTotal);

  function onOpenChange(next: boolean) {
    // Đang bắn thì KHÔNG cho đóng (Esc/click ngoài): reset giữa chừng là
    // thông báo lỗi về sau ghi vào một dialog đã đóng — admin tưởng xong.
    if (pending) return;
    if (!next) onClose();
  }

  async function submit() {
    if (pending) return;
    setPending(true);
    setFailure(null);
    const trimmed = note.trim();
    let failureCode: DecideFailureCode;
    try {
      const result = await decide({
        id: request.id,
        approve,
        // Contract đòi `min(1)` — note rỗng thì BỎ HẲN field, đừng gửi chuỗi
        // trắng rồi ăn 400 ở lớp validate.
        ...(trimmed ? { decisionNote: trimmed } : {}),
      });
      if (result.ok) {
        setPending(false);
        onClose();
        toast.success(result.approved ? t.toast.approvedTitle : t.toast.deniedTitle, {
          description: result.approved
            ? t.toast.approvedBody(result.bookingCode)
            : t.toast.deniedBody(result.bookingCode),
        });
        onSettled();
        return;
      }
      failureCode = result.code;
    } catch {
      // Action ném (mạng đứt, action chết giữa chừng): không biết lệnh đã tới
      // đâu — cùng lối xử với GENERIC bên dưới.
      failureCode = 'GENERIC';
    }
    setPending(false);
    // Lỗi trạng-thái-cũ VÀ kết cục không rõ đều đóng + toast + refresh: thế
    // giới đã đổi dưới chân dialog, admin phải nhìn queue tươi trước khi làm
    // gì tiếp (chống bấm-lặp trên hàng đã quyết — review F3 31/08). Chỉ
    // REFUND_FAILED (retryable, chưa ghi gì) ở lại dialog.
    if (isStaleStateCode(failureCode) || isUncertainOutcome(failureCode)) {
      onClose();
      toast.error(decideErrorCopy(failureCode));
      onSettled();
      return;
    }
    setFailure(failureCode);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        {/* Ngữ cảnh của hàng đi THEO dialog: quyết định huỷ một chuyến đi mà
            phải nhớ xem vừa bấm ở hàng nào là công thức bấm nhầm hàng. */}
        <dl className="grid gap-2 text-sm">
          <DecideRow label={t.booking} value={request.bookingCode} />
          <DecideRow label={t.tour} value={request.tourTitle} />
          <DecideRow label={t.customer} value={request.customerName} />
          <DecideRow label={t.reason} value={request.reason} />
          {approve ? (
            // Con số THẬT trước khi bấm (review F3): phần còn lại = total −
            // đã hoàn, cả hai server trả qua queue schema.
            <DecideRow
              label={t.refundAmount}
              value={t.refundAmountValue(formatAmount(remaining, request.currency))}
            />
          ) : null}
        </dl>

        {approve ? (
          <ul className="grid list-disc gap-1 pl-5 text-sm">
            <li>{t.approveDialog.consequences.refund}</li>
            <li>{t.approveDialog.consequences.cancelled}</li>
            <li>{t.approveDialog.consequences.seats}</li>
          </ul>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor={noteId}>{t.noteLabel}</Label>
          <Textarea
            id={noteId}
            rows={3}
            maxLength={500}
            placeholder={t.notePlaceholder}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <p className="text-sm text-destructive-emphasis">{copy.warning}</p>

        {failure ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {decideErrorCopy(failure)}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t.cancel}
          </Button>
          {/* Nút deny tô destructive dù BADGE trạng thái DENIED thì không: badge
              kể một kết cục đã rồi (trung tính), còn nút là một hành động
              chung cuộc sắp xảy ra với tiền/kỳ vọng của khách. */}
          <Button type="button" variant={submitVariant} disabled={pending} onClick={submit}>
            {pending ? copy.submitting : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Một dòng ngữ cảnh trong dialog xác nhận. */
function DecideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
