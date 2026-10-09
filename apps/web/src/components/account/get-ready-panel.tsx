import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { StarIcon } from 'lucide-react';
import Link from 'next/link';
import { DayText } from '@/components/account/day-text';
import { PANEL_INSET_X, PanelCard, PanelKicker } from '@/components/account/panel-card';
import { PrepChecklist } from '@/components/account/prep-checklist';
import { type GetReadyStep, type GetReadyView, prepStorageKey } from '@/lib/get-ready';

/**
 * Cột phải của đơn sắp đi (spec P7 §2.4, §2.5, bản vẽ `.gr`): số ngày còn lại cỡ lớn, dòng
 * Departs, các bước đánh số kiểu timeline, chân khối nói ngày mở review (chỉ đơn PAID — không có
 * chân thì không vẽ). Mọi luật (bỏ bước thiếu dữ liệu, đánh số lại) ở `getReadySteps`; component
 * chỉ vẽ.
 *
 * Thẻ tự đệm từng phần (`flush`): chân khối kẻ ngang trọn bề rộng thẻ. Đệm đáy của thân là 4px vì
 * bước cuối đã mang `pb-4` (chỗ của vạch nối giữa các bước) — cộng lại 20px như `py-5` của các khối
 * anh em, có chân hay không (bản trước 22px).
 */
export function GetReadyPanel({ view, bookingCode }: { view: GetReadyView; bookingCode: string }) {
  const t = messages.bookingDetail.getReady;
  return (
    <PanelCard flush aria-labelledby="get-ready-heading">
      <div className={cn(PANEL_INSET_X, 'pt-5 pb-1')}>
        <PanelKicker id="get-ready-heading">{t.heading}</PanelKicker>
        <p className="mt-1.5 flex items-baseline gap-2.5">
          {view.countdown.count === null ? (
            <span className="font-heading text-[46px] leading-none font-semibold">
              {view.countdown.label}
            </span>
          ) : (
            <>
              <span className="font-heading text-[46px] leading-none font-semibold tabular-nums">
                {view.countdown.count}
              </span>
              <span className="text-[15px] font-semibold">{view.countdown.label}</span>
            </>
          )}
        </p>
        <p className="text-[13px] text-muted-foreground">{view.departs}</p>
        <ol className="mt-4">
          {view.steps.map((step) => (
            <StepItem key={step.key} step={step} bookingCode={bookingCode} />
          ))}
        </ol>
      </div>
      {view.footer ? (
        <p
          className={cn(
            'flex items-center gap-2 border-t border-muted py-3 text-[12.5px] text-muted-foreground',
            PANEL_INSET_X,
          )}
        >
          <StarIcon aria-hidden="true" className="size-4 shrink-0" />
          {view.footer}
        </p>
      ) : null}
    </PanelCard>
  );
}

function StepItem({ step, bookingCode }: { step: GetReadyStep; bookingCode: string }) {
  // Bước hạn huỷ còn hạn được làm nổi (`.tl-it.on` của bản vẽ) — đó là việc khách còn làm được.
  const open = step.key === 'freeCancellation' && step.open;
  return (
    <li
      data-step={step.key}
      data-open={open ? '' : undefined}
      className="relative grid grid-cols-[42px_minmax(0,1fr)] gap-3.5 pb-4 before:absolute before:top-[42px] before:bottom-0 before:left-5 before:w-[1.5px] before:bg-border last:before:hidden"
    >
      <span
        data-slot="step-number"
        className={cn(
          'grid size-[42px] place-items-center rounded-full border border-border bg-card font-mono text-sm font-semibold',
          open && 'border-primary text-primary-emphasis ring-3 ring-primary/15',
        )}
      >
        {step.number}
      </span>
      <div className="min-w-0">
        <p className="mt-[3px] text-sm font-semibold">{step.title}</p>
        {/* Điểm hẹn in nguyên văn chữ admin — có thể là một link dán liền: bẻ ở bất kỳ đâu thay vì
            đẩy trang cuộn ngang (review P7 S2). */}
        {step.key === 'freeCancellation' || step.key === 'pickup' ? (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
            {step.text}
          </p>
        ) : null}
        {step.key === 'budget' ? (
          <>
            <PrepChecklist storageKey={prepStorageKey(bookingCode)} items={step.items} />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{step.note}</p>
          </>
        ) : null}
        {step.key === 'dayOne' ? (
          <>
            {step.text ? <DayText text={step.text} clamp className="mt-2" /> : null}
            <Link
              href={step.href}
              className="mt-1.5 inline-block text-[12.5px] font-semibold text-primary-emphasis underline-offset-4 hover:underline"
            >
              {step.linkLabel} →
            </Link>
          </>
        ) : null}
      </div>
    </li>
  );
}
