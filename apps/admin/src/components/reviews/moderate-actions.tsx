'use client';

import type { ReviewModerationState } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { DecisionButton } from '@/components/kit/decision-button';
import {
  isStaleStateCode,
  type ModerateAction,
  type ModerateActionKind,
  type ModerateContractCode,
  type ModerateTarget,
  moderateConsequences,
  moderateErrorCopy,
  VERDICT_OF,
} from '@/lib/reviews-moderate';
import type { ReviewRowVM } from '@/lib/reviews-view';

/**
 * Cụm duyệt/bỏ duyệt của MỘT hàng trong `/reviews` (spec P4b §3-F4) — hành vi
 * GHI thứ ba của admin. Khác refund/decide ở chỗ nó không đụng tiền, nhưng
 * hệ quả vẫn nhìn thấy được từ bên ngoài: review lên (hoặc rời) trang tour
 * công khai, rating của tour tính lại, và tác giả có thể nhận email.
 *
 * Vòng đời lệnh ghi (confirm, khoá khi đang bắn, ba lối ra theo loại kết cục)
 * nằm ở kit `ConfirmWriteDialog` từ vòng trả nợ F5 — file này chỉ còn phần
 * DOMAIN. Bất biến RIÊNG của vùng này:
 *
 * - MỘT dialog cho mỗi hàng, mở bằng state (trang 50 hàng không mount 50 cây
 *   dialog sẵn).
 * - Dialog hiện NGUYÊN VĂN review + ảnh: duyệt là đăng nó ra site, không được
 *   bấm mù rồi mới đọc.
 * - Câu hệ quả do `moderateConsequences` (thuần, có test) chọn theo đúng hàng
 *   — không ternary rải trong JSX, và không hứa email cho review không có ai
 *   để gửi.
 * - `useTransition` quanh `router.refresh()`: nút bị khoá cho tới khi sự thật
 *   mới về — hàng vừa quyết không còn cửa sổ bấm-tiếp.
 *
 * Component KHÔNG tự import server action: nhận `moderate` từ trang — test
 * dựng cụm nút với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.reviews.moderate;

export function ModerateActions({
  review,
  moderate,
}: {
  review: ModerateTarget;
  moderate: ModerateAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  /**
   * Chiều lệnh bị ĐÓNG BĂNG vào state đúng LÚC BẤM nút (`null` = dialog
   * đóng) — không derive lại mỗi render từ prop server: queue có thể refresh
   * trong lúc dialog đang mở (hàng khác vừa quyết xong, hay admin B đụng cùng
   * hàng) và một dialog "Approve" tự lật thành "Unapprove" nghĩa là cú click
   * operator định là duyệt lại gửi lệnh gỡ (review F4 31/08). Nếu chiều đã
   * đóng băng thành ra cũ, server no-op guard đỡ nốt (không ghi gì).
   */
  const [frozenAction, setFrozenAction] = useState<ModerateActionKind | null>(null);

  /**
   * Nút nào hiện, theo TRẠNG THÁI (ADR-0031 §3) — dữ liệu, không phải ternary
   * rải trong JSX:
   *
   * - `pending` — duyệt, hoặc bác.
   * - `approved` — gỡ xuống (chưa quyết), hoặc bác luôn.
   * - `rejected` — chỉ còn đường duyệt. Muốn trả nó về hàng đợi thì duyệt rồi
   *   gỡ; ca ấy hiếm tới mức một nút thứ ba trên MỌI hàng là cái giá sai.
   */
  const ACTIONS: Record<ReviewRowVM['state'], ModerateActionKind[]> = {
    pending: ['approve', 'reject'],
    approved: ['unpublish', 'reject'],
    // Hai nút chứ không một (vá 05/09, user báo): một pill xanh đứng MỘT MÌNH
    // trong cột "Moderation" đọc ra như một cái NHÃN "đã duyệt", nhất là khi
    // nó trông y hệt badge `Approved` ở cột State ngay bên cạnh. Một CẶP thì
    // đọc ra là một lựa chọn. `reopen` cũng là đường lùi thật sự cần: bác
    // nhầm thì trả review về hàng đợi mà không phải đăng nó lên.
    rejected: ['approve', 'reopen'],
  };
  const actions = ACTIONS[review.state];

  /** Sau MỌI kết cục đã-chạm-server: kéo queue tươi về, khoá nút tới khi xong. */
  function refreshQueue() {
    startRefresh(() => router.refresh());
  }

  return (
    // `<fieldset>` (role=group ngầm) chứ không phải div trần: aria-label chỉ
    // có nghĩa trên một role thật, và cả trang toàn nút "Approve" giống hệt
    // nhau thì trình đọc màn hình không phân biệt nổi hàng nào.
    <fieldset aria-label={t.actionsLabel(review.authorLabel)} className="flex items-center gap-2">
      {/* Khuôn `button-23` (kit `DecisionButton`, user chốt 01/09). Chỉ
          `approve` lấy tông xanh; gỡ và bác đều là cú CHẶN LẠI — khiên gạch
          nói đúng điều đó. */}
      {actions.map((action) => (
        <DecisionButton
          key={action}
          tone={action === 'approve' ? 'approve' : 'deny'}
          disabled={isRefreshing}
          onClick={() => setFrozenAction(action)}
        >
          {BUTTON_LABEL[action]}
        </DecisionButton>
      ))}
      {frozenAction !== null ? (
        <ModerateDialog
          review={review}
          moderate={moderate}
          action={frozenAction}
          onClose={() => setFrozenAction(null)}
          onSettled={refreshQueue}
        />
      ) : null}
    </fieldset>
  );
}

