'use client';

import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { CalendarIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon, UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { SectionEyebrow } from './section-eyebrow';

// Convert từ Estate contact.tsx: form trái + ảnh phải. Submit no-op
// (static-first — gắn API enquiry khi trang được chốt).
// Review #30 (A+B+C): A — nới khung lên max-w-7xl như các section khác, ảnh
// bỏ kích thước cố định và bám trọn cột phải; B — overlay "Answer times" mỏng
// thay bằng glass card đáy ảnh chứa 3 hàng liên hệ (email/phone/giờ phản hồi);
// C — field kiểu pixels/ContactSection: icon nằm trong input, viền wrapper
// chuyển primary khi focus-within (shadcn Input/Textarea bỏ viền riêng).
const fieldMotion = {
  initial: { y: 50, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true },
  transition: { type: 'spring' as const, stiffness: 320, damping: 70, mass: 1 },
};

// Kênh liên hệ khớp TopBar — gom về site-config chung khi gắn API
const EMAIL = 'hello@tourism.example';
const PHONE = '+84 24 3826 0126';

// Class gỡ viền/ring riêng của shadcn Input/Textarea khi nằm trong wrapper
// có viền (tránh viền kép — wrapper lo focus ring qua focus-within)
const BARE_FIELD = 'border-0 bg-transparent px-2 shadow-none focus-visible:ring-0';

function ContactField({
  id,
  label,
  icon: Icon,
  multiline = false,
  children,
}: {
  id: string;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  multiline?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <motion.label
        htmlFor={id}
        className="mb-2 text-sm tracking-wide text-muted-foreground uppercase"
        {...fieldMotion}
      >
        {label}
      </motion.label>
      <motion.div
        className={`flex rounded-md border bg-card pl-3 transition-colors focus-within:border-primary/60 ${
          multiline ? 'items-start pt-3' : 'items-center'
        }`}
        {...fieldMotion}
      >
        {Icon ? (
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </motion.div>
    </div>
  );
}

export function Contact() {
  return (
    <section id="contact" className="w-full px-4 py-20 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-stretch gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Cột trái: form */}
        <div className="flex flex-col">
          <SectionEyebrow>Contact</SectionEyebrow>
          <motion.h2
            className="mt-5 max-w-[400px] font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/11"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
          >
            Tell us your dates, <br />
            we’ll draw the route
          </motion.h2>

          <form className="mt-15 flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ContactField id="contact-name" label="Your name" icon={UserIcon}>
                <Input
                  id="contact-name"
                  type="text"
                  placeholder="Michael Anderson"
                  className={BARE_FIELD}
                />
              </ContactField>
              <ContactField id="contact-email" label="Email address" icon={MailIcon}>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="michael@example.com"
                  className={BARE_FIELD}
                />
              </ContactField>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ContactField id="contact-dates" label="Travel dates" icon={CalendarIcon}>
                <Input
                  id="contact-dates"
                  type="text"
                  placeholder="E.g. Oct 12 – Oct 18"
                  className={BARE_FIELD}
                />
              </ContactField>
              <ContactField id="contact-region" label="Region" icon={MapPinIcon}>
                <Input
                  id="contact-region"
                  type="text"
                  placeholder="E.g. Northern Vietnam"
                  className={BARE_FIELD}
                />
              </ContactField>
            </div>

            <ContactField id="contact-message" label="Message" multiline>
              <Textarea
                id="contact-message"
                rows={4}
                placeholder="E.g. Two of us, easy pace, love food markets"
                className={`${BARE_FIELD} resize-none pt-0`}
              />
            </ContactField>

            <motion.div className="mt-2" {...fieldMotion}>
              <button
                type="submit"
                className="cursor-pointer rounded-full bg-primary px-6 py-3.5 text-xs tracking-wide text-primary-foreground uppercase transition-colors duration-200 hover:bg-primary/90"
              >
                Get my itineraries
              </button>
            </motion.div>
          </form>
        </div>

        {/* Cột phải: ảnh bám trọn cột (A) + glass card liên hệ đáy ảnh (B) */}
        <motion.div
          className="group relative min-h-[455px] w-full overflow-hidden rounded-xl"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          <span className="dark block h-full w-full">
            <ImagePlaceholder
              corner
              label="Hội An at night"
              className="h-full w-full transition-transform duration-700 select-none group-hover:scale-105"
            />

            {/* Glass card 3 hàng liên hệ — token đọc theo bảng tối của scope dark */}
            <motion.div
              className="absolute inset-x-6 bottom-6 z-10 flex flex-col gap-3.5 rounded-xl border border-foreground/10 bg-background/55 p-5 text-sm text-foreground backdrop-blur-md"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
            >
              <a
                href={`mailto:${EMAIL}`}
                className="flex items-center gap-3 transition-colors hover:text-primary"
              >
                <MailIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {EMAIL}
              </a>
              <a
                href={`tel:${PHONE.replace(/\s/g, '')}`}
                className="flex items-center gap-3 transition-colors hover:text-primary"
              >
                <PhoneIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {PHONE}
              </a>
              <p className="flex items-center gap-3 text-muted-foreground">
                <ClockIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Mon–Fri within the hour · weekends same day
              </p>
            </motion.div>
          </span>
        </motion.div>
      </div>
    </section>
  );
}
