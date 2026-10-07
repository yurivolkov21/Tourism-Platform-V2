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
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { RadioGroup, RadioGroupItem } from '@tourism/ui/components/radio-group';
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import { useId, useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { ReviewModerationContext } from '@/components/reviews/review-moderation-context';
import {
  composeRejectNote,
  filterRejectReasons,
  REJECT_DETAIL_MAX,
  REJECT_REASONS,
  type RejectReasonKey,
  rejectFormProblem,
} from '@/lib/reject-reasons';
import {
  isStaleStateCode,
  type ModerateAction,
  type ModerateContractCode,
  type ModerateTarget,
  moderateConsequences,
  moderateErrorCopy,
  moderationToast,
  rejectDialogCopy,
} from '@/lib/reviews-moderate';
import { useConfirmWrite } from '@/lib/use-confirm-write';

const t = messages.admin.reviews.moderate;

/**
 * Dialog BÁC một review (ADR-0031 AMEND 1). Không đi qua kit `ConfirmWriteDialog`
 * vì form của nó khác hẳn một ô ghi chú tự do: cột trái là ô tìm và danh sách lý
 * do; cột phải là ngữ cảnh review, câu lý do KHOÁ (khách đọc nguyên văn) và một ô
 * chi tiết tuỳ chọn. Vòng đời lệnh ghi thì vẫn là CÙNG máy của kit — hook
 * `useConfirmWrite` — như `RefundDialog` và các form riêng khác.
 *
 * Vì sao chọn chứ không gõ: gõ tay thì mỗi admin một kiểu, khách đọc những câu
 * không đồng nhất (góp ý của giáo viên hướng dẫn, 28/09). Câu mở, hệ quả và câu
 * cuối nói theo LẦN BÁC (`rejectDialogCopy`): lần đầu tác giả còn sửa được.
 */
export function RejectReviewDialog({
  review,
  moderate,
  onClose,
  onSettled,
}: {
  review: ModerateTarget;
  moderate: ModerateAction;
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  const ids = useId();
  const [query, setQuery] = useState('');
  const [reasonKey, setReasonKey] = useState<RejectReasonKey | null>(null);
  const [detail, setDetail] = useState('');
  /** Chỉ báo thiếu SAU khi người ta đã bấm gửi — không mắng ngay lúc mở (nếp kit). */
  const [touched, setTouched] = useState(false);
  const { pending, failure, onOpenChange, run } = useConfirmWrite<ModerateContractCode>({
    isStale: isStaleStateCode,
    errorCopy: moderateErrorCopy,
    onClose,
    onSettled,
  });

  const reason = REJECT_REASONS.find((entry) => entry.key === reasonKey) ?? null;
  const problem = rejectFormProblem(reason, detail);
  const copy = rejectDialogCopy(review);
  const visible = filterRejectReasons(REJECT_REASONS, query);
  const reasonMissing = touched && problem === 'reason';
  const detailMissing = touched && problem === 'detail';

  function submit() {
    setTouched(true);
    // Thiếu thì KHÔNG bắn. Chặn ở đây chứ không disable nút — một nút mờ không
    // nói vì sao nó mờ (cùng luật kit).
    if (problem !== null || reason === null) return;
    const note = composeRejectNote(reason, detail);
    void run(async () => {
      const result = await moderate({ id: review.id, verdict: 'reject', note });
      if (!result.ok) return { ok: false, code: result.code };
      // Kết cục đọc từ RESPONSE: lệnh đua với người khác thì toast kể đúng thứ đang có.
      return { ok: true, toast: moderationToast(result.state, review.authorLabel) };
    });
  }

  const listLabelId = `${ids}-reasons`;
  const whyLabelId = `${ids}-why`;
  const detailId = `${ids}-detail`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      {/* Rộng hơn mọi dialog moderation khác (trần 64rem ~1024px): cột lý do nằm bên trái.
          `min(…)` giữ lề 1rem mỗi bên như mọi Dialog (review A2-7): `sm:max-w-5xl` trần thắng
          `max-w-[calc(100%-2rem)]` của Dialog từ 640px, hộp sát hai mép ở cửa sổ 640–1024px. */}
      <DialogContent
        className={cn(DIALOG_FRAME, 'sm:max-w-[min(64rem,calc(100%-2rem))]')}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t.rejectDialog.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* Cột trái: tìm + chọn MỘT lý do. Màn hẹp thì nó nằm trên. */}
          <div className="grid content-start gap-2">
            <p id={listLabelId} className="text-sm font-medium">
              {t.reasonPicker.label}
            </p>
            <Input
              type="search"
              aria-label={t.reasonPicker.searchLabel}
              placeholder={t.reasonPicker.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {/* `pr-3` + `scrollbar-gutter: stable`: thanh cuộn có làn riêng, không dính sát
                thẻ lý do, và danh sách lọc còn ngắn không làm các thẻ giật ngang
                (góp ý user 05/10). */}
            <RadioGroup
              aria-labelledby={listLabelId}
              aria-invalid={reasonMissing}
              value={reasonKey}
              onValueChange={(value) => setReasonKey(value as RejectReasonKey)}
              className="max-h-80 gap-1.5 overflow-y-auto pr-3 [scrollbar-gutter:stable] md:max-h-[26rem]"
            >
              {visible.map((entry) => {
                const itemId = `${ids}-reason-${entry.key}`;
                return (
                  // Cả thẻ là vùng bấm: tên in đậm, câu khách đọc in nhỏ bên dưới —
                  // admin so được câu trước khi chọn, không phải đoán từ cái tên.
                  <label
                    key={entry.key}
                    htmlFor={itemId}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-muted"
                  >
                    <RadioGroupItem id={itemId} value={entry.key} className="mt-0.5" />
                    <span className="grid gap-0.5">
                      <span className="font-medium">{entry.label}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {entry.text}
                      </span>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.reasonPicker.noMatch}</p>
            ) : null}
          </div>

          {/* Cột phải: ngữ cảnh của hàng, câu lý do khoá, chi tiết, câu cuối. */}
          <div className="grid min-w-0 content-start gap-4">
            <dl className="grid gap-2 text-sm">
              <LabelValueRow label={t.author} value={review.authorLabel} />
              <LabelValueRow label={t.rating} value={review.ratingLabel} />
              <LabelValueRow
                label={t.tour}
                value={review.tourTitle ?? messages.admin.reviews.list.noTour}
              />
            </dl>

            <ReviewModerationContext
              review={review}
              consequences={moderateConsequences(review, 'reject')}
            />

            <div className="grid gap-1.5">
              <p id={whyLabelId} className="text-sm font-medium">
                {t.reasonLabel}
              </p>
              {/* `<output>` chứ không ô nhập: câu chuẩn KHOÁ, và đổi lựa chọn thì
                  trình đọc màn hình đọc lại câu mới (role status ngầm định). */}
              <output
                aria-labelledby={whyLabelId}
                className={cn(
                  'rounded-md border p-3 text-sm',
                  reason ? 'bg-muted/40' : 'text-muted-foreground',
                  reasonMissing && 'border-destructive',
                )}
              >
                {reason ? reason.text : t.reasonEmpty}
              </output>
              {reasonMissing ? (
                <p role="alert" className="text-sm text-destructive-emphasis">
                  {t.reasonMissing}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={detailId}>
                {reason?.detailRequired ? t.detailLabelRequired : t.detailLabel}
              </Label>
              <Textarea
                id={detailId}
                rows={2}
                maxLength={REJECT_DETAIL_MAX}
                placeholder={t.detailPlaceholder}
                value={detail}
                aria-invalid={detailMissing}
                onChange={(event) => setDetail(event.target.value)}
              />
              {detailMissing ? (
                <p role="alert" className="text-sm text-destructive-emphasis">
                  {t.detailMissing}
                </p>
              ) : null}
            </div>

            <p
              data-tone={copy.warningTone}
              className={cn(
                'text-sm',
                copy.warningTone === 'neutral'
                  ? 'text-muted-foreground'
                  : 'text-destructive-emphasis',
              )}
            >
              {copy.warning}
            </p>

            {failure ? (
              <p role="alert" className="text-sm text-destructive-emphasis">
                {moderateErrorCopy(failure)}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t.cancel}
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={submit}>
            {pending ? t.rejectDialog.submitting : t.rejectDialog.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
