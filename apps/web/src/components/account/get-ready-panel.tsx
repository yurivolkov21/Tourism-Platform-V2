import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { StarIcon } from 'lucide-react';
import Link from 'next/link';
import { PrepChecklist } from '@/components/account/prep-checklist';
import { type GetReadyStep, type GetReadyView, prepStorageKey } from '@/lib/get-ready';

/**
 * Cột phải của đơn sắp đi (spec P7 §2.4, §2.5, bản vẽ `.gr`): số ngày còn lại cỡ lớn, dòng
 * Departs, các bước đánh số kiểu timeline, chân khối nói khi nào mở review. Mọi luật (bỏ bước
 * thiếu dữ liệu, đánh số lại) ở `getReadySteps`; component chỉ vẽ.
 */
export function GetReadyPanel({ view, bookingCode }: { view: GetReadyView; bookingCode: string }) {
  const t = messages.bookingDetail.getReady;
  return (
    <section
      aria-labelledby="get-ready-heading"
      className="rounded-2xl border border-border bg-card"
    >
      <div className="px-6 pt-5 pb-1.5 sm:px-[26px]">
        <h2
          id="get-ready-heading"
          className="text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase"
        >
          {t.heading}
        </h2>
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
      <p className="flex items-center gap-2 border-t border-muted px-6 py-3 text-[12.5px] text-muted-foreground sm:px-[26px]">
        <StarIcon aria-hidden="true" className="size-4 shrink-0" />
        {view.footer}
      </p>
    </section>
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
        {step.key === 'freeCancellation' || step.key === 'pickup' ? (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{step.text}</p>
        ) : null}
        {step.key === 'budget' ? (
          <>
            <PrepChecklist storageKey={prepStorageKey(bookingCode)} items={step.items} />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{step.note}</p>
          </>
        ) : null}
        {step.key === 'dayOne' ? (
          <>
            {step.text ? (
              // Đệm và nền nằm ở lớp bọc, không ở thẻ `line-clamp`: `overflow: hidden` cắt ở mép
              // VÙNG ĐỆM, nên đệm đặt chung chỗ với `line-clamp` thì nửa trên dòng thứ năm lộ ra
              // trong đệm dưới (đo bằng CSS build thật, Task B8).
              <div className="mt-2 rounded-lg bg-muted/55 px-[11px] py-2">
                <p
                  data-slot="day-text"
                  className="line-clamp-4 font-mono text-[11.5px] leading-[1.65] whitespace-pre-line"
                >
                  {step.text}
                </p>
              </div>
            ) : null}
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
