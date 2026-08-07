'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { classifySubmitError } from '@/lib/api/submit';
import {
  buildPrivateTripPayload,
  type PrivateTripErrors,
  type PrivateTripState,
  validatePrivateTrip,
} from '@/lib/private-trip';
import { Field, FieldError, Stepper } from './form-parts';

/**
 * Nhánh "chuyến riêng" — gửi `enquiries.create`, KHÔNG tạo booking.
 *
 * Ba điều phải nói thẳng với khách, vì đây là chỗ dễ hiểu nhầm nhất của cả
 * luồng: không giữ chỗ nào, không thanh toán bây giờ, và giá sẽ báo sau.
 *
 * Gọi API browser-direct KHÔNG kèm auth context (ADR-0016 §2): `enquiries.create`
 * throttle theo IP, giống hệt form contact. Trang này có session vì `proxy.ts`
 * chặn, nhưng bản thân lời gọi không cần.
 */
export function PrivateTripForm({
  tourId,
  maxGroupSize,
  defaultName,
  defaultEmail,
}: {
  tourId: string;
  maxGroupSize: number;
  defaultName: string;
  defaultEmail: string;
}) {
  const t = messages.booking.form;
  const tpriv = t.private;

  const [state, setState] = useState<PrivateTripState>({
    startDate: '',
    numAdults: 2,
    numChildren: 0,
    contactName: defaultName,
    contactEmail: defaultEmail,
    contactPhone: '',
    message: '',
    website: '',
  });
  const [errors, setErrors] = useState<PrivateTripErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const party = state.numAdults + state.numChildren;
  const atCap = party >= maxGroupSize;

  const set = <K extends keyof PrivateTripState>(key: K, value: PrivateTripState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
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
    const found = validatePrivateTrip(state);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await api.enquiries.create(buildPrivateTripPayload(state, tourId));
      setSent(true);
    } catch (error) {
      // Giữ NGUYÊN dữ liệu đã nhập. Throttle và lỗi thật cần hai câu khác nhau:
      // "chờ một phút" là việc khách làm được, "thử lại" thì không.
      setErrors({
        message:
          classifySubmitError(error) === 'throttle'
            ? messages.contactForm.toast.throttle.body
            : messages.booking.errors.CHECKOUT_FAILED,
      });
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex max-w-xl flex-col gap-3 rounded-2xl border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">{tpriv.successTitle}</h2>
        <p className="text-sm text-pretty text-muted-foreground">{tpriv.confirmNote}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-8" noValidate>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{tpriv.datesHeading}</h2>
        <p className="text-sm text-muted-foreground">{tpriv.datesDesc}</p>
        <Field label={tpriv.startDate} error={errors.startDate}>
          {(id) => (
            <Input
              id={id}
              type="date"
              value={state.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className="max-w-xs"
            />
          )}
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{messages.booking.page.partyLabel}</h2>
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
          <p className="text-sm text-muted-foreground">
            {messages.tourDetail.groupSize(maxGroupSize)}
          </p>
        ) : null}
        {errors.numAdults ? <FieldError>{errors.numAdults}</FieldError> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.travellersHeading}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
              className="max-w-xs"
            />
          )}
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{tpriv.preferencesHeading}</h2>
        <p className="text-sm text-muted-foreground">{tpriv.preferencesDesc}</p>
        <Field label={tpriv.requests} error={errors.message}>
          {(id) => (
            <Textarea
              id={id}
              value={state.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder={tpriv.requestsPlaceholder}
              aria-invalid={Boolean(errors.message)}
              rows={4}
            />
          )}
        </Field>
      </section>

      {/* Honeypot: ẩn khỏi mắt VÀ khỏi trình đọc màn hình, không autocomplete.
          Người thật không bao giờ thấy nên không bao giờ điền. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={state.website}
        onChange={(e) => set('website', e.target.value)}
      />

      <div className="flex flex-col gap-3">
        {/* Câu quan trọng nhất của nhánh này — đặt NGAY TRÊN nút, chỗ khách thật
            sự phân vân trước khi bấm. */}
        <p className="text-sm text-muted-foreground">{tpriv.confirmNote}</p>
        <Button type="submit" size="lg" className="w-fit" disabled={submitting}>
          {submitting ? tpriv.submitting : tpriv.submit}
        </Button>
      </div>
    </form>
  );
}
