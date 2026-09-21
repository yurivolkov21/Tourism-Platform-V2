'use client';

import { DEPARTURE_SEATS_MAX } from '@tourism/contract';
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
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import type { TransportFailureCode } from '@/lib/api/write-error';
import {
  type DepartureFormErrors,
  type DepartureFormValues,
  type DepartureWriteResult,
  departureFormPayload,
  hasFormErrors,
  validateDepartureForm,
} from '@/lib/departures-write';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Form THÊM và SỬA một chuyến (spec P4e-1 F12) — một component cho cả hai
 * chiều: bốn ô giống hệt nhau, chỉ khác câu chữ và lệnh bắn đi. Hai component
 * song sinh là hai chỗ phải nhớ sửa khi thêm một ô.
 *
 * KHÔNG dùng `ConfirmWriteDialog` của kit: máy đó nhận một lệnh đã biết hết
 * tham số và chỉ hỏi "chắc chưa"; ở đây tham số là thứ người ta đang gõ. Nhưng
 * VÒNG ĐỜI lệnh ghi vẫn là của kit, qua hook `useConfirmWrite` — đúng tiền lệ
 * `RefundDialog` (form hai bước cũng chạy trên hook này, không chép máy lần
 * thứ ba).
 *
 * Ô NGÀY KHOÁ khi chuyến đã có booking sống, kèm câu giải thích NGAY DƯỚI ô
 * (không phải tooltip): `Booking` giữ bản sao ngày khởi hành và ADR-0041 tính
 * hạn huỷ từ bản sao ấy (spec §2b). Khoá ở đây chỉ là phép lịch sự — server
 * vẫn từ chối thật bằng `DEPARTURE_HAS_BOOKINGS`.
 */
const t = messages.admin.departures;

export interface DepartureFormDialogProps<Code extends string> {
  /** Câu chữ của chiều đang mở (thêm hay sửa). */
  copy: { title: string; body: string; submit: string; submitting: string };
  initial: DepartureFormValues;
  /**
   * Số booking SỐNG trên chuyến — `0` ở form thêm. Khác 0 thì hai ô ngày khoá
   * lại và câu giải thích hiện ra.
   */
  liveBookingCount: number;
  /** Ghế đã đặt — soi gương luật hạ ghế ngay tại ô, trước khi đi một vòng 409. */
  seatsBooked: number;
  /** Giá gốc của tour, đã format — gợi ý cho ô giá để trống. */
  basePriceLabel: string;
  /** `id` riêng cho mỗi dialog: nhiều hàng cùng DOM, label phải trỏ đúng ô. */
  formId: string;
  isStale: (code: Code | TransportFailureCode) => boolean;
  errorCopy: (code: Code | TransportFailureCode) => string;
  onSubmit: (
    values: ReturnType<typeof departureFormPayload>,
  ) => Promise<DepartureWriteResult<Code>>;
  /** Toast của nhánh thành công — vùng dựng, vì chỉ vùng biết server vừa làm gì. */
  toast: (row: Extract<DepartureWriteResult<Code>, { ok: true }>['row']) => {
    title: string;
    description: string;
  };
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}

export function DepartureFormDialog<Code extends string>({
  copy,
  initial,
  liveBookingCount,
  seatsBooked,
  basePriceLabel,
  formId,
  isStale,
  errorCopy,
  onSubmit,
  toast,
  onClose,
  onSettled,
}: DepartureFormDialogProps<Code>) {
  const [values, setValues] = useState<DepartureFormValues>(initial);
  /**
   * Chỉ mắng SAU lần bấm gửi đầu tiên — và lỗi là DERIVED từ input hiện tại
   * nên gõ sửa xong là câu lỗi tự biến (bài học `RefundDialog` review 31/08:
   * giữ lỗi trong state thì sửa đúng rồi mà câu cũ vẫn treo).
   */
  const [showValidation, setShowValidation] = useState(false);

  const datesLocked = liveBookingCount > 0;
  const errors: DepartureFormErrors = showValidation
    ? validateDepartureForm(values, { seatsBooked })
    : {};

  const { pending, failure, onOpenChange, run, clearFailure } = useConfirmWrite<Code>({
    isStale,
    errorCopy,
    onClose,
    onSettled,
  });

  function patch(next: Partial<DepartureFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    clearFailure();
  }

  function submit() {
    setShowValidation(true);
    // Ô hỏng thì KHÔNG bắn. Chặn ở đây chứ không disable nút — một nút mờ
    // không nói vì sao nó mờ.
    if (hasFormErrors(validateDepartureForm(values, { seatsBooked }))) return;
    void run(async () => {
      const result = await onSubmit(departureFormPayload(values));
      if (!result.ok) return { ok: false, code: result.code };
      return { ok: true, toast: toast(result.row) };
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-md')} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${formId}-start`}
              label={t.form.startDate}
              error={errors.startDate}
              hint={datesLocked ? t.form.datesLocked(liveBookingCount) : undefined}
            >
              <Input
                id={`${formId}-start`}
                type="date"
                value={values.startDate}
                disabled={datesLocked || pending}
                aria-invalid={errors.startDate !== undefined}
                onChange={(event) => patch({ startDate: event.target.value })}
              />
            </Field>
            <Field id={`${formId}-end`} label={t.form.endDate} error={errors.endDate}>
              <Input
                id={`${formId}-end`}
                type="date"
                value={values.endDate}
                disabled={datesLocked || pending}
                aria-invalid={errors.endDate !== undefined}
                onChange={(event) => patch({ endDate: event.target.value })}
              />
            </Field>
          </div>

          <Field
            id={`${formId}-seats`}
            label={t.form.seats}
            error={errors.seats}
            hint={t.form.seatsHint(DEPARTURE_SEATS_MAX)}
          >
            <Input
              id={`${formId}-seats`}
              // `inputMode` chứ không `type="number"`: mũi tên tăng/giảm và
              // cuộn-chuột-đổi-số là hai cách sửa nhầm một con số vận hành.
              inputMode="numeric"
              value={values.seats}
              disabled={pending}
              aria-invalid={errors.seats !== undefined}
              onChange={(event) => patch({ seats: event.target.value })}
            />
          </Field>

          <Field
            id={`${formId}-price`}
            label={t.form.price}
            error={errors.price}
            hint={t.form.priceHint(basePriceLabel)}
          >
            <Input
              id={`${formId}-price`}
              inputMode="decimal"
              placeholder={basePriceLabel}
              value={values.price}
              disabled={pending}
              aria-invalid={errors.price !== undefined}
              onChange={(event) => patch({ price: event.target.value })}
            />
          </Field>
        </div>

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
            {t.form.cancel}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? copy.submitting : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Một ô: nhãn · control · (gợi ý) · (lỗi). Lỗi đứng dưới cùng, `role="alert"`. */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {error}
        </p>
      ) : null}
    </div>
  );
}
