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
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
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
 * Ô NGÀY KHOÁ khi chuyến đã có GHẾ bị giữ, kèm câu giải thích NGAY DƯỚI ô
 * (không phải tooltip): `Booking` giữ bản sao ngày khởi hành và ADR-0041 tính
 * hạn huỷ từ bản sao ấy (spec §2b). Khoá ở đây chỉ là phép lịch sự — server
 * vẫn từ chối thật bằng `DEPARTURE_HAS_BOOKINGS`.
 *
 * Thước là `seatsBooked`, ĐÚNG thước server dùng: một hoàn tiền thiện chí
 * trọn tiền KHÔNG trả ghế (`booking-states.md`), nên đếm theo trạng thái
 * booking sẽ đọc ra 0 trên một chuyến vẫn còn khách thật và mở khoá ô ngày.
 */
const t = messages.admin.departures;

export interface DepartureFormDialogProps<Code extends string> {
  /** Câu chữ của chiều đang mở (thêm hay sửa). */
  copy: { title: string; body: string; submit: string; submitting: string };
  initial: DepartureFormValues;
  /**
   * Ghế đã bị giữ trên chuyến — `0` ở form thêm. Một con số cho HAI luật: nó
   * khoá hai ô ngày (kèm câu giải thích), và nó là sàn của ô tổng ghế.
   */
  seatsBooked: number;
  /**
   * Cảnh báo phụ thuộc thứ NGƯỜI TA ĐANG GÕ — nhận values hiện tại, trả câu
   * cần nói hoặc `undefined`. Hàm chứ không chuỗi, vì cha không nhìn thấy
   * state của form (chỉ dùng ở chiều THÊM: chuyến tạo ra đã quá hạn đặt).
   */
  notice?: (values: DepartureFormValues) => string | undefined;
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
  seatsBooked,
  notice,
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

  const datesLocked = seatsBooked > 0;
  const errors: DepartureFormErrors = showValidation
    ? validateDepartureForm(values, { seatsBooked })
    : {};
  // Hiện NGAY khi gõ đủ hai ngày, không đợi bấm gửi: đây là lời báo trước để
  // người ta đổi ý, không phải lời mắng sau khi đã quyết.
  const noticeMessage = notice?.(values);

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

        {/* `<form>` THẬT chứ không phải một đống input cạnh nhau (F12 vòng
            hai): gõ xong bốn ô rồi bấm Enter là phản xạ của mọi người từng
            điền form, và không có thẻ này thì Enter không làm gì cả. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                id={`${formId}-start`}
                label={t.form.startDate}
                error={errors.startDate}
                hint={datesLocked ? t.form.datesLocked(seatsBooked) : undefined}
              >
                {(describedBy) => (
                  <Input
                    id={`${formId}-start`}
                    type="date"
                    value={values.startDate}
                    disabled={datesLocked || pending}
                    aria-invalid={errors.startDate !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => patch({ startDate: event.target.value })}
                  />
                )}
              </FormField>
              <FormField id={`${formId}-end`} label={t.form.endDate} error={errors.endDate}>
                {(describedBy) => (
                  <Input
                    id={`${formId}-end`}
                    type="date"
                    value={values.endDate}
                    disabled={datesLocked || pending}
                    aria-invalid={errors.endDate !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => patch({ endDate: event.target.value })}
                  />
                )}
              </FormField>
            </div>

            {/* Cảnh báo NGAY dưới hai ô ngày, vì nó nói về chính hai ô ấy — và
              tông destructive vì thứ sắp tạo ra sẽ không bán được. */}
            {noticeMessage ? (
              <p className="text-sm text-destructive-emphasis">{noticeMessage}</p>
            ) : null}

            <FormField
              id={`${formId}-seats`}
              label={t.form.seats}
              error={errors.seats}
              hint={t.form.seatsHint(DEPARTURE_SEATS_MAX)}
            >
              {(describedBy) => (
                <Input
                  id={`${formId}-seats`}
                  // `inputMode` chứ không `type="number"`: mũi tên tăng/giảm và
                  // cuộn-chuột-đổi-số là hai cách sửa nhầm một con số vận hành.
                  inputMode="numeric"
                  value={values.seats}
                  disabled={pending}
                  aria-invalid={errors.seats !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patch({ seats: event.target.value })}
                />
              )}
            </FormField>

            <FormField
              id={`${formId}-price`}
              label={t.form.price}
              error={errors.price}
              hint={t.form.priceHint(basePriceLabel)}
            >
              {(describedBy) => (
                <Input
                  id={`${formId}-price`}
                  inputMode="decimal"
                  placeholder={basePriceLabel}
                  value={values.price}
                  disabled={pending}
                  aria-invalid={errors.price !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patch({ price: event.target.value })}
                />
              )}
            </FormField>
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
            <Button type="submit" disabled={pending}>
              {pending ? copy.submitting : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
