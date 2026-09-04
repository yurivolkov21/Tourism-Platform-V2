'use client';

import type { BookingStatusValue, Refund } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@tourism/ui/components/dialog';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { RadioGroup, RadioGroupItem } from '@tourism/ui/components/radio-group';
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { RefundLedgerTable } from '@/components/bookings/booking-detail-sections';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { formatAmount } from '@/lib/bookings-view';
import {
  canRefund,
  normalizeAmountInput,
  type RefundAction,
  type RefundContractCode,
  type RefundMode,
  refundErrorCopy,
  remainingRefundable,
  validateRefundAmount,
} from '@/lib/refund';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Ô "Refunds" của `/bookings/[code]` (spec P4b §3-F2) — hành vi GHI đầu tiên
 * của admin, money-path từ đầu tới cuối:
 *
 * - PROPS-DRIVEN (review 31/08): sổ cái + refundedTotal + status đều từ server
 *   (`byCode` nay trả ledger thật). KHÔNG có bản sao state client nào đè lên
 *   prop — refund xong thì `router.refresh()` kéo sự thật mới về; bản F1 đầu
 *   giữ `status ?? booking.status` từng đè vĩnh viễn dữ liệu tươi.
 * - Confirm HAI bước (§2.4); dialog KHÔNG đóng được khi đang bắn (Esc/click
 *   ngoài bị nuốt) — đóng được là thông báo lỗi thành tàng hình.
 * - Mọi mã lỗi hiện NGUYÊN NGHĨA. Riêng kết cục KHÔNG RÕ (GENERIC — không
 *   biết đã tới provider chưa): đóng dialog + toast + refresh, ép nhìn sổ
 *   cái tươi trước khi thử lại — bấm-lại-mù là công thức refund đúp, vì
 *   idempotency key phía API đổi theo ledger.
 *
 * Component KHÔNG tự import server action: nhận `refund` từ trang — test dựng
 * panel với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.bookings.refund;

/** Phần booking mà panel thật sự cần — trang cắt ĐÚNG các field này (không
 *  đưa cả AdminBookingDetail qua ranh giới client — có decisionNote nội bộ). */
export interface RefundTarget {
  code: string;
  status: BookingStatusValue;
  totalAmount: string;
  refundedTotal: string;
  /** Có yêu cầu huỷ nào đang `REQUESTED` không — quyết định nút refund có hiện. */
  hasOpenCancellation: boolean;
  currency: string;
  contactName: string;
  refunds: Refund[];
}

