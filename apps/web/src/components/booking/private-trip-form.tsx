'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Calendar } from '@tourism/ui/components/calendar';
import { Input } from '@tourism/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@tourism/ui/components/popover';
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { classifySubmitError } from '@/lib/api/submit';
import {
  buildPrivateTripPayload,
  type PrivateTripErrors,
  type PrivateTripState,
  validatePrivateTrip,
} from '@/lib/private-trip';
import { formatDate } from '@/lib/tours';
import { Field, FieldError, Stepper } from './form-parts';

/** DatePicker (react-day-picker) chỉ hiểu `Date` object, còn state giữ chuỗi
    `YYYY-MM-DD` — parse/format TAY theo local time, tránh đúng bẫy timezone
    đã ghi ở `formatDateRange`/`formatDate` (`new Date(chuỗi)` diễn giải theo
    UTC rồi lệch ngày ở múi giờ âm). */
function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  // Mượn ĐÚNG string heading của nhánh scheduled (nay là `BookingWizard`) cho hai
  // card dưới đây — chính là việc "đồng nhất ngôn ngữ" user yêu cầu, không
  // phải bịa heading mới nghe giông giống.
  const tp = messages.booking.page;

  const [dateOpen, setDateOpen] = useState(false);
  // Mốc "hôm nay" ở nửa đêm giờ local, dùng chặn ngày quá khứ trên Calendar —
  // CHỈ là ràng buộc UI (không thể bấm), KHÔNG đụng `validatePrivateTrip`:
  // hàm đó giữ nguyên byte theo yêu cầu, và bản thân nó vốn không có ràng
  // buộc ngày nào để "mirror" — startDate rỗng vẫn hợp lệ.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
      {/* Card 1 — Trip details: gộp ngày mong muốn + số người, CÙNG nhãn
          "Trip details" (`tp.steps.trip`) và CÙNG khuôn `rounded-2xl border
          bg-card p-6` mà nhánh scheduled dùng cho card đầu tiên của nhánh
          scheduled — đây chính là chỗ user chê lệch tông. */}
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">{tp.steps.trip}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tpriv.datesDesc}</p>

        <div className="mt-4">
          <Field label={tpriv.startDate} error={errors.startDate}>
            {(id) => (
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      id={id}
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full max-w-xs justify-start font-normal',
                        !state.startDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon />
                      {state.startDate ? formatDate(state.startDate) : tpriv.startDatePlaceholder}
                    </Button>
                  }
                />
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseDateInputValue(state.startDate)}
                    onSelect={(date) => {
                      if (!date) return;
                      set('startDate', toDateInputValue(date));
                      setDateOpen(false);
                    }}
                    disabled={{ before: today }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </Field>
        </div>

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
            <p className="text-sm text-muted-foreground">
              {messages.tourDetail.groupSize(maxGroupSize)}
            </p>
          ) : null}
          {errors.numAdults ? <FieldError>{errors.numAdults}</FieldError> : null}
        </div>
      </div>

      {/* Card 2 — Lead traveler: gộp contact (name/email/phone) + preferences
          (requests) vào MỘT card, CÙNG nhãn "Lead traveler"
          (`tp.leadTravelerHeading`) và khuôn `flex flex-col gap-4 rounded-2xl
          border bg-card p-6` của card 2 nhánh scheduled. Giữ NGUYÊN
          `preferencesHeading`/`preferencesDesc` làm sub-heading cho khối
          requests — nội dung đó vẫn đúng, chỉ đổi chỗ ở (không còn là card
          riêng thứ tư). */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">{tp.leadTravelerHeading}</h2>
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

        <div className="mt-2 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">{tpriv.preferencesHeading}</h3>
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
        </div>
      </div>

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
