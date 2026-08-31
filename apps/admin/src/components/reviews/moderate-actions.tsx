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
import {
  isStaleStateCode,
  type ModerateAction,
  type ModerateFailureCode,
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
 * Bất biến giữ từ F2/F3:
 * - Confirm trước khi bắn (§2.4); dialog KHÔNG đóng được khi đang bắn.
 * - MỘT dialog cho mỗi hàng, mở bằng state (trang 50 hàng không mount 50 cây
 *   dialog sẵn).
 * - Dialog hiện NGUYÊN VĂN review + ảnh: duyệt là đăng nó ra site, không được
 *   bấm mù rồi mới đọc.
 * - Câu hệ quả do `moderateConsequences` (thuần, có test) chọn theo đúng hàng
 *   — không ternary rải trong JSX, và không hứa email cho review không có ai
 *   để gửi.
 * - Lỗi TRẠNG-THÁI-CŨ (REVIEW_NOT_FOUND) và kết cục KHÔNG RÕ (GENERIC): đóng
 *   dialog + toast + refresh — copy hứa "queue has been refreshed" thì UI làm
 *   thật. Còn lại (hết phiên/mất quyền/input hỏng) ở lại dialog.
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
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<ModerateFailureCode | null>(null);
  const [pending, setPending] = useState(false);

  // Nhánh approve/unapprove là DỮ LIỆU, không phải ternary rải trong JSX.
  const copy = approve ? t.approveDialog : t.unapproveDialog;
  const consequences = moderateConsequences(review, approve);
  const noteId = `moderate-note-${review.id}`;

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
    let failureCode: ModerateFailureCode;
    try {
      const result = await moderate({
        id: review.id,
        approve,
        // Note rỗng thì BỎ HẲN field: contract cho `optional` nên gửi chuỗi
        // trắng chỉ để lại một dòng audit `note: ""` vô nghĩa trong
        // ReviewModerationEvent.
        ...(trimmed ? { note: trimmed } : {}),
      });
      if (result.ok) {
        setPending(false);
        onClose();
        // Chiều đọc từ RESPONSE của server, không từ nút vừa bấm: trạng thái
        // cuối cùng là chuyện của server, client chỉ kể lại.
        toast.success(result.approved ? t.toast.approvedTitle : t.toast.unapprovedTitle, {
          description: result.approved
            ? t.toast.approvedBody(review.authorLabel)
            : t.toast.unapprovedBody(review.authorLabel),
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
    // Trạng-thái-cũ VÀ kết cục không rõ đều đóng + toast + refresh: thế giới
    // đã đổi dưới chân dialog, admin phải nhìn queue tươi trước khi làm gì
    // tiếp. Mã còn lại (hết phiên/mất quyền/input hỏng) ở lại dialog vì ngữ
    // cảnh + note đang gõ vẫn còn dùng được sau khi đăng nhập lại.
    if (isStaleStateCode(failureCode) || isUncertainOutcome(failureCode)) {
      onClose();
      toast.error(moderateErrorCopy(failureCode));
      onSettled();
      return;
    }
    setFailure(failureCode);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        {/* Ngữ cảnh của hàng đi THEO dialog: quyết định đăng một bài viết ra
            site mà phải nhớ xem vừa bấm ở hàng nào là công thức bấm nhầm hàng. */}
        <dl className="grid gap-2 text-sm">
          {/* Nguồn review (VERIFIED/CURATED) KHÔNG có dòng riêng ở đây: nó đã
              nói ra qua câu hệ quả email bên dưới ("a curated review has no
              customer account behind it"), và cột Author của bảng có badge. */}
          <ModerateRow label={t.author} value={review.authorLabel} />
          <ModerateRow label={t.rating} value={review.ratingLabel} />
          <ModerateRow
            label={t.tour}
            value={review.tourTitle ?? messages.admin.reviews.list.noTour}
          />
        </dl>

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
            {moderateErrorCopy(failure)}
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
          {/* Gỡ duyệt tô destructive dù nó ĐẢO NGƯỢC được: nó lấy đi một thứ
              đang hiện ngoài site công khai, và làm rating tour tụt ngay lập
              tức — hệ quả ra tới người ngoài, không chỉ trong back office. */}
          <Button
            type="button"
            variant={approve ? 'default' : 'destructive'}
            disabled={pending}
            onClick={submit}
          >
            {pending ? copy.submitting : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Một dòng ngữ cảnh trong dialog xác nhận. */
function ModerateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
