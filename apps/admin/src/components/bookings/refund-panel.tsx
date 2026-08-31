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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tourism/ui/components/table';
import { Textarea } from '@tourism/ui/components/textarea';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatAmount, formatDateTime } from '@/lib/bookings-view';
import {
  canRefund,
  ledgerNote,
  type RefundFailureCode,
  type RefundMode,
  refundErrorCopy,
  sumRefunds,
  validateRefundAmount,
} from '@/lib/refund';

/**
 * Ô "Refunds" của `/bookings/[code]` (spec P4b §3-F2) — hành vi GHI đầu tiên
 * của admin, nên nó là money-path từ đầu tới cuối:
 *
 * - Nút chỉ hiện với trạng thái còn hoàn được (`canRefund`).
 * - Confirm HAI bước (§2.4): bước 1 nhập, bước 2 đọc lại số tiền rồi mới bắn.
 * - Mọi mã lỗi của contract hiện NGUYÊN NGHĨA, mỗi mã một câu.
 * - Sổ cái chỉ in số THẬT do server trả về; không có số thì nói tại sao.
 *
 * Component KHÔNG tự import server action: nó nhận `refund` từ trang (server
 * component truyền action xuống). Nhờ vậy test dựng được panel với một hàm
 * giả mà không phải mock `next/headers`, và panel không dính vào một đường
 * gọi cụ thể nào.
 */
const t = messages.admin.bookings.refund;

/** Phần booking mà panel thật sự cần — nhận subset để test khỏi dựng cả Booking. */
export interface RefundTarget {
  code: string;
  status: BookingStatusValue;
  totalAmount: string;
  currency: string;
  contactName: string;
}

/**
 * Kết quả server action. Cố ý KHÔNG ném lỗi qua ranh giới action: `ORPCError`
 * không sống sót qua đó (Next che lỗi server ở production), nên action phân
 * loại xong mới trả mã xuống — client chỉ việc tra copy.
 */
export type RefundActionResult =
  | { ok: true; status: BookingStatusValue; refunds: Refund[] }
  | { ok: false; code: RefundFailureCode };

export type RefundAction = (input: {
  code: string;
  amount?: string;
  reason?: string;
}) => Promise<RefundActionResult>;

