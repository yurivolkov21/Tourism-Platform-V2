'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useState } from 'react';
import { api, withBrowserAuth } from '@/lib/api/client';
import type { DepartureVM } from '@/lib/api/tours';
import {
  BOOKING_STEPS,
  type BookingFormErrors,
  type BookingFormState,
  type BookingStep,
  bookingSubmitErrorCopy,
  buildBookingInput,
  canLeaveStep,
  stepErrors,
} from '@/lib/booking-form';
import { computeBookingTotal } from '@/lib/checkout';
import { formatMoney } from '@/lib/tours';
import { CheckoutSummary, type CheckoutSummaryTour } from './checkout-summary';
import { StepDates } from './steps/step-dates';
import { StepPay } from './steps/step-pay';
import { StepReview } from './steps/step-review';
import { StepTravellers } from './steps/step-travellers';
import { WizardStepper } from './wizard-stepper';

/**
 * Wizard đặt chỗ 4 bước — Dates → Travellers → Review → Pay.
 *
 * Thay `BookingForm` + `BookingModes` (gỡ 19/08). Dựng theo bốn wireframe user
 * duyệt 18/08, xem `docs/design/mockups/checkout-step*.src.html`.
 *
 * **MỘT state cho cả bốn bước, không tách theo bước.** Đây là điều làm nút Back
 * giữ được dữ liệu: đổi bước chỉ đổi phần thân được render, `state` không hề bị
 * tháo. Bốn thân bước cố ý là component KHÔNG state (xem `steps/types.ts`).
 *
 * **State nằm trong `useState`, KHÔNG lên URL.** Bước cuối gọi `bookings.create`
 * một lần rồi rời hẳn trang, nên không có gì đáng deep-link tới; mà đưa lên URL
 * thì phải trả lời câu "ai đó dán link bước 3 cho người khác thì sao".
 *
 * Kết thúc bằng `window.location.assign`, KHÔNG `router.push`: đích tiếp theo
 * nằm ngoài app Next (trang hosted của Stripe/PayPal).
 */
export function BookingWizard({
  departures,
  maxGroupSize,
  currency,
  durationDays,
  defaultName,
  defaultEmail,
  summaryTour,
}: {
  departures: DepartureVM[];
  maxGroupSize: number;
  currency: string;
  durationDays: number;
  defaultName: string;
  defaultEmail: string;
  summaryTour: CheckoutSummaryTour;
}) {
  const t = messages.booking.wizard;

  const [step, setStep] = useState<BookingStep>('dates');
  // Chọn sẵn đợt CÒN CHỖ đầu tiên, không phải phần tử [0]: đợt đầu có thể đã hết
  // chỗ, và mở trang ra với một đợt không đặt được là dẫn vào ngõ cụt ngay.
  const [state, setState] = useState<BookingFormState>({
    departureId: departures.find((d) => d.seatsLeft > 0)?.id ?? null,
    numAdults: 1,
    numChildren: 0,
    contactName: defaultName,
    contactEmail: defaultEmail,
    contactPhone: '',
    specialRequests: '',
    paymentProvider: 'STRIPE',
  });
  // Lỗi chỉ hiện SAU khi khách bấm Continue — hiện ngay lúc mở trang thì bước
  // Travellers đỏ lòm trong khi khách còn chưa gõ chữ nào.
  const [shownErrors, setShownErrors] = useState<BookingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selected = departures.find((d) => d.id === state.departureId) ?? null;
  const total = selected
    ? computeBookingTotal(selected.effectivePrice, state.numAdults, state.numChildren)
    : null;
  const index = BOOKING_STEPS.indexOf(step);
  const isLast = step === 'pay';

  const set = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    // Xoá lỗi của đúng field vừa sửa — giữ các lỗi còn lại để khách thấy hết
    // việc phải làm, thay vì lỗi nhấp nháy từng cái một.
    setShownErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const goBack = () => {
    setSubmitError(null);
    setStep(BOOKING_STEPS[Math.max(0, index - 1)] as BookingStep);
  };

  /** Về đúng bước cần sửa từ link `Edit` của màn Review. */
  const goEdit = (target: BookingStep) => {
    setSubmitError(null);
    setStep(target);
  };

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const booking = await api.bookings.create(buildBookingInput(state), {
        context: withBrowserAuth(),
      });
      if (!booking.checkoutUrl) {
        setSubmitError(messages.booking.errors.CHECKOUT_FAILED);
        setSubmitting(false);
        return;
      }
      window.location.assign(booking.checkoutUrl);
    } catch (error) {
      // Giữ NGUYÊN dữ liệu đã nhập — khách vừa đi hết bốn bước, xoá là tàn nhẫn.
      // Sweep 19/08: nói ĐÚNG lỗi API (hết ghế / đợt đóng / hết phiên /
      // throttle) thay vì gom hết thành "couldn't start the payment session".
      setSubmitError(bookingSubmitErrorCopy(error));
      setSubmitting(false);
    }
  }

  function advance() {
    // Chặn ở BƯỚC HIỆN TẠI, và chỉ lộ lỗi của bước đó — lỗi của bước sau hiện
    // ra lúc này thì khách không sửa được, ô còn chưa render.
    if (!canLeaveStep(step, state)) {
      setShownErrors(stepErrors(step, state));
      return;
    }
    if (isLast) {
      void submit();
      return;
    }
    setStep(BOOKING_STEPS[index + 1] as BookingStep);
  }

  return (
    <div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.meta(durationDays, state.numAdults + state.numChildren)}
          </p>
        </div>
        <WizardStepper current={step} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_352px] lg:gap-0">
        <div className="lg:pr-10">
          {step === 'dates' ? (
            <StepDates
              state={state}
              errors={shownErrors}
              set={set}
              selected={selected}
              currency={currency}
              departures={departures}
            />
          ) : null}
          {step === 'travellers' ? (
            <StepTravellers
              state={state}
              errors={shownErrors}
              set={set}
              selected={selected}
              currency={currency}
              maxGroupSize={maxGroupSize}
            />
          ) : null}
          {step === 'review' ? (
            <StepReview
              state={state}
              errors={shownErrors}
              set={set}
              selected={selected}
              currency={currency}
              durationDays={durationDays}
              onEdit={goEdit}
            />
          ) : null}
          {step === 'pay' ? (
            <StepPay
              state={state}
              errors={shownErrors}
              set={set}
              selected={selected}
              currency={currency}
            />
          ) : null}

          {submitError ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <div className="mt-7 flex items-center justify-between gap-4 border-t pt-5">
            <span className="text-xs text-muted-foreground">{t.secureNote}</span>
            <div className="flex items-center gap-1">
              {index > 0 ? (
                <Button type="button" variant="ghost" onClick={goBack} disabled={submitting}>
                  {t.back}
                </Button>
              ) : null}
              <Button type="button" onClick={advance} disabled={submitting}>
                {isLast
                  ? submitting
                    ? messages.booking.form.submitting
                    : t.payCta(total !== null ? formatMoney(total, currency) : '')
                  : t.continue}
              </Button>
            </div>
          </div>
        </div>

        <aside className="lg:border-l lg:pl-10">
          <div className="lg:sticky lg:top-24">
            <CheckoutSummary
              tour={summaryTour}
              departure={selected}
              numAdults={state.numAdults}
              numChildren={state.numChildren}
              currency={currency}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
