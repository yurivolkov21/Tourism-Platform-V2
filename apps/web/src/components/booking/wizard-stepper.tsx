import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { BOOKING_STEPS, type BookingStep } from '@/lib/booking-form';

/**
 * Thanh bước của wizard đặt chỗ — bốn vạch ngang kèm nhãn dưới.
 *
 * Dáng lấy từ wireframe đã duyệt ([bước 1](../../../../docs/design/mockups/checkout-step1-dates.src.html)),
 * vốn đo bằng `getComputedStyle` trên ReUI `checkout-7`: vạch cao 4px bo tròn,
 * nhãn của bước đang đứng to hơn (16px/600) và đậm màu, các bước khác 14px/600
 * màu phụ.
 *
 * **Vạch TÔ DẦN, không chỉ tô bước hiện tại.** Bước đã qua giữ vạch đậm — đó là
 * hành vi đã bấm thử trên mẫu gốc, và nó biến thanh này thành thước đo tiến độ
 * chứ không phải bốn cái tab rời. Đây cũng là lý do nó KHÔNG bấm được: wizard
 * chặn nhảy cóc để không ai tới bước Pay khi bước Dates còn trống.
 *
 * Màu lấy từ token (luật 6): `bg-foreground` cho vạch đã đi qua, `bg-border` cho
 * vạch chưa tới — KHÔNG phải đen thô như wireframe, vì wireframe nằm ngoài app
 * nên viết giá trị trực tiếp.
 */
export function WizardStepper({ current }: { current: BookingStep }) {
  const t = messages.booking.wizard;
  const currentIndex = BOOKING_STEPS.indexOf(current);

  return (
    <ol aria-label={t.stepsAria} className="grid grid-cols-4 gap-4 sm:w-[576px]">
      {BOOKING_STEPS.map((step, index) => {
        const done = index <= currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step} {...(active ? { 'aria-current': 'step' } : {})}>
            <div
              aria-hidden="true"
              className={cn('h-1 rounded-full', done ? 'bg-foreground' : 'bg-border')}
            />
            <span
              className={cn(
                'mt-2.5 block font-semibold',
                active ? 'text-base text-foreground' : 'text-sm text-muted-foreground',
              )}
            >
              {t.steps[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
