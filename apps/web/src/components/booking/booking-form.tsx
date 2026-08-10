'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import { api, withBrowserAuth } from '@/lib/api/client';
import type { DepartureVM } from '@/lib/api/tours';
import {
  type BookingFormErrors,
  type BookingFormState,
  buildBookingInput,
  partyCap,
  validateBookingForm,
} from '@/lib/booking-form';
import { departureStatus, formatDateRange, formatMoney } from '@/lib/tours';
import { CheckoutSummary, type CheckoutSummaryTour } from './checkout-summary';
import { Field, FieldError, Stepper } from './form-parts';

/**
 * Form đặt chỗ — chế độ Scheduled departure.
 *
 * KHÔNG có ô nhập thẻ ở bất kỳ đâu: đây là chọn NƠI CHUYỂN HƯỚNG. Sau
 * `bookings.create` thành công, `checkoutUrl` đưa khách sang trang hosted của
 * Stripe/PayPal, và cổng trả về `/checkout/success|cancel`.
 *
 * Kết thúc bằng `window.location.assign`, KHÔNG phải `router.push`: đích tiếp
 * theo nằm ngoài app Next, cùng lý do đã ghi ở `booking-actions.tsx`.
 */
export function BookingForm({
  departures,
  maxGroupSize,
  currency,
  defaultName,
  defaultEmail,
  summaryTour,
}: {
  departures: DepartureVM[];
  maxGroupSize: number;
  currency: string;
  defaultName: string;
  defaultEmail: string;
  summaryTour: CheckoutSummaryTour;
}) {
  const t = messages.booking.form;
  const tp = messages.booking.page;

  // Chọn sẵn đợt CÒN CHỖ đầu tiên, không phải phần tử [0]: đợt đầu có thể đã
  // hết chỗ, và mở trang ra với một đợt không đặt được là dẫn vào ngõ cụt ngay.
  // Cùng luật đã dùng ở `DepartureSelectionProvider` của trang tour detail.
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
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const selected = departures.find((d) => d.id === state.departureId) ?? null;
  const { cap, reason } = partyCap(maxGroupSize, selected?.seatsLeft ?? null);
  const party = state.numAdults + state.numChildren;
  const atCap = party >= cap;

  // Giá của ĐỢT đang chọn, không phải basePrice của tour: đợt có priceOverride
  // riêng. Trẻ em tính CÙNG giá (API: totalAmount(unitPrice, adults + children)).
  const unit = selected ? Number(selected.effectivePrice) : null;
  const total = unit === null ? null : (unit * party).toFixed(2);

  const set = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    // Xoá lỗi của đúng field vừa sửa — giữ các lỗi còn lại để khách thấy hết
    // việc phải làm, thay vì lỗi nhấp nháy từng cái một.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const step = (key: 'numAdults' | 'numChildren', delta: number) => {
    const floor = key === 'numAdults' ? 1 : 0;
    const next = state[key] + delta;
    if (next < floor) return;
    if (delta > 0 && atCap) return;
    set(key, next);
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateBookingForm(state);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const booking = await api.bookings.create(buildBookingInput(state), {
        context: withBrowserAuth(),
      });
      if (!booking.checkoutUrl) {
        setErrors({ departureId: messages.booking.errors.CHECKOUT_FAILED });
        setSubmitting(false);
        return;
      }
      window.location.assign(booking.checkoutUrl);
    } catch {
      // Giữ NGUYÊN dữ liệu đã nhập — khách vừa gõ xong cả form, xoá là tàn nhẫn.
      setErrors({ departureId: messages.booking.errors.CHECKOUT_FAILED });
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start"
      noValidate
    >
      <div className="flex flex-col gap-8">
        {/* Card 1 — Trip details: gộp đợt khởi hành + số người, ĐÚNG nhãn bước
            "hiện tại" của step indicator ở `book/page.tsx` (steps.trip) — khách
            nối được step indicator trên đầu trang với card đầu tiên của form. */}
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold">{tp.steps.trip}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.datesDesc}</p>

          <ul className="mt-4 flex flex-col gap-2">
            {departures.map((d) => {
              const status = departureStatus(d.seatsLeft);
              const soldOut = status === 'sold-out';
              const isSelected = d.id === state.departureId;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    disabled={soldOut}
                    aria-pressed={isSelected}
                    onClick={() => set('departureId', d.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors',
                      isSelected && 'border-primary ring-1 ring-primary',
                      soldOut && 'cursor-default opacity-60',
                      !soldOut && !isSelected && 'hover:bg-muted/50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded-full border',
                        isSelected ? 'border-primary bg-primary' : 'border-input bg-background',
                      )}
                    >
                      {isSelected ? (
                        <span className="size-1.5 rounded-full bg-primary-foreground" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium tabular-nums">
                        {formatDateRange(d.startDate, d.endDate)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {soldOut
                          ? messages.tourDetail.departures.soldOut
                          : status === 'limited'
                            ? messages.tourDetail.departures.seatsLimited(d.seatsLeft)
                            : messages.tourDetail.departures.seatsAvailable(d.seatsLeft)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {d.compareAtPrice ? (
                        <span className="mr-1.5 text-xs text-price-compare line-through tabular-nums">
                          {formatMoney(d.compareAtPrice, currency)}
                        </span>
                      ) : null}
                      <span className="font-heading text-lg font-semibold tabular-nums">
                        {formatMoney(d.effectivePrice, currency)}
                      </span>
                      <span className="block text-xs text-muted-foreground">{tp.perAdult}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {errors.departureId ? <FieldError>{errors.departureId}</FieldError> : null}

          <div className="mt-6 flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">{tp.partyLabel}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stepper
                label={t.adults}
                value={state.numAdults}
                onStep={(d) => step('numAdults', d)}
                minusDisabled={state.numAdults <= 1}
                plusDisabled={atCap}
              />
              <Stepper
                label={t.children}
                value={state.numChildren}
                onStep={(d) => step('numChildren', d)}
                minusDisabled={state.numChildren <= 0}
                plusDisabled={atCap}
              />
            </div>
            {atCap ? (
              // Một dòng bình thản, KHÔNG toast: khách chưa làm gì sai, chỉ là
              // chạm trần. Nói ĐÚNG ràng buộc nào đang bó để họ biết sửa ở đâu.
              <p className="text-sm text-muted-foreground">
                {reason === 'seats' ? t.capBySeats : messages.tourDetail.groupSize(cap)}
              </p>
            ) : null}
          </div>
        </div>

        {/* Card 2 — Lead traveler. */}
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold">{t.travellersHeading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.travellersDesc}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t.contactName} error={errors.contactName}>
              {(id) => (
                <Input
                  id={id}
                  value={state.contactName}
                  onChange={(e) => set('contactName', e.target.value)}
                  aria-invalid={Boolean(errors.contactName)}
                />
              )}
            </Field>
            <Field label={t.contactEmail} error={errors.contactEmail}>
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={state.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  aria-invalid={Boolean(errors.contactEmail)}
                />
              )}
            </Field>
          </div>
          <Field label={t.contactPhone} error={errors.contactPhone}>
            {(id) => (
              <Input
                id={id}
                type="tel"
                value={state.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value)}
                aria-invalid={Boolean(errors.contactPhone)}
                className="mt-4 max-w-xs"
              />
            )}
          </Field>
          <Field label={t.specialRequests} error={errors.specialRequests}>
            {(id) => (
              <Textarea
                id={id}
                value={state.specialRequests}
                onChange={(e) => set('specialRequests', e.target.value)}
                placeholder={t.specialRequestsPlaceholder}
                aria-invalid={Boolean(errors.specialRequests)}
                rows={3}
                className="mt-4"
              />
            )}
          </Field>
        </div>

        {/* Card 3 — Payment method: nhãn "Payment" đúng nhãn bước "kế tiếp"
            (steps.payment) của step indicator — vòng khớp lại giữa header
            trang và card cuối, dù bước thanh toán thật xảy ra ở trang hosted
            của Stripe/PayPal ngay sau khi submit. */}
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold">{t.paymentHeading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.paymentDesc}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ProviderChoice
              selected={state.paymentProvider === 'STRIPE'}
              name={t.stripe}
              hint={t.stripeHint}
              onSelect={() => set('paymentProvider', 'STRIPE')}
            />
            <ProviderChoice
              selected={state.paymentProvider === 'PAYPAL'}
              name={t.paypal}
              hint={t.paypalHint}
              onSelect={() => set('paymentProvider', 'PAYPAL')}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t.trustLine}</p>
        </div>
      </div>

      {/* Cột phải: card tóm tắt đơn, dính khi cuộn ở desktop. Trên mobile lên
          TRƯỚC form (`order-first`) — khách thấy tổng tiền trước khi cuộn qua
          hết ba card bên trái. */}
      <div className="order-first lg:sticky lg:top-24 lg:order-none">
        <CheckoutSummary
          tour={summaryTour}
          departure={selected}
          numAdults={state.numAdults}
          numChildren={state.numChildren}
          currency={currency}
          cta={
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? t.submitting : t.submit}
              {total !== null ? ` · ${formatMoney(total, currency)}` : ''}
            </Button>
          }
        />
      </div>
    </form>
  );
}

function ProviderChoice({
  selected,
  name,
  hint,
  onSelect,
}: {
  selected: boolean;
  name: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-input bg-background',
        )}
      >
        {selected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
