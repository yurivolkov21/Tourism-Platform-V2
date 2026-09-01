'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import {
  isStaleStateCode,
  type ModerateAction,
  type ModerateContractCode,
  type ModerateTarget,
  moderateConsequences,
  moderateErrorCopy,
} from '@/lib/reviews-moderate';

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
  const [frozenApprove, setFrozenApprove] = useState<boolean | null>(null);

  // Một hàng chỉ có MỘT chiều đi tiếp: đang chờ thì duyệt, đang hiện thì gỡ.
  const approve = !review.approved;

  /** Sau MỌI kết cục đã-chạm-server: kéo queue tươi về, khoá nút tới khi xong. */
  function refreshQueue() {
    startRefresh(() => router.refresh());
  }

  return (
    // `<fieldset>` (role=group ngầm) chứ không phải div trần: aria-label chỉ
    // có nghĩa trên một role thật, và cả trang toàn nút "Approve" giống hệt
    // nhau thì trình đọc màn hình không phân biệt nổi hàng nào.
    <fieldset aria-label={t.actionsLabel(review.authorLabel)} className="flex items-center gap-2">
      <Button
        type="button"
        variant={approve ? 'default' : 'outline'}
        size="sm"
        disabled={isRefreshing}
        onClick={() => setFrozenApprove(approve)}
      >
        {approve ? t.approve : t.unapprove}
      </Button>
      {frozenApprove !== null ? (
        <ModerateDialog
          review={review}
          moderate={moderate}
          approve={frozenApprove}
          onClose={() => setFrozenApprove(null)}
          onSettled={refreshQueue}
        />
      ) : null}
    </fieldset>
  );
}

function ModerateDialog({
  review,
  moderate,
  approve,
  onClose,
  onSettled,
}: {
  review: ModerateTarget;
  moderate: ModerateAction;
  approve: boolean;
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  // Nhánh approve/unapprove là DỮ LIỆU, không phải ternary rải trong JSX.
  const copy = approve ? t.approveDialog : t.unapproveDialog;
  const consequences = moderateConsequences(review, approve);

  return (
    <ConfirmWriteDialog<ModerateContractCode>
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
                    key={photo.url}
                    src={photo.url}
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
      submitVariant={approve ? 'default' : 'destructive'}
      contentClassName="sm:max-w-lg"
      onSubmit={async (note) => {
        const result = await moderate({
          id: review.id,
          approve,
          // Note rỗng thì BỎ HẲN field: contract cho `optional` nên gửi chuỗi
          // trắng chỉ để lại một dòng audit `note: ""` vô nghĩa trong
          // ReviewModerationEvent.
          ...(note ? { note } : {}),
        });
        if (!result.ok) return { ok: false, code: result.code };
        // Chiều đọc từ RESPONSE của server, không từ nút vừa bấm: trạng thái
        // cuối cùng là chuyện của server, client chỉ kể lại.
        return {
          ok: true,
          toast: {
            title: result.approved ? t.toast.approvedTitle : t.toast.unapprovedTitle,
            description: result.approved
              ? t.toast.approvedBody(review.authorLabel)
              : t.toast.unapprovedBody(review.authorLabel),
          },
        };
      }}
      isStale={isStaleStateCode}
      errorCopy={moderateErrorCopy}
      onClose={onClose}
      onSettled={onSettled}
    />
  );
}
