import { messages } from '@tourism/i18n';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { cn } from '@tourism/ui/lib/utils';
import { CircleQuestionMarkIcon } from 'lucide-react';
import type { TourDetailVM } from '@/lib/api/tours';
import { orderPolicies, policyEyebrow } from '@/lib/tour-detail';

/**
 * Tab 5 — ba thẻ chính sách trên một hàng, rồi khối FAQ xổ được.
 *
 * Dựng bám `.pol` và `.acc-*` của wireframe. Đây là panel duy nhất render
 * HOÀN TOÀN ở server: không có state nào của riêng nó (accordion là component
 * client tự quản), nên chữ nằm sẵn trong HTML tĩnh cho crawler.
 *
 * MỘT icon dùng chung cho mọi câu hỏi, đúng bản duyệt. Chọn icon theo nội dung
 * từng câu nghe hay hơn nhưng là bịa ngữ nghĩa: không có field nào phân loại
 * câu hỏi, nên icon sẽ do người viết code đoán — và đoán sai thì icon nói một
 * đằng câu hỏi nói một nẻo.
 */
export function GoodToKnowPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.goodToKnow;
  const policies = orderPolicies(tour.policies);

  return (
    <div>
      {policies.length > 0 ? (
        // `.pol` — 3 cột đều, gap 12. Xuống 1 cột ở mobile vì thẻ có văn bản
        // dài; ba cột 13px trên màn hẹp là ba cột chữ vụn.
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy) => {
            const eyebrow = policyEyebrow(t.policyKinds[policy.kind], policy.title);
            return (
              <div
                key={policy.kind + policy.title}
                data-testid="policy-card"
                className="rounded-md border border-border bg-card p-4"
              >
                {eyebrow ? (
                  <p className="font-mono text-[11px] leading-4 tracking-[0.12em] text-muted-foreground uppercase">
                    {eyebrow}
                  </p>
                ) : null}
                {/* Lề trên 6px là khoảng cách VỚI eyebrow; bỏ eyebrow mà giữ
                    lề là để lại 6px chết ở đỉnh thẻ. */}
                <h3
                  className={cn(
                    'mb-2 font-heading text-[17px] leading-6 font-medium text-foreground',
                    eyebrow && 'mt-1.5',
                  )}
                >
                  {policy.title}
                </h3>
                <p className="text-[13px] leading-5 text-muted-foreground">{policy.body}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {tour.faqs.length > 0 ? (
        // Khung 768 giống `.pane.narrow`: khối hỏi–đáp là văn bản thuần, dòng
        // dài quá 768 là đọc mỏi mắt.
        <div className="mt-8 max-w-3xl">
          <p className="mb-3.5 font-mono text-[11px] leading-4 tracking-[0.12em] text-muted-foreground uppercase">
            {t.faqHeading}
          </p>
          {/* `defaultValue={[0]}`: câu đầu mở sẵn, đúng bản duyệt. Khối FAQ đóng
              kín trông như một danh sách nút chết — mở sẵn một câu cho thấy bên
              trong có gì. */}
          <Accordion defaultValue={[0]} className="gap-3">
            {tour.faqs.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={index}
                className="group/faq rounded-md border border-border bg-card px-2.5 data-open:border-primary/35"
              >
                {/* `border-0`: lớp nền của `AccordionTrigger` có
                    `border border-transparent` cho vòng focus, và 1px trên +
                    1px dưới làm mỗi nút cao 58 thay vì 56 của `.acc-btn` — năm
                    câu hỏi thì cả khối dôi 10px. */}
                <AccordionTrigger className="gap-3 rounded-none border-0 px-1 py-3 text-sm leading-5 font-semibold hover:no-underline">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground group-data-open/faq:bg-primary/15 group-data-open/faq:text-primary-emphasis"
                  >
                    <CircleQuestionMarkIcon className="size-4" />
                  </span>
                  <span className="flex-1">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="max-w-160 pr-1 pb-4 pl-12 text-sm leading-[23px] text-muted-foreground">
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
