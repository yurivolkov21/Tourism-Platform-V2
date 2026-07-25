'use client';

import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
} from '@tourism/ui/components/stepper';
import { BanknoteIcon, ClipboardCheckIcon, SendIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';

// Sơ đồ ba chặng của một yêu cầu hoàn tiền, đặt ngay đầu /cancellation-policy.
// Đây là chỗ DUY NHẤT trong cụm trang pháp lý mà stepper đúng ngữ nghĩa: nội
// dung của trang này vốn LÀ một quy trình tuần tự, khác hẳn /terms — 18 mục
// tra cứu độc lập, nhét vào stepper là mất Ctrl+F, mất anchor và mất bản in.
//
// Cố ý KHÔNG có StepperTrigger: đây là hình minh hoạ, không phải bộ điều
// hướng. Vì thế nav phải nhận role="list" — một `tablist` không chứa tab nào
// là ARIA sai. Mỗi chặng đặt `completed` để cả ba hiển thị đồng đều, thay vì
// chặng 1 sáng còn hai chặng sau mờ như đang chờ tới lượt.
const STAGES = [
  {
    id: 'request',
    title: 'You send the request',
    description:
      'Open the booking under “My bookings” and choose “Request cancellation”, or write to our team.',
    icon: <SendIcon />,
  },
  {
    id: 'review',
    title: 'We review it',
    description:
      'We check the departure date and any supplier costs already committed, then confirm the refundable amount with you.',
    icon: <ClipboardCheckIcon />,
  },
  {
    id: 'refund',
    title: 'The refund is issued',
    description:
      'Money goes back to the original payment method. On this demo site nothing was charged, so nothing is returned.',
    icon: <BanknoteIcon />,
  },
];

export function RefundProcess() {
  return (
    <Reveal>
      <section
        aria-label="How a cancellation is handled"
        className="rounded-2xl border border-border bg-card p-6 md:p-8"
      >
        <p className="mb-6 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          How it works
        </p>

        <Stepper steps={STAGES} orientation="vertical">
          <StepperNav role="list" className="w-full">
            {STAGES.map((stage, index) => (
              <StepperItem
                key={stage.id}
                stepId={stage.id}
                completed
                className="relative items-start"
              >
                <div className="flex items-start gap-4 pb-8 last:pb-0">
                  <StepperIndicator className="rounded-full">{stage.icon}</StepperIndicator>
                  <div className="text-left">
                    <StepperTitle className="text-base">{stage.title}</StepperTitle>
                    <StepperDescription className="mt-1 text-sm leading-relaxed font-normal">
                      {stage.description}
                    </StepperDescription>
                  </div>
                </div>
                {index < STAGES.length - 1 ? (
                  <StepperSeparator className="absolute top-9 left-4 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-2.5rem)] group-data-[orientation=vertical]/stepper-nav:w-px" />
                ) : null}
              </StepperItem>
            ))}
          </StepperNav>
        </Stepper>
      </section>
    </Reveal>
  );
}
