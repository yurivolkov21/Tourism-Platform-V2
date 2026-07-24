'use client';

import { Clock8Icon, MapPinIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { OFFICES } from '@/mocks/offices';

// Contact §3 — convert Nexora ContactLocation: map lớn bo 2xl (placeholder
// static-first — sau này iframe bản đồ thật, ghi chú tại chỗ) + lưới 2 card
// văn phòng (địa chỉ · giờ mở cửa · nút Get directions). Data mock OFFICES —
// ứng viên schema offices.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function ContactLocation() {
  return (
    <section id="visit" className="w-full bg-muted px-4 py-20 md:px-16 md:py-28 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 md:mb-14">
          <SectionEyebrow>Come say hello</SectionEyebrow>
          <motion.h2
            className="max-w-md font-heading text-3xl leading-tight font-medium text-foreground md:text-4xl"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
          >
            Two doors,
            <span className="text-primary italic"> always open.</span>
          </motion.h2>
        </div>

        {/* Map placeholder — thay bằng iframe bản đồ (OSM/Google) khi chốt trang */}
        <motion.div
          className="relative h-90 overflow-hidden rounded-2xl ring-1 ring-border sm:h-110"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING}
        >
          <ImagePlaceholder
            label="Map — Hà Nội HQ & Sa Pa basecamp (iframe bản đồ khi có media)"
            className="h-full w-full"
          />
        </motion.div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {OFFICES.map((office, index) => (
            <motion.div
              key={office.city}
              className="rounded-xl bg-background p-5 shadow-(--shadow-card) ring-1 ring-border sm:p-6"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: index * 0.1 }}
            >
              <h3 className="font-heading text-xl font-semibold text-foreground">
                {office.city}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {office.name}
                </span>
              </h3>
              <div className="mt-3 flex flex-col gap-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPinIcon
                    className="mt-0.5 size-4.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {office.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock8Icon className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-muted-foreground">{office.hours}</span>
                </div>
              </div>
              {/* Nút chỉ đường — trỏ map thật khi có toạ độ */}
              <a
                href="#visit"
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Get directions →
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
