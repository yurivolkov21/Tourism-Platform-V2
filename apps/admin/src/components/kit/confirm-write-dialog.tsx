'use client';

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
import type * as React from 'react';
import { useState } from 'react';
import type { TransportFailureCode } from '@/lib/api/write-error';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * MÁY xác nhận cho MỌI hành vi ghi của admin (kit P4b — sổ nợ ghi ở CHANGELOG
 * 31/08 entry F4): `ModerateDialog` (reviews) và `DecideDialog` (cancellations)
 * chép nhau KHỐI-VỚI-KHỐI — cùng state `pending/failure/note`, cùng guard
 * `onOpenChange`, cùng cái đuôi submit "stale hoặc không rõ → đóng + toast +
 * refresh", cùng `ConfirmRow` giống từng ký tự. Bản thứ ba (F6 export, P4c
 * enquiries…) sẽ là bản chép thứ ba nếu không nâng lên đây.
 *
 * Kit giữ VÒNG ĐỜI một lệnh ghi; vùng giữ phần DOMAIN (copy, ngữ cảnh, hệ
 * quả, input gửi đi, toast thành công). Ranh giới đó là lý do máy này không
 * biết gì về refund/moderation:
 *
 * - Confirm trước khi bắn (§2.4): máy chỉ được mount khi admin đã bấm nút mở.
 * - Dialog KHÔNG đóng được khi đang bắn (Esc/click ngoài): reset giữa chừng
 *   là thông báo lỗi về sau ghi vào một dialog đã đóng — admin tưởng xong.
 * - Bấm hai lần chỉ bắn MỘT lệnh (`pending` là cổng, không phải chỉ để hiện
 *   chữ "Đang…").
 * - BA lối ra cho ba loại kết cục: thành công → toast + đóng + `onSettled`;
 *   mã TRẠNG-THÁI-CŨ (vùng khai qua `isStale`) hoặc kết cục KHÔNG RÕ
 *   (`GENERIC` — luật của kit, mọi vùng như nhau) → đóng + toast lỗi +
 *   `onSettled`; còn lại (thử-lại-được, hết phiên, input hỏng) → ở lại dialog
 *   với alert, vì ngữ cảnh + note đang gõ vẫn còn dùng được.
 * - Note đi tới vùng đã TRIM sẵn; vùng tự quyết gửi hay bỏ hẳn field (contract
 *   của mỗi endpoint khác nhau: `min(1)` hay `optional`).
 */

/** Câu chữ của một lần xác nhận — vùng lấy từ `@tourism/i18n`, kit không tự chế. */
export interface ConfirmWriteCopy {
  title: string;
  body: string;
  /** Câu nói thẳng hệ quả không đảo ngược được — luôn hiện, không tuỳ chọn. */
  warning: string;
  submit: string;
  submitting: string;
  cancel: string;
  /**
   * Vắng (cùng với `noteId`) = lệnh không mang ghi chú — ô note không render
   * (F7 retry). Kiểu props ép HAI thứ đi cùng nhau: có `noteId` thì phải có
   * `noteLabel` (xem `ConfirmWriteDialogProps`).
   */
  noteLabel?: string;
  notePlaceholder?: string;
}

/** Một dòng ngữ cảnh (nhãn · giá trị) trong dialog. Nhãn là duy nhất trong một dialog. */
export interface ConfirmWriteRow {
  label: string;
  value: string;
}

/**
 * Kết cục MỘT lần bấm, do vùng trả về. Nhánh thành công mang sẵn toast vì chỉ
 * vùng mới biết server vừa làm gì (`approved` đọc từ RESPONSE, không từ input
 * đã gửi); nhánh hỏng chỉ mang mã — câu chữ tra sau bằng `errorCopy`.
 */
export type ConfirmWriteResult<Code extends string> =
  | { ok: true; toast: { title: string; description: string } }
  | { ok: false; code: Code | TransportFailureCode };

/**
 * Hai hình thái, phân biệt bằng `noteId` (vòng vá review F7): lệnh CÓ ghi chú
 * (decide/moderate — note là audit) phải có `noteLabel` đi cùng, và `onSubmit`
 * nhận note; lệnh KHÔNG ghi chú (retry) không được lỡ tay để ô biến mất — bản
 * đầu để `noteId?` rời, một typo prop ở decide-actions là textarea biến mất
 * im lặng và mọi quyết định huỷ ghi audit note rỗng trong khi typecheck xanh.
 */
