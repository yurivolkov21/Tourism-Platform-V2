'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { Input } from '@tourism/ui/components/input';
import {
  CompassIcon,
  CreditCardIcon,
  type LucideIcon,
  PlaneIcon,
  RefreshCwIcon,
  RouteIcon,
  SearchIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { type FaqCategory, filterFaqCategories } from '@/lib/faq-filter';
import { SPRING } from '@/lib/motion';
import { slugify } from '@/lib/slug';

// Ruột trang /faq: ô search + 5 nhóm + accordion card rời — kế thừa nguyên
// style đã chốt ở contact-faq (bo 2xl, item mở đổi nền muted), thêm icon cho
// từng nhóm. Dữ liệu nhận qua props từ server page: import thẳng `messages`
// vào client component sẽ kéo cả catalogue ~83KB chuỗi vào bundle client.
const CATEGORY_ICONS: readonly LucideIcon[] = [
  CreditCardIcon,
  RouteIcon,
  CompassIcon,
  RefreshCwIcon,
  PlaneIcon,
];

export function FaqExplorer({
  categories,
  searchPlaceholder,
  searchLabel,
  noResults,
}: {
  categories: FaqCategory[];
  searchPlaceholder: string;
  searchLabel: string;
  noResults: string;
}) {
  const [query, setQuery] = useState('');
  const groups = filterFaqCategories(categories, query);

  return (
    <div>
      <div className="relative mb-12">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="h-12 rounded-full bg-background pr-4 pl-11 text-sm"
        />
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-pretty text-muted-foreground">{noResults}</p>
      ) : (
        <div className="space-y-14">
          {groups.map((group, groupIndex) => {
            const Icon = CATEGORY_ICONS[groupIndex] ?? CompassIcon;
            return (
              <section key={group.title} id={slugify(group.title)} className="scroll-mt-28">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary-emphasis">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-heading text-xl font-medium text-foreground">
                    {group.title}
                  </h2>
                </div>

                <Accordion className="flex w-full flex-col gap-4">
                  {group.items.map((item, index) => (
                    <motion.div
                      key={item.question}
                      initial={{ y: 30, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ ...SPRING, delay: index * 0.06 }}
                    >
                      <AccordionItem
                        value={item.question}
                        className="rounded-2xl border px-6 transition-colors data-open:bg-muted/50"
                      >
                        <AccordionTrigger className="cursor-pointer py-5 text-left font-heading text-base font-medium hover:no-underline md:text-lg">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    </motion.div>
                  ))}
                </Accordion>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
