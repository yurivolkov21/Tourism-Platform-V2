'use client';

import { messages } from '@tourism/i18n';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { CircleHelpIcon } from 'lucide-react';
import type { TourDetailVM } from '@/lib/api/tours';

/**
 * MỘT icon cho MỌI câu hỏi. `TourFaqSchema` chỉ có `question` + `answer` —
 * không có trường icon, và ánh xạ icon theo từ khoá ("bike" → xe máy, "food" →
 * bát phở) là thứ đoán đúng ở ba tour đầu rồi đoán sai ở tour thứ 40.
 *
 * `data-icon` giữ nguyên hằng này để test bắt được nếu ai đó thêm ánh xạ theo
 * từng mục.
 */
const FAQ_ICON = 'circle-help';

/**
 * Tab 5 — điều khoản mở sẵn, câu hỏi thì gấp lại.
 *
 * Policy KHÔNG nằm trong accordion: đó là điều khoản tiền và huỷ chuyến, thứ
 * không được giấu sau một cú bấm. FAQ thì ngược lại — người đọc quét tiêu đề
 * rồi mở đúng cái mình cần.
 */
export function GoodToKnowPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.goodToKnow;

  if (tour.policies.length === 0 && tour.faqs.length === 0) return null;

  return (
    <div>
      {tour.policies.length > 0 ? (
        // gap-6 (24) chứ không gap-4: 1104 chỉ chia chẵn cho 3 cột khi gap là
        // bội của 12 — xem chú thích dài ở `overview-panel.tsx`.
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-6">
          {tour.policies.map((policy) => {
            const kindLabel = t.policyKinds[policy.kind];
            // Fixture thật đặt `title` bằng chính tên nhóm ("Cancellation"), và
            // in cả hai là nói cùng một từ hai lần trên hai dòng liền nhau.
            const showKind = kindLabel.toLowerCase() !== policy.title.trim().toLowerCase();
            return (
              <div key={policy.kind} className="rounded-xl border border-border bg-card px-4 py-4">
                {showKind ? (
                  <p className="mb-2 font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
                    {kindLabel}
                  </p>
                ) : null}
                <h3 className="font-heading text-base leading-[22px] font-medium">
                  {policy.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[20px] text-muted-foreground">
                  {policy.body}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {tour.faqs.length > 0 ? (
        <div className={tour.policies.length > 0 ? 'mt-9' : undefined}>
          <p className="font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
            {t.faqHeading}
          </p>
          <Accordion className="mt-4 flex max-w-3xl flex-col gap-3">
            {tour.faqs.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="rounded-xl border border-border bg-card px-4"
              >
                <AccordionTrigger className="items-center gap-3 py-3.5 hover:no-underline">
                  <span
                    data-testid="faq-icon"
                    data-icon={FAQ_ICON}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary-emphasis"
                  >
                    <CircleHelpIcon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm leading-[20px] font-medium">{faq.question}</span>
                </AccordionTrigger>
                {/* Thụt vào 44px = ô icon 32 + khoảng cách 12, để câu trả lời
                    thẳng hàng với mép chữ câu hỏi. */}
                <AccordionContent className="pb-4 pl-11 text-sm leading-[22px] text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : null}
    </div>
  );
}
