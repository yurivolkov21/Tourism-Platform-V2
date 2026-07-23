'use client';

import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { motion } from 'motion/react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { SectionEyebrow } from './section-eyebrow';

// Convert từ Estate contact.tsx: form trái (label uppercase, field trồi lần
// lượt) + ảnh phải có overlay "key details". Input/Textarea dùng shadcn,
// submit no-op (static-first — gắn API enquiry khi trang được chốt).
const fieldMotion = {
  initial: { y: 50, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true },
  transition: { type: 'spring' as const, stiffness: 320, damping: 70, mass: 1 },
};

function ContactField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <motion.label
        htmlFor={id}
        className="mb-2 text-sm tracking-wide text-muted-foreground uppercase"
        {...fieldMotion}
      >
        {label}
      </motion.label>
      <motion.div {...fieldMotion}>{children}</motion.div>
    </div>
  );
}

export function Contact() {
  return (
    <section id="contact" className="flex w-full items-center justify-center py-20">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16">
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
              <ContactField id="contact-name" label="Your name">
                <Input id="contact-name" type="text" placeholder="Michael Anderson" />
              </ContactField>
              <ContactField id="contact-email" label="Email address">
                <Input id="contact-email" type="email" placeholder="michael@example.com" />
              </ContactField>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ContactField id="contact-dates" label="Travel dates">
                <Input id="contact-dates" type="text" placeholder="E.g. Oct 12 – Oct 18" />
              </ContactField>
              <ContactField id="contact-region" label="Region">
                <Input id="contact-region" type="text" placeholder="E.g. Northern Vietnam" />
              </ContactField>
            </div>

            <ContactField id="contact-message" label="Message">
              <Textarea
                id="contact-message"
                rows={4}
                placeholder="E.g. Two of us, easy pace, love food markets"
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

        {/* Cột phải: ảnh + key details overlay */}
        <motion.div
          className="group relative flex justify-center overflow-hidden"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          <div className="relative h-[455px] w-[382px] overflow-hidden rounded-xl">
            <Image
              src="/mock/hoian.jpg"
              alt="Hội An at night"
              width={382}
              height={455}
              className="h-full w-full object-cover brightness-80 transition-transform duration-700 select-none group-hover:scale-105"
            />
            <div className="absolute bottom-10 left-10 z-10 flex flex-col gap-2.5 text-on-media">
              <span className="text-base">Answer times</span>
              <motion.div
                className="flex flex-col gap-1 text-sm"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
              >
                <p>Monday–Friday: within the hour</p>
                <p>Weekends: same day</p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
