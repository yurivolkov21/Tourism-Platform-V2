'use client';

import { ENQUIRY_NOTE_MAX_LENGTH } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Label } from '@tourism/ui/components/label';
import { Textarea } from '@tourism/ui/components/textarea';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { isUncertainOutcome } from '@/lib/api/write-error';
import {
  type AddNoteAction,
  type AddNoteFailureCode,
  addNoteErrorCopy,
  isAddNoteStale,
} from '@/lib/enquiries-write';

/**
 * Form thêm note của `/enquiries/[id]` (spec P4c §3-F9) — hành vi ghi thứ hai
 * của vùng, và là hành vi ghi DUY NHẤT của admin không đi qua
 * `ConfirmWriteDialog`.
 *
 * Vì sao KHÔNG confirm (khác retry/refund/decide/setStatus): kit dialog tồn
 * tại để chặn một cú bấm lỡ tay lên thứ khó lấy lại — tiền đã hoàn, một
 * quyết định đã ghi, một trạng thái đã đổi. Thêm một dòng vào thread thì
 * chính đoạn văn admin vừa gõ ĐÃ là bước xác nhận, và một dialog "bạn có
 * chắc muốn gửi đoạn vừa gõ không" chỉ dạy người ta bấm Confirm cho nhanh —
 * đúng thói quen làm hỏng các dialog thật sự quan trọng ở trang này. Bù lại,
 * câu "note là vĩnh viễn, không sửa không xoá" nằm NGAY TRÊN ô nhập, trước
 * khi gõ, chứ không phải trong một dialog hiện ra sau.
 *
 * Ba luật còn lại giữ y hệt các hành vi ghi khác (kit `useConfirmWrite`):
 * `pending` là CỔNG (bấm đúp chỉ bắn một lệnh), `try` chỉ ôm ĐÚNG lời gọi, và
 * mã TRẠNG-THÁI-CŨ / KHÔNG RÕ thì xoá ô nhập… KHÔNG: ở đây mã như vậy GIỮ
 * NGUYÊN đoạn văn và chỉ refresh — mất một đoạn vừa gõ vì một lỗi mạng là
 * cái giá không được phép bắt admin trả (dialog thì không có gì để mất).
 *
 * Component KHÔNG tự import server action: nhận `addNote` từ trang.
 */
const t = messages.admin.enquiries.detail.notes;
const toastCopy = messages.admin.enquiries.addNote.toast;

export function EnquiryNoteForm({ id, addNote }: { id: string; addNote: AddNoteAction }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AddNoteFailureCode | null>(null);

  const trimmed = body.trim();
  const disabled = pending || isRefreshing || trimmed.length === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cổng: bấm đúp / Enter liên tiếp chỉ bắn MỘT lệnh.
    if (pending || trimmed.length === 0) return;
    setPending(true);
    setFailure(null);

    let result: Awaited<ReturnType<AddNoteAction>>;
    try {
      // `try` ôm ĐÚNG lời gọi: mọi thứ sau đây (toast, refresh) ném cũng
      // không được quy thành "note không lưu được".
      result = await addNote({ id, body: trimmed });
    } catch {
      setPending(false);
      setFailure('GENERIC');
      return;
    }
    setPending(false);

    if (result.ok) {
      // Xoá ô CHỈ ở nhánh thành công — đoạn văn đã nằm trong thread.
      setBody('');
      toast.success(toastCopy.title, { description: toastCopy.body });
      startRefresh(() => router.refresh());
      return;
    }

    setFailure(result.code);
    // Trạng-thái-cũ (lead biến mất) hoặc kết cục KHÔNG RÕ: kéo trang tươi về
    // để admin nhìn sự thật trước khi bấm lại — nhưng GIỮ đoạn đã gõ.
    if (isAddNoteStale(result.code) || isUncertainOutcome(result.code)) {
      startRefresh(() => router.refresh());
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label htmlFor={`enquiry-note-${id}`}>{t.label}</Label>
      <Textarea
        id={`enquiry-note-${id}`}
        rows={3}
        maxLength={ENQUIRY_NOTE_MAX_LENGTH}
        placeholder={t.placeholder}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Đếm ký tự đọc độ dài THÔ (đúng thứ `maxLength` chặn), không đọc
            độ dài sau trim — nếu không, gõ tới trần rồi thấy "1998 / 2000"
            mà ô không nhận thêm chữ nào là một câu nói dối nho nhỏ. */}
        <span className="text-xs tabular-nums text-muted-foreground">
          {t.counter(body.length, ENQUIRY_NOTE_MAX_LENGTH)}
        </span>
        <Button type="submit" disabled={disabled} title={trimmed ? undefined : t.emptyHint}>
          {pending ? t.submitting : t.submit}
        </Button>
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {addNoteErrorCopy(failure)}
        </p>
      ) : null}
    </form>
  );
}
