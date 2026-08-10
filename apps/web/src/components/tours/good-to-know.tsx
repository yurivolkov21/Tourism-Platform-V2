'use client';

import { messages } from '@tourism/i18n';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { Typeset } from '@tourism/ui/components/typeset';
import { groupPoliciesByKind } from '@/lib/tours';
import type { MockPolicyKind } from '@/mocks/types';

type Policy = { kind: MockPolicyKind; title: string; body: string };

/**
 * "Good to know" = FAQ + Policies trong MỘT section.
 *
 * FAQ dùng accordion (câu hỏi ngắn, người đọc quét tiêu đề rồi mở cái mình cần),
 * còn policy thì MỞ SẴN: đó là điều khoản tiền và huỷ chuyến — thứ không được
 * giấu sau một cú bấm. Đây là lý do hai khối cùng section nhưng khác cơ chế.
 *
 * Mảng nào rỗng thì ẩn khối đó; cả hai rỗng thì `page.tsx` đã loại luôn section
 * khỏi danh sách (nên nó cũng biến mất khỏi mục lục OnThisPage).
 */
export function GoodToKnow({
  faqs,
  policies,
}: {
  faqs: { question: string; answer: string }[];
  policies: Policy[];
}) {
  const t = messages.tourDetail;
  // Thứ tự nhóm do groupPoliciesByKind quyết định: Cancellation trước — đó là
  // thứ khách lo nhất. Nhóm rỗng bị loại ở đó luôn.
  const groups = groupPoliciesByKind(policies);

  return (
    <div className="mt-6 space-y-10">
      {faqs.length > 0 ? (
        <div>
          <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            {t.goodToKnow.faqHeading}
          </h3>
          <Accordion className="mt-4 flex w-full flex-col gap-3">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="rounded-2xl border px-5 transition-colors data-open:bg-muted/50"
              >
                <AccordionTrigger className="cursor-pointer py-4 text-left font-heading text-base font-medium hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : null}

      {groups.length > 0 ? (
        <div>
          <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            {t.goodToKnow.policyHeading}
          </h3>
          <div className="mt-4 divide-y divide-border border-t border-border">
            {groups.map((group) => (
              <div key={group.kind} className="py-5">
                <p className="text-xs font-medium tracking-wide text-primary-emphasis uppercase">
                  {t.goodToKnow.policyKinds[group.kind]}
                </p>
                {group.items.map((policy) => (
                  <div key={policy.title} className="mt-2">
                    <h4 className="font-medium text-foreground">{policy.title}</h4>
                    {/* Typeset preset `reading` (ADR-0012) — cùng khuôn chữ với
                        trang pháp lý, vì đây đúng là văn bản điều khoản. */}
                    <Typeset preset="reading" className="mt-1 max-w-[68ch] text-muted-foreground">
                      <p>{policy.body}</p>
                    </Typeset>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
