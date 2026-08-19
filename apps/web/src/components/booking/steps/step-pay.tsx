import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import type { StepShared } from './types';

/**
 * Bước 4 — chọn NƠI CHUYỂN HƯỚNG, không phải nhập thẻ.
 *
 * **Bước này không được có một ô nhập nào.** Đó là quyết định của user (19/08)
 * và cũng là điều luồng thật đòi hỏi: sau `bookings.create`, `checkoutUrl` đưa
 * khách sang trang hosted của Stripe/PayPal, và số thẻ chỉ được gõ ở đó. Mẫu
 * ReUI gốc có sẵn khối Name-on-card/Card-number/CVC — đã gỡ bỏ có chủ đích, và
 * `step-pay.spec.tsx` có một test khẳng định không `input` nào tồn tại ở đây để
 * lần sửa sau không lén dựng lại nó.
 */
export function StepPay({ state, set }: StepShared) {
  const t = messages.booking.form;
  const tw = messages.booking.wizard.pay;

  return (
    <div>
      <h2 className="font-semibold">{tw.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tw.sub}</p>

      <ul className="mt-4 flex flex-col gap-2">
        <li>
          <ProviderChoice
            selected={state.paymentProvider === 'STRIPE'}
            name={t.stripe}
            hint={t.stripeHint}
            onSelect={() => set('paymentProvider', 'STRIPE')}
          />
        </li>
        <li>
          <ProviderChoice
            selected={state.paymentProvider === 'PAYPAL'}
            name={t.paypal}
            hint={t.paypalHint}
            onSelect={() => set('paymentProvider', 'PAYPAL')}
          />
        </li>
      </ul>

      <p className="mt-4 rounded-xl border bg-card p-3.5 text-xs text-muted-foreground">
        {tw.testModeNote}
      </p>
    </div>
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
        'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors',
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
