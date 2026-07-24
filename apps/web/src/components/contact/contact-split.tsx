'use client';

import { Input } from '@tourism/ui/components/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { Separator } from '@tourism/ui/components/separator';
import { Textarea } from '@tourism/ui/components/textarea';
import { CalendarIcon, MailIcon, UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { BARE_FIELD, ContactField, EMAIL, PHONE } from '@/components/home/contact';
import { PARTNERS } from '@/components/home/partners';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { REGIONS } from '@/mocks/regions';

// Contact §2 — section chính, convert ShadcnSpace Contact 01 "Project Inquiry":
// split 2 cột — TRÁI info (eyebrow + heading + Phone/Email/Location + separator
// + mini-marquee "Featured by" tái dùng danh sách Partners), PHẢI form trong
// card viền. Form nâng từ section Home (ContactField icon-in-field tái dùng)
// + MỚI: Select "Region of interest" — Nexora lấy option từ API categories
// (ISR 1h), đây mock từ REGIONS, ghi nợ API khi wire. Submit no-op static-first
// (nợ validate + honeypot + rate-limit đã ghi sổ từ Home).
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

const LOCATION = ['12 Hàng Bạc, Hoàn Kiếm', 'Hà Nội, Vietnam'];

export function ContactSplit() {
  return (
    <section id="enquiry" className="w-full px-4 py-20 md:px-16 md:py-28 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-8 md:gap-0">
        {/* Trái: info */}
        <div className="col-span-12 flex flex-col gap-8 md:col-span-6 md:gap-12">
          <motion.div
            className="flex flex-col gap-5"
            initial={{ x: -40, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={SPRING}
          >
            <SectionEyebrow>We can help</SectionEyebrow>
            <h2 className="max-w-md font-heading text-3xl leading-tight font-medium text-foreground md:text-4xl">
              Let’s plan your dates
              <span className="text-primary italic"> before the seats go.</span>
            </h2>
          </motion.div>

          <motion.div
            className="flex flex-col justify-between gap-6 sm:flex-row"
            initial={{ x: -40, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ...SPRING }}
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Phone</p>
              <a
                href={`tel:${PHONE.replace(/\s/g, '')}`}
                className="text-base font-medium text-primary"
              >
                {PHONE}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <a href={`mailto:${EMAIL}`} className="text-base font-medium text-primary">
                {EMAIL}
              </a>
            </div>
          </motion.div>

          <motion.div
            className="flex flex-col gap-1"
            initial={{ x: -40, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, ...SPRING }}
          >
            <p className="text-sm text-muted-foreground">Headquarters</p>
            <p className="text-base font-medium text-primary">{LOCATION.join(', ')}</p>
          </motion.div>

          <Separator />

          {/* Mini-marquee "Featured by" — tái dùng danh sách + cơ chế marquee nhà */}
          <motion.div
            className="flex flex-col gap-5"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, ...SPRING }}
          >
            <p className="text-sm text-muted-foreground">Featured by</p>
            <div className="relative max-w-md overflow-hidden">
              <div className="animate-marquee-left flex w-max">
                {[false, true].map((hidden) => (
                  <span
                    key={String(hidden)}
                    aria-hidden={hidden || undefined}
                    className="flex shrink-0 items-center"
                  >
                    {PARTNERS.slice(0, 6).map((name) => (
                      <span
                        key={name}
                        className="mr-8 text-sm font-semibold tracking-widest whitespace-nowrap text-muted-foreground/60 uppercase"
                      >
                        {name}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent" />
            </div>
          </motion.div>
        </div>

        <div className="hidden md:col-span-1 md:block" />

        {/* Phải: form trong card viền */}
        <motion.div
          className="col-span-12 md:col-span-5"
          initial={{ x: 40, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, ...SPRING }}
        >
          <form
            className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-(--shadow-card) md:p-8"
            onSubmit={(e) => e.preventDefault()}
          >
            <ContactField id="cp-name" label="Your name" icon={UserIcon}>
              <Input
                id="cp-name"
                type="text"
                placeholder="Michael Anderson"
                className={BARE_FIELD}
              />
            </ContactField>
            <ContactField id="cp-email" label="Email address" icon={MailIcon}>
              <Input
                id="cp-email"
                type="email"
                placeholder="michael@example.com"
                className={BARE_FIELD}
              />
            </ContactField>
            <ContactField id="cp-dates" label="Travel dates" icon={CalendarIcon}>
              <Input
                id="cp-dates"
                type="text"
                placeholder="E.g. Oct 12 – Oct 18"
                className={BARE_FIELD}
              />
            </ContactField>

            {/* Select vùng quan tâm — option mock từ REGIONS (nợ API categories) */}
            <div className="flex flex-col">
              <label
                htmlFor="cp-region"
                className="mb-2 text-sm tracking-wide text-muted-foreground uppercase"
              >
                Region of interest
              </label>
              <Select>
                <SelectTrigger id="cp-region" className="w-full">
                  <SelectValue placeholder="Anywhere in Vietnam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="any">Anywhere in Vietnam</SelectItem>
                    {REGIONS.map((region) => (
                      <SelectItem key={region.key} value={region.key}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <ContactField id="cp-message" label="Message" multiline>
              <Textarea
                id="cp-message"
                rows={4}
                placeholder="E.g. Two of us, easy pace, love food markets"
                className={`${BARE_FIELD} resize-none pt-0`}
              />
            </ContactField>

            <button
              type="submit"
              className="mt-1 cursor-pointer rounded-full bg-primary px-6 py-3.5 text-xs tracking-wide text-primary-foreground uppercase transition-colors duration-200 hover:bg-primary/90"
            >
              Send the enquiry
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
