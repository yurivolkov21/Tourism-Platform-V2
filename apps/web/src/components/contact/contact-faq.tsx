'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { FAQ_ITEMS } from '@/mocks/faq';

// Contact §4 — mini-FAQ convert ShadcnSpace FAQ 01 (free): accordion dạng CARD
// RỜI bo 2xl viền, item ĐANG MỞ đổi nền accent, vào so le; nội dung 5 câu
// pre-sales rút gọn kiểu Nexora contact-faq — bản đầy đủ thuộc trang /faq
// (link chờ sẵn). Data mock FAQ_ITEMS — ứng viên schema faqs.

export function ContactFaq() {
  return (
    <section id="faq" className="w-full px-4 py-20 md:px-16 md:py-28">
      <div className="mx-auto flex max-w-3xl flex-col gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <SectionEyebrow>Before you write</SectionEyebrow>
          <motion.h2
            className="max-w-lg font-heading text-3xl leading-tight font-medium text-foreground md:text-4xl"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={SPRING_HEADING}
          >
            Five answers,
            <span className="text-primary-emphasis italic"> saved you an email.</span>
          </motion.h2>
          <motion.p
            className="text-sm text-muted-foreground md:text-base"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, ...SPRING }}
          >
            The questions every traveller asks first —{' '}
            <a href="/faq" className="font-medium text-primary-emphasis hover:underline">
              see the full list
            </a>
            .
          </motion.p>
        </div>

        <Accordion className="flex w-full flex-col gap-4">
          {FAQ_ITEMS.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: index * 0.08 }}
            >
              <AccordionItem
                value={faq.question}
                className="rounded-2xl border px-6 transition-colors data-open:bg-muted/50"
              >
                <AccordionTrigger className="cursor-pointer py-5 text-left font-heading text-base font-medium hover:no-underline md:text-lg">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
