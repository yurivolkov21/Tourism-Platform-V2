'use client';

import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ApproveStepperDialog,
  type ApproveTarget,
} from '@/components/cancellations/approve-stepper-dialog';
import { ConfirmWriteDialog, type ConfirmWriteRow } from '@/components/kit/confirm-write-dialog';
import { DecisionButton } from '@/components/kit/decision-button';
import {
  type DecideAction,
  type DecideContractCode,
  decideErrorCopy,
  isStaleStateCode,
} from '@/lib/cancellations-decide';

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

/**
 * Phần request mà cụm nút thật sự cần — trang cắt ĐÚNG các field này.
 *
 * Kế thừa `ApproveTarget`: từ ADR-0029 §5 nhánh approve cần đủ dữ kiện để
 * TÍNH mức hoàn theo chính sách (ngày gửi yêu cầu, ngày khởi hành, badge tour,
 * lúc thanh toán), không chỉ đủ để in phần còn lại. Deny không dùng nhóm ấy
 * nhưng hai nhánh chung một hàng nên chung một target.
 */
export type DecideTarget = ApproveTarget;

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
      {/* Cặp nút khuôn `button-23` (kit `DecisionButton`, user chốt 01/09):
          màu và kiểu cựa của icon cùng nói một điều — khiên tích nảy lên cho
          cú đi tới, khiên gạch lắc đầu cho cú chặn lại. */}
      <DecisionButton tone="approve" disabled={isRefreshing} onClick={() => setVariant('approve')}>
        {t.approve}
      </DecisionButton>
      <DecisionButton tone="deny" disabled={isRefreshing} onClick={() => setVariant('deny')}>
        {t.deny}
      </DecisionButton>
      {/* Approve đi STEPPER (ADR-0029 §5), deny giữ xác nhận một bước: lệnh
          chuyển tiền và lệnh không đụng gì không đáng cùng một nghi thức. */}
      {variant === 'approve' ? (
        <ApproveStepperDialog
          request={request}
          decide={decide}
          onClose={() => setVariant(null)}
          onSettled={refreshQueue}
        />
      ) : null}
      {variant === 'deny' ? (
        <DenyDialog
          request={request}
          decide={decide}
          onClose={() => setVariant(null)}
          onSettled={refreshQueue}
        />
      ) : null}
    </fieldset>
  );
}

/** Deny — không tiền, không ghế, nên vẫn là một xác nhận MỘT bước có ô ghi chú. */
function DenyDialog({
  request,
  decide,
  onClose,
  onSettled,
}: {
  request: DecideTarget;
  decide: DecideAction;
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  const rows: ConfirmWriteRow[] = [
    { label: t.booking, value: request.bookingCode },
    { label: t.tour, value: request.tourTitle },
    { label: t.customer, value: request.customerName },
    { label: t.reason, value: request.reason },
  ];

  return (
    <ConfirmWriteDialog<DecideContractCode>
      copy={{
        title: t.denyDialog.title,
        body: t.denyDialog.body,
        warning: t.denyDialog.warning,
        submit: t.denyDialog.submit,
        submitting: t.denyDialog.submitting,
        cancel: t.cancel,
        noteLabel: t.noteLabel,
        notePlaceholder: t.notePlaceholder,
      }}
      rows={rows}
      noteId={`decide-note-${request.id}`}
      // Nút deny tô destructive dù BADGE trạng thái DENIED thì không: badge kể
      // một kết cục đã rồi (trung tính), còn nút là một hành động chung cuộc
      // sắp xảy ra với tiền/kỳ vọng của khách.
      submitVariant="destructive"
      onSubmit={async (note) => {
        const result = await decide({
          id: request.id,
          approve: false,
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