export function RefundPanel({ booking, refund }: { booking: RefundTarget; refund: RefundAction }) {
  /**
   * Sổ cái CHỈ có sau khi chính trang này phát một refund: `admin.bookings
   * .byCode` không đọc bảng refund. `null` = chưa có gì thật để in — lúc đó
   * `ledgerNote` nói theo trạng thái chứ không in số bịa.
   */
  const [ledger, setLedger] = useState<Refund[] | null>(null);
  /** Trạng thái sau refund (server trả về) — prop `booking` còn cũ cho tới khi
   *  `router.refresh()` xong, mà nút refund thì phải tắt NGAY. */
  const [status, setStatus] = useState<BookingStatusValue | null>(null);
  const current = status ?? booking.status;

  function onDone(result: Extract<RefundActionResult, { ok: true }>) {
    // Server action đã gọi `refresh()` của `next/cache`, nên RSC payload mới
    // về CÙNG response của action (một roundtrip — không cần
    // `router.refresh()` ở đây). Hai state này vì vậy chỉ là bản vá tức thì
    // cho khoảnh khắc trước khi payload ấy được áp — và `ledger` còn là chỗ
    // GIỮ sổ cái, thứ mà payload server không mang theo được.
    setLedger(result.refunds);
    setStatus(result.status);
    // Row cuối là row vừa được append (`historyForBooking` sắp xếp createdAt
    // asc) — số tiền THẬT server vừa ghi, kể cả nhánh full mà client không tự
    // tính được.
    const issued = result.refunds.at(-1);
    toast.success(t.toast.title, {
      description: issued ? t.toast.body(formatAmount(issued.amount, issued.currency)) : undefined,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t.heading}</CardTitle>
        {canRefund(current) ? (
          <RefundDialog booking={{ ...booking, status: current }} refund={refund} onDone={onDone} />
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {canRefund(current) ? null : <p className="text-muted-foreground">{t.unavailable}</p>}
        {ledger && ledger.length > 0 ? (
          <LedgerTable refunds={ledger} currency={booking.currency} />
        ) : (
          <p className="text-muted-foreground">{ledgerNote(current)}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Sổ cái refund append-only — chỉ render khi có row THẬT từ server. */
function LedgerTable({ refunds, currency }: { refunds: Refund[]; currency: string }) {
  return (
    <div className="grid gap-2">
      <div className="overflow-hidden rounded-lg border">
        <Table aria-label={t.ledger.heading}>
          <TableHeader>
            <TableRow>
              <TableHead>{t.ledger.amount}</TableHead>
              <TableHead>{t.ledger.issued}</TableHead>
              <TableHead>{t.ledger.reference}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.map((refund) => (
              <TableRow key={refund.id}>
                <TableCell className="tabular-nums">
                  {formatAmount(refund.amount, refund.currency)}
                </TableCell>
                <TableCell>{formatDateTime(refund.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {refund.providerRefundId ?? messages.admin.bookings.detail.empty}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="font-medium tabular-nums">
        {t.ledger.total(formatAmount(sumRefunds(refunds), currency))}
      </p>
    </div>
  );
}

/** Dialog hai bước; state nhập sống ở đây nên đóng dialog là quên sạch. */
function RefundDialog({
  booking,
  refund,
  onDone,
}: {
  booking: RefundTarget;
  refund: RefundAction;
  onDone: (result: Extract<RefundActionResult, { ok: true }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [mode, setMode] = useState<RefundMode>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<RefundFailureCode | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setStep('form');
    setMode('full');
    setAmount('');
    setReason('');
    setFieldError(null);
    setFailure(null);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  /** Bước 1 → 2: validate bản sao luật contract; hỏng thì ở lại, không bắn. */
  function toConfirm() {
    const error = validateRefundAmount({
      mode,
      amount,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
    });
    setFieldError(error ?? null);
    if (error) return;
    setFailure(null);
    setStep('confirm');
  }

  async function submit() {
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      const result = await refund({
        code: booking.code,
        // Nhánh full cố ý KHÔNG gửi amount: server refund đúng phần còn lại
        // (total − SUM(refunds)), con số mà client không có cách nào biết.
        ...(mode === 'partial' ? { amount: amount.trim() } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!result.ok) {
        setFailure(result.code);
        return;
      }
      onOpenChange(false);
      onDone(result);
    } catch {
      // Action ném (mạng đứt, action chết giữa chừng): không biết tiền đã đi
      // hay chưa — câu GENERIC nói đúng chừng đó, không hứa "chưa ghi gì".
      setFailure('GENERIC');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        {t.cta}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t.form.title}</DialogTitle>
              <DialogDescription>{t.form.body}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium">{t.form.modeLabel}</span>
                <RadioGroup
                  value={mode}
                  onValueChange={(next) => {
                    setMode(next as RefundMode);
                    setFieldError(null);
                  }}
                >
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
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.form.amountHint(
                      booking.currency,
                      formatAmount(booking.totalAmount, booking.currency),
                    )}
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
                <p role="alert" className="text-sm text-destructive-emphasis">
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
              <ConfirmRow label={t.confirm.booking} value={booking.code} />
              <ConfirmRow label={t.confirm.customer} value={booking.contactName} />
              <ConfirmRow
                label={t.confirm.amount}
                value={
                  mode === 'partial'
                    ? formatAmount(amount.trim(), booking.currency)
                    : t.confirm.amountFull
                }
              />
              {reason.trim() ? <ConfirmRow label={t.confirm.reason} value={reason.trim()} /> : null}
            </dl>

            <p className="text-sm text-destructive-emphasis">{t.confirm.warning}</p>

            {failure ? (
              <p role="alert" className="text-sm text-destructive-emphasis">
                {refundErrorCopy(failure)}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setStep('form')}
              >
                {t.confirm.back}
              </Button>
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? t.confirm.submitting : t.confirm.submit}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Một dòng tóm tắt ở bước xác nhận. */
function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
