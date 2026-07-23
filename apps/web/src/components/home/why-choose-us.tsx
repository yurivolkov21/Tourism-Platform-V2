'use client';

import {
  BadgeDollarSignIcon,
  CompassIcon,
  HeadsetIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { SectionEyebrow } from './section-eyebrow';

// Convert từ Estate why-choose-us.tsx: accordion trái (mở mục nào thì ảnh phải
// đổi theo mục đó, transition scale+fade), nội dung sang tours.
const ITEMS = [
  {
    icon: CompassIcon,
    title: 'Local guides on every route',
    description:
      'Every journey is led by someone who grew up on it. Paths, meals, and stories come from lived experience — not a script.',
    image: '/mock/sapa.jpg',
  },
  {
    icon: UsersIcon,
    title: 'Small groups, twelve max',
    description:
      'Enough people for stories around the table, few enough for silence on the water. You will know every name by day two.',
    image: '/mock/halong.jpg',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Free cancellation up to 48h',
    description:
      'Plans change. Cancel up to 48 hours before departure for a full refund — no forms, no questions, no phone queue.',
    image: '/mock/hue.jpg',
  },
  {
    icon: BadgeDollarSignIcon,
    title: 'Fair pricing, no hidden fees',
    description:
      'What you pay reaches the people who host you. Every fee is itemized before you book — the price you see is the price you pay.',
    image: '/mock/mekong.jpg',
  },
  {
    icon: HeadsetIcon,
    title: 'Support around the clock',
    description:
      'A real person answers before, during, and after your trip — in your timezone, within the hour.',
    image: '/mock/hoian.jpg',
  },
];

export function WhyChooseUs() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mt-28 w-full bg-muted px-4 py-16 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
        {/* Cột trái: heading + accordion */}
        <div className="flex flex-col">
          <SectionEyebrow>Why tourism</SectionEyebrow>
          <motion.h2
            className="mt-4 max-w-100 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
          >
            Travel Vietnam with people who call it home
          </motion.h2>

          <div className="mt-12 flex w-full flex-col gap-4 md:mt-16">
            {ITEMS.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <motion.div
                  key={item.title}
                  className="overflow-hidden rounded-sm border bg-card"
                  initial={{ y: 150, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: index * 0.15,
                    type: 'spring',
                    stiffness: 320,
                    damping: 70,
                    mass: 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between p-4 text-left transition hover:bg-muted/40 md:px-6 md:py-4"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-4">
                      <item.icon className="size-5 text-primary" aria-hidden="true" />
                      <span className="text-sm text-card-foreground md:text-base">
                        {item.title}
                      </span>
                    </span>
                    {isOpen ? (
                      <MinusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <PlusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </button>

                  {/* Mở/đóng mượt bằng grid-rows transition — giữ nguyên kỹ thuật template */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="p-4 pt-0 text-xs leading-relaxed text-muted-foreground md:px-10 md:text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Cột phải: mô tả + ảnh đổi theo mục đang mở */}
        <div className="flex flex-col justify-between">
          <motion.p
            className="mb-8 max-w-115 text-sm text-muted-foreground md:mt-20 md:text-base"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
          >
            Our local guides bring insider knowledge and personal care to every departure, so your
            only job is to be there.
          </motion.p>

          <motion.div
            className="relative h-102.75 w-121.5 max-w-full overflow-hidden rounded-xl bg-muted shadow-(--shadow-card)"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
          >
            <ImagePlaceholder
              label="Golden Bridge, Đà Nẵng"
              className={`absolute inset-0 h-full w-full transition-all duration-500 ease-in-out ${
                openIndex === null
                  ? 'scale-100 opacity-100'
                  : 'pointer-events-none scale-95 opacity-0'
              }`}
            />
            {ITEMS.map((item, index) => (
              <ImagePlaceholder
                key={item.title}
                label={item.title}
                className={`absolute inset-0 h-full w-full transition-all duration-500 ease-in-out ${
                  openIndex === index
                    ? 'scale-100 opacity-100'
                    : 'pointer-events-none scale-95 opacity-0'
                }`}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
