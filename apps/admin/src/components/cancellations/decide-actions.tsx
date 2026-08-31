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
  DialogTrigger,
} from '@tourism/ui/components/dialog';
import { Label } from '@tourism/ui/components/label';
import { Textarea } from '@tourism/ui/components/textarea';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { isUncertainOutcome } from '@/lib/api/write-error';
import {
  type DecideAction,
  type DecideFailureCode,
  decideErrorCopy,
} from '@/lib/cancellations-decide';

/**
 * Cụm quyết định của MỘT hàng đang mở trong `/cancellations` (spec P4b
 * §3-F3) — hành vi GHI thứ hai của admin, và approve là money-path trọn gói
 * (refund phần còn lại + booking CANCELLED + nhả ghế, nguyên tử trong một
 * advisory lock phía API).
 *
 * Giữ nguyên các bất biến đã chốt qua review F2 ở `refund-panel.tsx`:
 * - Confirm trước khi bắn (§2.4); dialog KHÔNG đóng được khi đang bắn
 *   (Esc/click ngoài bị nuốt) — đóng được là thông báo lỗi thành tàng hình.
 * - Mọi mã contract hiện NGUYÊN NGHĨA và Ở LẠI dialog cho đọc/sửa tại chỗ.
 * - Kết cục KHÔNG RÕ (GENERIC): đóng dialog + toast + `router.refresh()`, ép
 *   nhìn dữ liệu tươi trước khi thử lại — bấm-lại-mù trên một lệnh đã có thể
 *   chạm provider là công thức refund đúp.
 *
 * KHÁC refund một điểm CÓ CHỦ Ý: chỉ MỘT bước, không phải hai. Dialog refund
 * có bước 1 vì admin phải soạn số tiền; ở đây không có gì để soạn (số tiền do
 * server tính — luôn là phần còn lại), nên bước đầu sẽ chỉ là một màn hình
 * bấm-Next vô nghĩa. Dialog này CHÍNH LÀ bước xác nhận, mở ra đã thấy đủ hệ
 * quả + ngữ cảnh hàng.
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
}

export function DecideActions({
  request,
  decide,
}: {
  request: DecideTarget;
  decide: DecideAction;
}) {
  return (
    // `<fieldset>` (role=group ngầm) chứ không phải div trần: aria-label chỉ
    // có nghĩa trên một role thật, và nhóm hai nút của MỘT hàng cần tên riêng
    // để trình đọc màn hình không đọc ra 20 nút "Approve" giống hệt nhau.
    <fieldset aria-label={t.actionsLabel(request.bookingCode)} className="flex items-center gap-2">
      <DecideDialog request={request} decide={decide} approve />
      <DecideDialog request={request} decide={decide} approve={false} />
    </fieldset>
  );
}

function DecideDialog({
  request,
  decide,
  approve,
}: {
  request: DecideTarget;
  decide: DecideAction;
  /** Nhánh nào — quyết cả copy lẫn giá trị gửi lên contract. */
  approve: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<DecideFailureCode | null>(null);
  const [pending, setPending] = useState(false);

  const copy = approve ? t.approveDialog : t.denyDialog;
  const noteId = `decide-note-${approve ? 'approve' : 'deny'}-${request.id}`;

  function onOpenChange(next: boolean) {
    // Đang bắn thì KHÔNG cho đóng (Esc/click ngoài): reset giữa chừng là
    // thông báo lỗi về sau ghi vào một dialog đã đóng — admin tưởng xong.
    if (pending) return;
    setOpen(next);
    if (!next) {
      setNote('');
      setFailure(null);
    }
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
        setOpen(false);
        setNote('');
        toast.success(result.approved ? t.toast.approvedTitle : t.toast.deniedTitle, {
          description: result.approved
            ? t.toast.approvedBody(result.bookingCode)
            : t.toast.deniedBody(result.bookingCode),
        });
        // Hàng vừa quyết phải rời khỏi trạng thái "đang mở" ngay — sự thật
        // mới do server trả ở lần render sau, client không giữ bản sao nào.
        router.refresh();
        return;
      }
      failureCode = result.code;
    } catch {
      // Action ném (mạng đứt, action chết giữa chừng): không biết lệnh đã tới
      // đâu — cùng lối xử với GENERIC bên dưới.
      failureCode = 'GENERIC';
    }
    setPending(false);
    if (isUncertainOutcome(failureCode)) {
      setOpen(false);
      setNote('');
      // In câu của CHÍNH mã vừa nhận (hôm nay chỉ GENERIC rơi vào nhánh này,
      // nhưng đừng khoá cứng một mã vào một nhánh phân loại).
      toast.error(decideErrorCopy(failureCode));
      router.refresh();
      return;
    }
    setFailure(failureCode);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button type="button" variant={approve ? 'default' : 'outline'} size="sm" />}
      >
        {approve ? t.approve : t.deny}
      </DialogTrigger>
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
function DecideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