export function RefundPanel({ booking, refund }: { booking: RefundTarget; refund: RefundAction }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  // ADR-0029 §AMEND: booking đang có yêu cầu huỷ chờ xử lý thì ĐƯỜNG ĐÚNG là
  // Approve ở `/cancellations/[code]` — chỉ nó mới đóng request, huỷ booking
  // và NHẢ GHẾ. Hoàn đủ tiền bằng nút này để lại request mở và ghế rò vĩnh
  // viễn; đó là bug đã đo được, và ẩn nút là chỗ CHẶN nó tại nguồn.
  const refundable = canRefund(booking.status) && !booking.hasOpenCancellation;
  const remaining = remainingRefundable(booking.totalAmount, booking.refundedTotal);

  /** Sau MỌI kết cục đã-chạm-server: kéo sự thật mới về (ledger, status, trần). */
  function refreshBooking() {
    startRefresh(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t.heading}</CardTitle>
        {refundable ? (
          <RefundDialog
            code={booking.code}
            contactName={booking.contactName}
            currency={booking.currency}
            remaining={remaining}
            disabled={isRefreshing}
            refund={refund}
            onSettled={refreshBooking}
          />
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {refundable ? null : (
          <p className="text-muted-foreground">
            {booking.hasOpenCancellation ? t.openCancellation : t.unavailable}
          </p>
        )}
        {booking.refunds.length > 0 ? (
          <RefundLedgerTable
            refunds={booking.refunds}
            refundedTotal={booking.refundedTotal}
            currency={booking.currency}
          />
        ) : (
          <p className="text-muted-foreground">{t.ledger.none}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Dialog hai bước; state nhập sống ở đây nên đóng dialog là quên sạch. */
function RefundDialog({
  code,
  contactName,
  currency,
  remaining,
  disabled,
  refund,
  onSettled,
}: {
  code: string;
  contactName: string;
  currency: string;
  /** Trần thật: total − refundedTotal, cả hai từ server. */
  remaining: string;
  disabled: boolean;
  refund: RefundAction;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [mode, setMode] = useState<RefundMode>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  /** Chỉ bật sau lần bấm "Review refund" đầu — lỗi validate là DERIVED từ
   *  input hiện tại, nên gõ sửa xong là câu lỗi tự biến (bản đầu giữ lỗi
   *  trong state, sửa đúng rồi mà câu cũ vẫn treo — review 31/08). */
  const [showValidation, setShowValidation] = useState(false);

  // Vòng đời lệnh ghi (pending/failure/ba lối ra) nằm ở hook DÙNG CHUNG với
  // ConfirmWriteDialog — vòng vá review F5: đây từng là bản chép thứ ba bị
  // bỏ quên ngoài kit, ngay trên đường tiền thật. isStale luôn false vì thiết
  // kế F2: mọi mã contract của refund đều đọc/sửa được tại chỗ (kể cả
  // REFUND_FAILED — retryable); chỉ kết cục KHÔNG RÕ mới đóng + refresh
  // (chống refund đúp — idempotency key phía API đổi theo ledger).
  const {
    pending,
    failure,
    onOpenChange: guardedOpenChange,
    run,
    clearFailure,
  } = useConfirmWrite<RefundContractCode>({
    isStale: () => false,
    errorCopy: refundErrorCopy,
    onClose: () => {
      setOpen(false);
      reset();
    },
    onSettled,
  });

  const normalized = normalizeAmountInput(amount);
  const fieldError = showValidation
    ? validateRefundAmount({ mode, amount: normalized, remaining, currency })
    : undefined;

  function reset() {
    setStep('form');
    setMode('full');
    setAmount('');
    setReason('');
    setShowValidation(false);
    clearFailure();
  }

  /** Mở là việc của trigger; đóng đi qua guard của hook (pending thì nuốt). */
  function onOpenChange(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    guardedOpenChange(false);
  }

  /** Bước 1 → 2: validate bản sao luật contract; hỏng thì ở lại, không bắn. */
  function toConfirm() {
    setShowValidation(true);
    const error = validateRefundAmount({ mode, amount: normalized, remaining, currency });
    if (error) return;
    clearFailure();
    setStep('confirm');
  }

  function submit() {
    void run(async () => {
      const result = await refund({
        code,
        // Nhánh full cố ý KHÔNG gửi amount: server refund đúng phần còn lại
        // theo ledger tại thời điểm xử lý — số cuối cùng là của server.
        ...(mode === 'partial' ? { amount: normalized } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!result.ok) return { ok: false, code: result.code };
      // Row cuối là row vừa append (`historyForBooking` sắp xếp createdAt
      // asc) — số tiền THẬT server vừa ghi, kể cả nhánh full.
      const issued = result.refunds.at(-1);
      return {
        ok: true,
        toast: {
          title: t.toast.title,
          description: issued
            ? t.toast.body(formatAmount(issued.amount, issued.currency))
            : undefined,
        },
      };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}
      >
        {t.cta}
      </DialogTrigger>
      {/* Cùng trần chiều cao với kit `ConfirmWriteDialog` (vòng vá review polish
          2 — dialog cao nhất admin từng trôi nút Confirm khỏi viewport). */}
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-md')} showCloseButton={false}>
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t.form.title}</DialogTitle>
              <DialogDescription>{t.form.body}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium">{t.form.modeLabel}</span>
                <RadioGroup value={mode} onValueChange={(next) => setMode(next as RefundMode)}>
                  {/* `id` của Label phải là `<radio-id>-label`: Base UI render
                      radio thành <span role="radio"> và tự trỏ
                      `aria-labelledby="<id>-label"`. Thiếu id đó là trỏ vào
                      hư không — radio thành nút KHÔNG TÊN với trình đọc màn
                      hình (đo được: query theo nhãn không thấy gì). */}
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="full" id="refund-mode-full" />
                    <Label id="refund-mode-full-label" htmlFor="refund-mode-full">
                      {t.form.modeFull}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="partial" id="refund-mode-partial" />
                    <Label id="refund-mode-partial-label" htmlFor="refund-mode-partial">
                      {t.form.modePartial}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {mode === 'partial' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="refund-amount">{t.form.amountLabel}</Label>
                  <Input
                    id="refund-amount"
                    // `inputMode` chứ không `type="number"`: tiền là chuỗi thập
                    // phân của contract, và spinner của number input làm tròn
                    // theo locale — thứ cuối cùng ta muốn ở money-path.
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    aria-invalid={fieldError != null}
                    aria-describedby={fieldError ? 'refund-amount-error' : undefined}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.form.amountHint(currency, formatAmount(remaining, currency))}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="refund-reason">{t.form.reasonLabel}</Label>
                <Textarea
                  id="refund-reason"
                  rows={3}
                  maxLength={500}
                  placeholder={t.form.reasonPlaceholder}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>

              {fieldError ? (
                <p
                  id="refund-amount-error"
                  role="alert"
                  className="text-sm text-destructive-emphasis"
                >
                  {fieldError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t.form.cancel}
              </Button>
              <Button type="button" onClick={toConfirm}>
                {t.form.next}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.confirm.title}</DialogTitle>
              <DialogDescription>{t.confirm.body}</DialogDescription>
            </DialogHeader>

            <dl className="grid gap-2 text-sm">
              <ConfirmRow label={t.confirm.booking} value={code} />
              <ConfirmRow label={t.confirm.customer} value={contactName} />
              <ConfirmRow
                label={t.confirm.amount}
                value={
                  mode === 'partial' ? formatAmount(normalized, currency) : t.confirm.amountFull
                }
              />
              {reason.trim() ? <ConfirmRow label={t.confirm.reason} value={reason.trim()} /> : null}
            </dl>

            <p className="text-sm text-destructive-emphasis">{t.confirm.warning}</p>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  clearFailure();
                  setStep('form');
                }}
              >
                {t.confirm.back}
              </Button>
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? t.confirm.submitting : t.confirm.submit}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Lỗi server đứng NGOÀI hai nhánh bước — dù đang ở bước nào cũng
            thấy (bản đầu chỉ render ở bước confirm: bấm Back là câu lỗi bốc
            hơi — review 31/08). */}
        {failure ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {refundErrorCopy(failure)}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Một dòng tóm tắt ở bước xác nhận. */
function ConfirmRow({ label, value }: { label: string; value: string }) {
  return <LabelValueRow label={label} value={value} />;
}
