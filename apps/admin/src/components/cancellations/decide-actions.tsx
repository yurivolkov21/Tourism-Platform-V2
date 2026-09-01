'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog, type ConfirmWriteRow } from '@/components/kit/confirm-write-dialog';
import { formatAmount } from '@/lib/bookings-view';
import {
  type DecideAction,
  type DecideContractCode,
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
 * Vòng đời lệnh ghi (confirm, khoá khi đang bắn, ba lối ra theo loại kết cục)
 * nằm ở kit `ConfirmWriteDialog` từ vòng trả nợ F5 — file này chỉ còn phần
 * DOMAIN: ngữ cảnh hàng, ba hệ quả của approve, input gửi đi và toast. Bất
 * biến của kit đọc ở JSDoc bên đó; bất biến RIÊNG của vùng này:
 *
 * - Dialog approve hiện SỐ TIỀN sẽ hoàn (phần còn lại, số thật server trả) —
 *   không bấm lệnh tiền mù.
 * - Nhánh approve/deny là STATE chứ không phải hai instance (trang 50 hàng
 *   từng mount 100 cây dialog).
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
  // Nhánh approve/deny là DỮ LIỆU, không phải ternary rải trong JSX (review
  // F3 31/08 — sáu ternary từng rải trong 130 dòng).
  const copy = approve ? t.approveDialog : t.denyDialog;
  const remaining = remainingRefundable(request.totalAmount, request.refundedTotal);

  const rows: ConfirmWriteRow[] = [
    { label: t.booking, value: request.bookingCode },
    { label: t.tour, value: request.tourTitle },
    { label: t.customer, value: request.customerName },
    { label: t.reason, value: request.reason },
    // Con số THẬT trước khi bấm (review F3): phần còn lại = total − đã hoàn,
    // cả hai server trả qua queue schema. Deny không hoàn gì nên không có dòng.
    ...(approve
      ? [
          {
            label: t.refundAmount,
            value: t.refundAmountValue(formatAmount(remaining, request.currency)),
          },
        ]
      : []),
  ];

  return (
    <ConfirmWriteDialog<DecideContractCode>
      copy={{
        title: copy.title,
        body: copy.body,
        warning: copy.warning,
        submit: copy.submit,
        submitting: copy.submitting,
        cancel: t.cancel,
        noteLabel: t.noteLabel,
        notePlaceholder: t.notePlaceholder,
      }}
      rows={rows}
      extra={
        approve ? (
          <ul className="grid list-disc gap-1 pl-5 text-sm">
            <li>{t.approveDialog.consequences.refund}</li>
            <li>{t.approveDialog.consequences.cancelled}</li>
            <li>{t.approveDialog.consequences.seats}</li>
          </ul>
        ) : null
      }
      noteId={`decide-note-${request.id}`}
      // Nút deny tô destructive dù BADGE trạng thái DENIED thì không: badge kể
      // một kết cục đã rồi (trung tính), còn nút là một hành động chung cuộc
      // sắp xảy ra với tiền/kỳ vọng của khách.
      submitVariant={approve ? 'default' : 'destructive'}
      onSubmit={async (note) => {
        const result = await decide({
          id: request.id,
          approve,
          // Contract đòi `min(1)` — note rỗng thì BỎ HẲN field, đừng gửi chuỗi
          // trắng rồi ăn 400 ở lớp validate.
          ...(note ? { decisionNote: note } : {}),
        });
        if (!result.ok) return { ok: false, code: result.code };
        // Chiều đọc từ RESPONSE của server, không từ nút vừa bấm.
        return {
          ok: true,
          toast: {
            title: result.approved ? t.toast.approvedTitle : t.toast.deniedTitle,
            description: result.approved
              ? t.toast.approvedBody(result.bookingCode)
              : t.toast.deniedBody(result.bookingCode),
          },
        };
      }}
      isStale={isStaleStateCode}
      errorCopy={decideErrorCopy}
      onClose={onClose}
      onSettled={onSettled}
    />
  );
}
