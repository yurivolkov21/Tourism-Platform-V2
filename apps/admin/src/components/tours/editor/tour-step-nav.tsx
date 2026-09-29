'use client';

import { messages } from '@tourism/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tourism/ui/components/tooltip';
import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeTourStep, type TourStepVM } from '@/lib/tour-editor-view';
import { STEP_ICONS } from './step-icons';

/**
 * Thanh bước của khu sửa tour (ADR-0049 §1): sáu icon chia đều một hàng, nối bằng vạch
 * mảnh. Tên bước và dòng trạng thái nằm trong tooltip VÀ trong chữ `sr-only` của link —
 * trình đọc màn hình và máy cảm ứng (không có tooltip) vẫn có tên thật của link.
 *
 * Link thật (`next/link`): hộp hỏi lại của `UnsavedChangesProvider` chặn nó ở pha
 * capture như mọi link. Trạng thái nhận từ nơi dùng (`tourSteps` trên bản ĐÃ LƯU); bước
 * đang mở đọc từ pathname — Departures không phải bước nên không bước nào sáng.
 */
const t = messages.admin.tours.editor;

export function TourStepNav({ slug, steps }: { slug: string; steps: readonly TourStepVM[] }) {
  const active = activeTourStep(usePathname(), slug);

  return (
    <TooltipProvider>
      <nav aria-label={t.tabsLabel} className="rounded-xl border bg-card px-4 py-3 sm:px-8">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const current = step.step === active;
            const last = index === steps.length - 1;
            const Icon = STEP_ICONS[step.step];
            return (
              <li key={step.step} className={cn('flex items-center', !last && 'flex-1')}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        href={step.href}
                        aria-current={current ? 'step' : undefined}
                        data-status={step.status}
                        className={cn(
                          'relative flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                          step.status === 'optional' && 'border-dashed',
                          current &&
                            'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15 hover:text-primary-foreground',
                        )}
                      />
                    }
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                    <StepDot status={step.status} />
                    <span className="sr-only">{t.steps.stepLabel(step.title, step.summary)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="font-medium">{step.title}</span>
                    <span aria-hidden="true" className="opacity-70">
                      ·
                    </span>
                    <span>{step.summary}</span>
                  </TooltipContent>
                </Tooltip>
                {last ? null : (
                  <span aria-hidden="true" className="mx-2 h-px flex-1 bg-border sm:mx-3" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </TooltipProvider>
  );
}

/** Dấu góc dưới-phải: ✓ bước đủ, "!" bước thiếu. Trang trí — chữ `sr-only` đã nói trạng thái. */
function StepDot({ status }: { status: TourStepVM['status'] }) {
  const base =
    'absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border-2 border-card';
  if (status === 'ok') {
    return (
      <span
        aria-hidden="true"
        data-slot="step-dot"
        className={cn(base, 'bg-success text-success-foreground')}
      >
        <CheckIcon className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span
        aria-hidden="true"
        data-slot="step-dot"
        className={cn(base, 'bg-warning text-[10px] font-bold text-warning-foreground')}
      >
        !
      </span>
    );
  }
  return null;
}
