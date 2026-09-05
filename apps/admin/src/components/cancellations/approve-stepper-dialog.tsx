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
import { BanknoteIcon, FileTextIcon, ScaleIcon, ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { WizardPanel, WizardSteps } from '@/components/kit/wizard-steps';
import { type ApproveRefundContext, policyRefund } from '@/lib/approve-refund';
import { formatAmount, formatCalendarDate, formatDateTime } from '@/lib/bookings-view';
import {
  type DecideAction,
  type DecideContractCode,
  decideErrorCopy,
  isStaleStateCode,
} from '@/lib/cancellations-decide';
import { normalizeAmountInput, validateRefundAmount } from '@/lib/refund';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Stepper approve (ADR-0029 §5, user chốt 04/09) — bốn bước cho MỘT lệnh tiền
 * không đảo ngược được.
 *
 * Vì sao là stepper chứ không phải một dialog xác nhận nữa: approve chạy ĐÚNG
 * MỘT LẦN và làm ba việc cùng lúc (chuyển tiền, huỷ booking, nhả ghế). Nhồi cả
 * bốn thứ người bấm cần biết — yêu cầu nói gì, chính sách cho bao nhiêu, con số
 * cuối là bao nhiêu, và chuyện gì sắp xảy ra — vào một màn hình thì thứ duy
 * nhất được đọc là cái nút. Tách ra bốn bước không làm ai đọc kỹ hơn nếu bước
 * nào cũng rỗng, nên mỗi bước ở đây phải mang MỘT thứ mới:
 *
 * | Bước | Thứ mới nó mang |
 * | --- | --- |
 * | Request | nguyên văn lý do khách viết, và yêu cầu đã chờ bao lâu |
 * | Policy  | căn cứ ra con số: mấy ngày, bậc nào, ân hạn/badge có áp không |
 * | Amount  | quyết định duy nhất của cả luồng — và cảnh báo nó chỉ có một lần |
 * | Confirm | ba hệ quả, và ô ghi lý do khi số tiền lệch bậc |
 *
 * Ba luật của luồng:
 *
 * - **Không nhảy cóc.** Bước chưa tới thì trigger `disabled`; lùi lại thì tự
 *   do. Bấm thẳng sang Confirm mà chưa qua Amount là đúng cái "bấm bậy" mà
 *   stepper sinh ra để chặn.
 * - **Con số hiện trên màn hình LÀ con số gửi đi.** Không có nhánh nào tính
 *   lại lúc submit; `chosenAmount` dùng chung cho cả phần hiển thị lẫn payload.
 * - **Vòng đời lệnh ghi đi qua `useConfirmWrite`** như mọi lệnh ghi khác của
 *   admin (kit F5): cổng `pending`, ba lối ra theo loại kết cục, không có bản
 *   chép thứ hai của máy ấy ở đây.
 *
 * Deny KHÔNG đi qua đây — nó không đụng tiền, không đụng ghế, và bắt bốn bước
 * cho một lệnh vô hại là dạy người ta bấm Next mà không đọc (ADR-0029 §5).
 */
const t = messages.admin.cancellations.decide;
const w = t.approveWizard;

/** Bốn bước, theo thứ tự. `id` đi vào `Stepper` và vào `aria-controls`. */
const STEPS = [
  { id: 'request', title: w.steps.request, icon: <FileTextIcon /> },
  { id: 'policy', title: w.steps.policy, icon: <ScaleIcon /> },
  { id: 'amount', title: w.steps.amount, icon: <BanknoteIcon /> },
  { id: 'confirm', title: w.steps.confirm, icon: <ShieldCheckIcon /> },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/** `id` vùng nội dung — mỗi tab trỏ `aria-controls` vào đây. */
const PANEL_ID = 'approve-wizard-panel';

/** Mọi thứ stepper cần — cắt ĐÚNG chừng này, không nhận cả `AdminBookingDetail`. */
export interface ApproveTarget extends ApproveRefundContext {
  id: string;
  bookingCode: string;
  tourTitle: string;
  customerName: string;
  reason: string;
  currency: string;
}

export function ApproveStepperDialog({
  request,
  decide,
  onClose,
  onSettled,
}: {
  request: ApproveTarget;
  decide: DecideAction;
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  const [step, setStep] = useState<StepId>('request');
  /** Bước xa nhất đã tới — trần của việc nhảy cóc, không bao giờ lùi. */
  const [furthest, setFurthest] = useState(0);
  const [override, setOverride] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [noteTouched, setNoteTouched] = useState(false);

  const { pending, failure, onOpenChange, run, clearFailure } = useConfirmWrite<DecideContractCode>(
    {
      isStale: isStaleStateCode,
      errorCopy: decideErrorCopy,
      onClose,
      onSettled,
    },
  );

  const policy = policyRefund(request);
  const money = (amount: string) => formatAmount(amount, request.currency);

  // Chuẩn hoá TRƯỚC khi validate và TRƯỚC khi gửi, một lần, dùng chung — bàn
  // phím non-US phát ra dấu phẩy thập phân (nếp `refund-panel`).
  const typed = normalizeAmountInput(amountInput);
  const amountError = override
    ? validateRefundAmount({
        mode: 'partial',
        amount: typed,
        remaining: policy.remaining,
        currency: request.currency,
      })
    : undefined;
  /** Con số sẽ gửi đi — CÙNG biến mà bước Confirm in ra. */
  const chosenAmount = override ? typed : policy.amount;
  const noteMissing = override && note.trim().length === 0;

  const index = STEPS.findIndex((entry) => entry.id === step);
  const canAdvance = step !== 'amount' || amountError === undefined;

  function goTo(next: StepId) {
    // Đổi bước là đổi ngữ cảnh: câu lỗi của lần bắn trước không được đi theo.
    clearFailure();
    setStep(next);
    setFurthest((current) =>
      Math.max(
        current,
        STEPS.findIndex((entry) => entry.id === next),
      ),
    );
  }

  function submit() {
    setNoteTouched(true);
    if (noteMissing) return;
    void run(async () => {
      const trimmed = note.trim();
      const result = await decide({
        id: request.id,
        approve: true,
        // LUÔN gửi con số, kể cả khi nó bằng phần dư: bỏ trống nghĩa là "hoàn
        // trọn phần dư" (ADR-0029 §1), tức server sẽ tự quyết một lần nữa thay
        // vì làm đúng thứ admin vừa nhìn thấy.
        refundAmount: chosenAmount,
        // Contract đòi `min(1)` — note rỗng thì BỎ HẲN field, đừng gửi chuỗi
        // trắng rồi ăn 400 ở lớp validate.
        ...(trimmed ? { decisionNote: trimmed } : {}),
      });
      if (!result.ok) return { ok: false, code: result.code };
      // Chiều đọc từ RESPONSE của server, không từ nút vừa bấm.
      return {
        ok: true,
        toast: {
          title: result.approved ? t.toast.approvedTitle : t.toast.deniedTitle,
          description: result.approved
            ? t.toast.approvedBody(result.bookingCode)
            : t.toast.deniedBody(result.bookingCode),
        },
      };
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      {/* Rộng hơn dialog xác nhận thường (`sm:max-w-md`): thanh bốn bước cần
          chỗ để bốn nhãn không xuống dòng. Trần cao + cuộn lấy từ kit. */}
      <DialogContent className={`${DIALOG_FRAME} sm:max-w-xl`} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.approveDialog.title}</DialogTitle>
          <DialogDescription>{t.approveDialog.body}</DialogDescription>
        </DialogHeader>

        <WizardSteps
          steps={STEPS}
          active={step}
          reached={furthest}
          // Đang bắn lệnh thì khoá cả thanh: đổi bước giữa chừng là câu trả lời
          // sắp về ghi vào một ngữ cảnh không còn nữa.
          disabled={pending}
          onSelect={(next) => goTo(next as StepId)}
          panelId={PANEL_ID}
        />

        <WizardPanel stepId={step} panelId={PANEL_ID}>
          {step === 'request' ? <RequestStep request={request} /> : null}
          {step === 'policy' ? (
            <PolicyStep request={request} policy={policy} money={money} />
          ) : null}
          {step === 'amount' ? (
            <AmountStep
              policyAmount={money(policy.amount)}
              remaining={money(policy.remaining)}
              // Đo CON SỐ SẮP GỬI, không đo phần dư của sổ: ca bậc 0% trên booking
              // chưa hoàn gì (ca huỷ muộn thường gặp nhất) có remaining > 0 mà
              // vẫn không chuyển đồng nào — câu "approving still closes the
              // request…" phải hiện ở đó (vòng vá review 05/09).
              nothingLeft={Number(chosenAmount) === 0}
              override={override}
              amountInput={amountInput}
              amountError={amountError}
              onModeChange={(next) => {
                setOverride(next);
                // Bỏ công tắc vượt bậc là bỏ luôn con số đã gõ: giữ lại một số
                // vô hình rồi bật lại công tắc là cách đưa nó vào payload mà
                // không ai nhìn nó lần nữa.
                if (!next) setAmountInput('');
              }}
              onAmountChange={setAmountInput}
            />
          ) : null}
          {step === 'confirm' ? (
            <ConfirmStep
              amount={money(chosenAmount)}
              nothingToRefund={Number(chosenAmount) === 0}
              override={override}
              policyAmount={money(policy.amount)}
              note={note}
              noteId={`approve-note-${request.id}`}
              noteInvalid={noteTouched && noteMissing}
              onNoteChange={setNote}
            />
          ) : null}
        </WizardPanel>

        {failure ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {decideErrorCopy(failure)}
          </p>
        ) : null}

        {/* Ba con: Back trái · tiến độ giữa · Continue phải, đúng dáng
            stepper-03. Trên mobile `DialogFooter` xếp cột NGƯỢC nên nút chính
            lên trên, và dòng tiến độ ẩn đi cho khỏi chen vào giữa hai nút. */}
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              index === 0 ? onOpenChange(false) : goTo(STEPS[index - 1]?.id ?? 'request')
            }
          >
            {index === 0 ? t.cancel : w.back}
          </Button>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {w.progress(index + 1, STEPS.length)}
          </p>
          {step === 'confirm' ? (
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? t.approveDialog.submitting : t.approveDialog.submit}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending || !canAdvance}
              onClick={() => goTo(STEPS[index + 1]?.id ?? 'confirm')}
            >
              {w.next}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bước 1 — nguyên văn thứ khách gửi. Không có lựa chọn nào ở đây, và đó là ý đồ. */
function RequestStep({ request }: { request: ApproveTarget }) {
  const waited = Math.floor((Date.now() - Date.parse(request.requestedAt)) / 86_400_000);
  return (
    <section className="flex flex-col gap-3">
      <StepHeading heading={w.request.heading} body={w.request.body} />
      <dl className="grid gap-2 text-sm">
        <LabelValueRow label={t.booking} value={request.bookingCode} />
        <LabelValueRow label={t.tour} value={request.tourTitle} />
        <LabelValueRow label={t.customer} value={request.customerName} />
        <LabelValueRow
          label={w.request.departure}
          value={formatCalendarDate(request.departureStartDate)}
        />
        <LabelValueRow label={w.request.requestedAt} value={formatDateTime(request.requestedAt)} />
        <LabelValueRow label={t.reason} value={request.reason} />
      </dl>
      <p className="text-sm text-muted-foreground">{w.request.waiting(waited)}</p>
    </section>
  );
}

/** Bước 2 — CĂN CỨ, không phải kết luận: mấy ngày, bậc nào, có lớp phủ nào không. */
function PolicyStep({
  request,
  policy,
  money,
}: {
  request: ApproveTarget;
  policy: ReturnType<typeof policyRefund>;
  money: (amount: string) => string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <StepHeading heading={w.policy.heading} body={w.policy.body} />
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>{w.policy.daysLine(policy.days)}</li>
        <li>{w.policy.band(policy.percent)}</li>
        {policy.inGrace ? <li>{w.policy.grace}</li> : null}
        {policy.badgeApplied && request.freeCancellationDays !== null ? (
          <li>{w.policy.badge(request.freeCancellationDays)}</li>
        ) : null}
        {Number(request.refundedTotal) > 0 ? (
          <li>{w.policy.alreadyRefunded(money(request.refundedTotal))}</li>
        ) : null}
        <li>{w.policy.countedFrom}</li>
      </ul>
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {w.policy.result}
        </p>
        <p className="text-2xl font-semibold tabular-nums">{money(policy.amount)}</p>
        <p className="text-sm text-muted-foreground">
          {w.policy.resultValue(policy.percent, money(policy.amount))}
        </p>
      </div>
    </section>
  );
}

/** Bước 3 — quyết định DUY NHẤT của cả luồng, cộng câu cảnh báo nó chỉ có một lần. */
function AmountStep({
  policyAmount,
  remaining,
  nothingLeft,
  override,
  amountInput,
  amountError,
  onModeChange,
  onAmountChange,
}: {
  policyAmount: string;
  remaining: string;
  nothingLeft: boolean;
  override: boolean;
  amountInput: string;
  amountError: string | undefined;
  onModeChange: (override: boolean) => void;
  onAmountChange: (value: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <StepHeading heading={w.amount.heading} />
      <RadioGroup
        value={override ? 'override' : 'policy'}
        onValueChange={(next) => onModeChange(next === 'override')}
      >
        {/* `id` của Label phải là `<radio-id>-label` — Base UI trỏ
            `aria-labelledby="<id>-label"`, thiếu nó là radio KHÔNG TÊN với
            trình đọc màn hình (nếp đã đo ở `refund-panel`). */}
        <div className="flex items-center gap-2">
          <RadioGroupItem value="policy" id="approve-mode-policy" />
          <Label id="approve-mode-policy-label" htmlFor="approve-mode-policy">
            {`${w.amount.policyOption} — ${policyAmount}`}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="override" id="approve-mode-override" />
          <Label id="approve-mode-override-label" htmlFor="approve-mode-override">
            {w.amount.overrideOption}
          </Label>
        </div>
      </RadioGroup>

      {override ? (
        <div className="grid gap-1.5">
          <Label htmlFor="approve-amount">{w.amount.overrideLabel}</Label>
          <Input
            id="approve-amount"
            // `inputMode` chứ không `type="number"`: tiền là chuỗi thập phân
            // của contract, spinner của number input làm tròn theo locale.
            inputMode="decimal"
            autoComplete="off"
            value={amountInput}
            aria-invalid={amountError !== undefined}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">{w.amount.remainingHint(remaining)}</p>
          <p className="text-sm text-muted-foreground">{w.amount.overrideHint}</p>
          {amountError ? (
            <p role="alert" className="text-sm text-destructive-emphasis">
              {amountError}
            </p>
          ) : null}
        </div>
      ) : null}

      {nothingLeft ? <p className="text-sm text-muted-foreground">{w.amount.zeroNotice}</p> : null}
      <p className="text-sm text-destructive-emphasis">{w.amount.onceWarning}</p>
    </section>
  );
}

/** Bước 4 — con số cuối, ba hệ quả, và ô ghi lý do khi số tiền lệch bậc. */
function ConfirmStep({
  amount,
  nothingToRefund,
  override,
  policyAmount,
  note,
  noteId,
  noteInvalid,
  onNoteChange,
}: {
  amount: string;
  /** Mức 0 (ADR-0029 AMEND 3): KHÔNG gọi gateway — câu hệ quả phải nói thế. */
  nothingToRefund: boolean;
  override: boolean;
  policyAmount: string;
  note: string;
  noteId: string;
  noteInvalid: boolean;
  onNoteChange: (value: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <StepHeading heading={w.confirm.heading} />
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {w.confirm.refundLine}
        </p>
        <p className="text-2xl font-semibold tabular-nums">{amount}</p>
        {override ? (
          <p className="text-sm text-destructive-emphasis">
            {w.confirm.overrideBadge(policyAmount)}
          </p>
        ) : null}
      </div>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>
          {nothingToRefund
            ? t.approveDialog.consequences.noRefund
            : t.approveDialog.consequences.refund(amount)}
        </li>
        <li>{t.approveDialog.consequences.cancelled}</li>
        <li>{t.approveDialog.consequences.seats}</li>
      </ul>

      <div className="grid gap-1.5">
        <Label htmlFor={noteId}>{override ? w.confirm.noteLabelRequired : t.noteLabel}</Label>
        <Textarea
          id={noteId}
          rows={3}
          maxLength={500}
          placeholder={t.notePlaceholder}
          value={note}
          aria-invalid={noteInvalid}
          onChange={(event) => onNoteChange(event.target.value)}
        />
        {noteInvalid ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {w.confirm.noteRequired}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-destructive-emphasis">{t.approveDialog.warning}</p>
    </section>
  );
}

function StepHeading({ heading, body }: { heading: string; body?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-medium">{heading}</h3>
      {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}
