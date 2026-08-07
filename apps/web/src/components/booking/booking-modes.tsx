'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import type { DepartureVM } from '@/lib/api/tours';
import { BookingForm } from './booking-form';
import { PrivateTripForm } from './private-trip-form';

/**
 * Công tắc giữa hai chế độ của trang đặt chỗ.
 *
 * Mặc định là **Scheduled** khi tour còn đợt đặt được, và tự rơi về **Private**
 * khi không còn — khách không phải tự tìm ra rằng nhánh kia mới là nhánh khả
 * thi. Khi không còn đợt nào thì nút Scheduled bị vô hiệu chứ KHÔNG biến mất:
 * để trống một lựa chọn đã từng có mà không giải thích thì khách tưởng mình
 * nhớ nhầm.
 *
 * Hai nhánh là hai chuyện khác nhau chứ không phải hai bố cục của cùng một
 * form: một bên tạo booking rồi đi thanh toán, một bên gửi câu hỏi và KHÔNG giữ
 * chỗ nào. Vì thế state của chúng tách rời — đổi chế độ không mang dữ liệu sang.
 */
export function BookingModes({
  tourId,
  departures,
  maxGroupSize,
  currency,
  defaultName,
  defaultEmail,
}: {
  tourId: string;
  departures: DepartureVM[];
  maxGroupSize: number;
  currency: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const bookable = departures.filter((d) => d.seatsLeft > 0);
  const canSchedule = bookable.length > 0;
  const [mode, setMode] = useState<'scheduled' | 'private'>(canSchedule ? 'scheduled' : 'private');

  const t = messages.booking.form.modeToggle;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <fieldset
          aria-label={t.label}
          className="inline-flex w-full max-w-sm gap-0.5 rounded-xl border-0 bg-muted p-0.5"
        >
          <ModeButton
            active={mode === 'scheduled'}
            disabled={!canSchedule}
            onClick={() => setMode('scheduled')}
          >
            {messages.booking.form.datesHeading}
          </ModeButton>
          <ModeButton active={mode === 'private'} onClick={() => setMode('private')}>
            {t.label}
          </ModeButton>
        </fieldset>
        <p className="text-sm text-muted-foreground">{canSchedule ? t.hint : t.noDepartures}</p>
      </div>

      {mode === 'scheduled' && canSchedule ? (
        <BookingForm
          departures={departures}
          maxGroupSize={maxGroupSize}
          currency={currency}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
        />
      ) : (
        <PrivateTripForm
          tourId={tourId}
          maxGroupSize={maxGroupSize}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
        />
      )}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
        disabled && 'cursor-default opacity-45',
        !active && !disabled && 'hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