/**
 * Trạng thái server trả về → toast. Tra theo KẾT CỤC chứ không theo nút vừa
 * bấm: một lệnh no-op (hàng đã bị người khác quyết) phải kể đúng thứ đang có.
 */
const TOAST: Record<
  ReviewModerationState,
  (author: string) => { title: string; description: string }
> = {
  approved: (author) => ({
    title: t.toast.approvedTitle,
    description: t.toast.approvedBody(author),
  }),
  pending: (author) => ({
    title: t.toast.unpublishedTitle,
    description: t.toast.unpublishedBody(author),
  }),
  rejected: (author) => ({
    title: t.toast.rejectedTitle,
    description: t.toast.rejectedBody(author),
  }),
};

/** Bốn việc bấm được → nhãn nút và bộ copy, tra bảng chứ không ternary lồng nhau. */
const BUTTON_LABEL: Record<ModerateActionKind, string> = {
  approve: t.approve,
  reject: t.reject,
  unpublish: t.unpublish,
  reopen: t.reopen,
};

const DIALOG_COPY = {
  approve: t.approveDialog,
  reject: t.rejectDialog,
  unpublish: t.unpublishDialog,
  reopen: t.reopenDialog,
} as const;

function ModerateDialog({
  review,
  moderate,
  action,
  onClose,
  onSettled,
}: {
  review: ModerateTarget;
  moderate: ModerateAction;
  action: ModerateActionKind;
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  const copy = DIALOG_COPY[action];
  const consequences = moderateConsequences(review, action);
  // Bác bỏ thì ghi chú là LÝ DO và đi thẳng vào email cho khách (ADR-0031 §6),
  // nên nó BẮT BUỘC — và hai chuỗi nhãn/gợi ý của nhánh kia ("the author never
  // sees it") nói ngược hẳn sự thật ở đây.
  const rejecting = action === 'reject';

  return (
    <ConfirmWriteDialog<ModerateContractCode>
      copy={{
        title: copy.title,
        body: copy.body,
        warning: copy.warning,
        submit: copy.submit,
        submitting: copy.submitting,
        cancel: t.cancel,
        noteLabel: rejecting ? t.reasonLabel : t.noteLabel,
        notePlaceholder: rejecting ? t.reasonPlaceholder : t.notePlaceholder,
      }}
      {...(rejecting ? { noteRequired: t.reasonRequired } : {})}
      // Nguồn review (VERIFIED/CURATED) KHÔNG có dòng riêng ở đây: nó đã nói
      // ra qua câu hệ quả email bên dưới ("a curated review has no customer
      // account behind it"), và cột Author của bảng có badge.
      rows={[
        { label: t.author, value: review.authorLabel },
        { label: t.rating, value: review.ratingLabel },
        { label: t.tour, value: review.tourTitle ?? messages.admin.reviews.list.noTour },
      ]}
      extra={
        <>
          {/* Nguyên văn review — không cắt bằng ellipsis như ở bảng: đây là thứ
              admin đang quyết có cho lên trang tour hay không. */}
          <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            {review.title ? <p className="font-medium">{review.title}</p> : null}
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap">{review.body}</p>
            {review.photos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {/* Trình đọc màn hình phải BIẾT review kèm ảnh trước khi duyệt
                    công khai chúng — alt từng ảnh thường rỗng (review F4). */}
                <span className="sr-only">{review.photosLabel}</span>
                {review.photos.map((photo) => (
                  // `<img>` thường chứ không `next/image` — cùng lý do đã ghi ở
                  // `review-card.tsx` của web: ảnh nhỏ cố định, không cần loader.
                  // Thêm một lý do riêng cho admin: `next/image` NÉM khi src nằm
                  // ngoài `remotePatterns` (xem `slot-image.spec.tsx`), và một
                  // hàng dữ liệu như vậy sẽ giết cả hàng đợi moderation.
                  // biome-ignore lint/performance/noImgElement: thumbnail 64px, tránh next/image ném khi host lạ
                  <img
                    key={photo.thumb}
                    src={photo.thumb}
                    alt={photo.alt}
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    className="size-16 rounded-sm border border-border object-cover"
                  />
                ))}
              </div>
            ) : null}
          </div>

          <ul className="grid list-disc gap-1 pl-5 text-sm">
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      }
      noteId={`moderate-note-${review.id}`}
      // Gỡ duyệt tô destructive dù nó ĐẢO NGƯỢC được: nó lấy đi một thứ đang
      // hiện ngoài site công khai, và làm rating tour tụt ngay lập tức — hệ
      // quả ra tới người ngoài, không chỉ trong back office.
      submitVariant={action === 'approve' ? 'default' : 'destructive'}
      contentClassName="sm:max-w-lg"
      onSubmit={async (note) => {
        const result = await moderate({
          id: review.id,
          verdict: VERDICT_OF[action],
          // Note rỗng thì BỎ HẲN field: contract cho `optional` nên gửi chuỗi
          // trắng chỉ để lại một dòng audit `note: ""` vô nghĩa trong
          // ReviewModerationEvent.
          ...(note ? { note } : {}),
        });
        if (!result.ok) return { ok: false, code: result.code };
        // Chiều đọc từ RESPONSE của server, không từ nút vừa bấm: trạng thái
        // cuối cùng là chuyện của server, client chỉ kể lại.
        return { ok: true, toast: TOAST[result.state](review.authorLabel) };
      }}
      isStale={isStaleStateCode}
      errorCopy={moderateErrorCopy}
      onClose={onClose}
      onSettled={onSettled}
    />
  );
}