type ConfirmWriteNoteProps<Code extends string> =
  | {
      /** `id` của ô note — mỗi hàng một id, tránh trùng khi nhiều dialog cùng DOM. */
      noteId: string;
      copy: ConfirmWriteCopy & { noteLabel: string };
      /** Bắn lệnh. Nhận note ĐÃ trim (có thể rỗng). Ném ⇒ kit coi như `GENERIC`. */
      onSubmit: (note: string) => Promise<ConfirmWriteResult<Code>>;
    }
  | {
      /** BỎ TRỐNG khi lệnh không có ghi chú (retry outbox F7): kit không render ô. */
      noteId?: undefined;
      copy: ConfirmWriteCopy & { noteLabel?: undefined };
      /** Bắn lệnh — không có note để mà nhận. Ném ⇒ kit coi như `GENERIC`. */
      onSubmit: () => Promise<ConfirmWriteResult<Code>>;
    };

export type ConfirmWriteDialogProps<Code extends string> = ConfirmWriteNoteProps<Code> & {
  rows: ConfirmWriteRow[];
  /** Phần riêng của vùng, nằm giữa ngữ cảnh và ô note (danh sách hệ quả,
   *  nguyên văn review, ảnh đính kèm…). */
  extra?: React.ReactNode;
  /** Nút xác nhận: `destructive` khi lệnh lấy đi thứ đang hiện ra ngoài. */
  submitVariant?: 'default' | 'destructive';
  /** Bề ngang DialogContent — vùng nào in nguyên văn nội dung thì cần rộng hơn. */
  contentClassName?: string;
  /** Mã nào là TRẠNG-THÁI-CŨ (thế giới đã đổi dưới chân dialog) — vùng khai. */
  isStale: (code: Code | TransportFailureCode) => boolean;
  /** Mã → câu cho admin (codec của vùng, xem `createWriteErrorCodec`). */
  errorCopy: (code: Code | TransportFailureCode) => string;
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
};

export function ConfirmWriteDialog<Code extends string>(props: ConfirmWriteDialogProps<Code>) {
  const {
    copy,
    rows,
    extra,
    submitVariant = 'default',
    contentClassName = 'sm:max-w-md',
    isStale,
    errorCopy,
    onClose,
    onSettled,
  } = props;
  const [note, setNote] = useState('');
  // Vòng đời lệnh ghi nằm ở hook dùng chung (vòng vá review F5 — RefundDialog
  // hai-bước của F2 cũng chạy CÙNG máy này qua hook, hết bản chép thứ ba).
  const { pending, failure, onOpenChange, run } = useConfirmWrite<Code>({
    isStale,
    errorCopy,
    onClose,
    onSettled,
  });

  function submit() {
    // Rẽ theo hình thái props: có ô note thì giao note đã trim, không thì
    // gọi trần — TS ép mỗi nhánh khớp đúng chữ ký của `onSubmit` nhánh ấy.
    // So `!== undefined` (không phải truthiness): discriminant của union là
    // `noteId?: undefined`, chuỗi rỗng vẫn là nhánh có note.
    void run(() => (props.noteId !== undefined ? props.onSubmit(note.trim()) : props.onSubmit()));
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        {/* Ngữ cảnh của hàng đi THEO dialog: quyết định một chuyện hệ trọng mà
            phải nhớ xem vừa bấm ở hàng nào là công thức bấm nhầm hàng. */}
        <dl className="grid gap-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-words">{row.value}</dd>
            </div>
          ))}
        </dl>

        {extra}

        {props.noteId ? (
          <div className="grid gap-1.5">
            <Label htmlFor={props.noteId}>{props.copy.noteLabel}</Label>
            <Textarea
              id={props.noteId}
              rows={3}
              maxLength={500}
              placeholder={copy.notePlaceholder}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        ) : null}

        <p className="text-sm text-destructive-emphasis">{copy.warning}</p>

        {failure ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {errorCopy(failure)}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
          <Button type="button" variant={submitVariant} disabled={pending} onClick={submit}>
            {pending ? copy.submitting : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
