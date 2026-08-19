import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { partyCap } from '@/lib/booking-form';
import { Field, Stepper } from '../form-parts';
import type { StepShared } from './types';

/**
 * Bước 2 — bao nhiêu người, và gửi xác nhận cho ai.
 *
 * Số người nằm ở ĐÂY chứ không ở bước Dates, dù hai thứ có ràng buộc lẫn nhau
 * (`seatsLeft` của đợt bó trần số người). Lý do: tới bước này đợt đã chọn xong
 * nên trần là con số đã biết, còn gộp lên bước 1 thì bước 2 chỉ còn bốn ô liên
 * hệ điền sẵn — một màn gần trống, đúng thứ đã cảnh báo khi chọn wizard.
 *
 * Dòng `childRateNote` là bắt buộc, không phải trang trí: trẻ em tính CÙNG giá
 * người lớn (quyết định 19/08 — không làm cột giá riêng), và im lặng về chuyện
 * đó thì khách chỉ phát hiện lúc nhìn tổng tiền.
 */
export function StepTravellers({
  state,
  errors,
  set,
  selected,
  maxGroupSize,
}: StepShared & { maxGroupSize: number }) {
  const t = messages.booking.form;
  const tw = messages.booking.wizard.travellers;

  const { cap, reason } = partyCap(maxGroupSize, selected?.seatsLeft ?? null);
  const atCap = state.numAdults + state.numChildren >= cap;

  const step = (key: 'numAdults' | 'numChildren', delta: number) => {
    const floor = key === 'numAdults' ? 1 : 0;
    const next = state[key] + delta;
    if (next < floor) return;
    if (delta > 0 && atCap) return;
    set(key, next);
  };

  return (
    <div>
      <h2 className="font-semibold">{tw.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tw.sub}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

      <p className="mt-2 text-sm text-muted-foreground">
        {atCap
          ? // Chạm trần: nói ĐÚNG ràng buộc nào đang bó, vì hai lý do dẫn tới hai
            // lối ra khác nhau (đổi đợt vs bỏ bớt người).
            reason === 'seats'
            ? t.capBySeats
            : messages.tourDetail.groupSize(cap)
          : tw.childRateNote}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

      <div className="mt-4 flex flex-col gap-4">
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
        <Field label={t.specialRequests} error={errors.specialRequests}>
          {(id) => (
            <Textarea
              id={id}
              value={state.specialRequests}
              onChange={(e) => set('specialRequests', e.target.value)}
              placeholder={t.specialRequestsPlaceholder}
              aria-invalid={Boolean(errors.specialRequests)}
              rows={3}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
