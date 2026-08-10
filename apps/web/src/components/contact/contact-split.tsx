'use client';

import { messages } from '@tourism/i18n';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { Separator } from '@tourism/ui/components/separator';
import { CompassIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { PARTNERS } from '@/components/home/partners';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { api } from '@/lib/api/client';
import { classifySubmitError, submitToast } from '@/lib/api/submit';
import { buildEnquiryPayload, type ContactFormState, validateEnquiry } from '@/lib/enquiry-form';
import { SPRING } from '@/lib/motion';
import { EMAIL, PHONE } from '@/lib/site';
import { OFFICES } from '@/mocks/offices';
import { REGIONS } from '@/mocks/regions';

// Contact §2 — section chính, convert ShadcnSpace Contact 01 "Project Inquiry":
// split 2 cột — TRÁI info (eyebrow + heading + Phone/Email/Location + separator
// + mini-marquee "Featured by" tái dùng danh sách Partners), PHẢI form trong
// card viền. Form nâng từ section Home (ContactField icon-in-field tái dùng)
// + MỚI: Select "Region of interest" — Nexora lấy option từ API categories
// (ISR 1h), đây mock từ REGIONS, ghi nợ API khi wire (option list, KHÔNG phải
// mapping — mapping đã wire spec 2026-08-03 §2). Submit gọi thẳng
// `api.enquiries.create` (browser-direct, KHÔNG context — ADR-0016 §2), validate
// bằng CHÍNH `CreateEnquiryInputSchema` qua `buildEnquiryPayload`/`validateEnquiry`
// (`lib/enquiry-form.ts`, TDD riêng) + honeypot ẩn field "website".

// Chỗ trống trong "lá thư": gạch dưới nét đứt, chữ điền vào là serif italic
// màu primary — như mực khác màu trên thư in sẵn; focus đổi viền primary.
const LETTER_BLANK =
  'block border-0 border-b-2 border-dashed border-border bg-transparent px-1 py-1 font-heading text-lg italic text-primary-emphasis placeholder:text-muted-foreground/50 placeholder:not-italic outline-none transition-colors focus:border-primary';

// Nhãn-câu-hỏi dẫn từng dòng thư — thường (không uppercase) cho giọng trò chuyện
const LETTER_LABEL = 'text-sm text-muted-foreground';

// Lỗi inline dưới field — không có khuôn "auth-field-error" nào sẵn trong repo
// (chưa có form auth) nên dùng text nhỏ token destructive, cỡ chữ khớp dòng
// P.S. cuối form (text-xs) để không phá tỉ lệ "lá thư".
const LETTER_ERROR = 'text-xs text-destructive';

const INITIAL_STATE: ContactFormState = {
  name: '',
  email: '',
  loves: '',
  dates: '',
  count: '',
  region: '',
  website: '',
};

export function ContactSplit() {
  const [state, setState] = useState<ContactFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<ReturnType<typeof validateEnquiry>>({});
  const [pending, setPending] = useState(false);

  // Submit: validate CLIENT bằng chính schema contract trước (chặn request rõ
  // ràng hỏng); server vẫn là chốt cuối. Honeypot dính → server trả 200 giả,
  // phía client cứ toast success như bình thường (đúng thiết kế bẫy, spec §2).
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateEnquiry(state);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPending(true);
    try {
      await api.enquiries.create(buildEnquiryPayload(state));
      submitToast('success', {
        title: messages.contactForm.toast.success.title,
        description: messages.contactForm.toast.success.body,
      });
      setState(INITIAL_STATE);
      setErrors({});
    } catch (error) {
      // Lỗi mạng/5xx/429 → toast phân loại, GIỮ NGUYÊN dữ liệu form (spec §2).
      const kind = classifySubmitError(error);
      const copy =
        kind === 'throttle'
          ? messages.contactForm.toast.throttle
          : messages.contactForm.toast.error;
      submitToast(kind, { title: copy.title, description: copy.body });
    } finally {
      setPending(false);
    }
  }

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
              <span className="text-primary-emphasis italic"> before the seats go.</span>
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
                className="text-base font-medium text-primary-emphasis"
              >
                {PHONE}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <a href={`mailto:${EMAIL}`} className="text-base font-medium text-primary-emphasis">
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
            <p className="text-base font-medium text-primary-emphasis">
              {OFFICES[0]?.addressLines.join(', ')}
            </p>
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

        {/* Phải: "LÁ THƯ" — chữ ký của trang (đặt cược táo bạo ở MỘT chỗ =
            chính form, vì luận đề trang là "not a hotline"). Bản 1 kiểu
            mad-libs (blank giữa câu) bị chê rối mắt → bản 2: bố cục thư RÕ
            RÀNG — mở "Hello tourism," + từng dòng nhãn-câu-hỏi + chỗ điền
            gạch nét đứt mực jade italic, chữ ký "Yours," + tem + tái bút. */}
        <motion.div
          className="col-span-12 md:col-span-5"
          initial={{ x: 40, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, ...SPRING }}
        >
          <form
            className="relative flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-(--shadow-card) md:p-9"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Honeypot — người thật không bao giờ thấy/điền field này. Wrapper
                aria-hidden + tabIndex -1 kéo cả input ra khỏi accessibility tree
                và tab order; CSS đẩy khỏi viewport (KHÔNG display:none) để bot
                ngây thơ đọc DOM/CSS thô vẫn tưởng đây là field thật (spec §2). */}
            <div
              aria-hidden="true"
              tabIndex={-1}
              className="absolute -left-[9999px] h-px w-px overflow-hidden"
            >
              <label htmlFor="cl-website">Website</label>
              <input
                id="cl-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={state.website}
                onChange={(e) => setState((s) => ({ ...s, website: e.target.value }))}
              />
            </div>

            {/* Tem thư góc trên-phải: viền răng cưa dashed + la bàn, nghiêng nhẹ */}
            <div
              aria-hidden="true"
              className="absolute top-5 right-5 flex rotate-3 flex-col items-center gap-1 rounded-sm border-2 border-dashed border-primary/40 px-3 py-2 text-primary-emphasis"
            >
              <CompassIcon className="size-5" />
              <span className="text-[9px] font-semibold tracking-widest uppercase">
                Hà Nội · Sa Pa
              </span>
            </div>

            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Write us a letter
            </p>

            {/* Thân thư — bố cục RÕ RÀNG (điều chỉnh #2: bản mad-libs bị chê
                rối mắt): mở thư "Hello tourism," rồi TỪNG DÒNG một nhãn-câu-hỏi
                + một chỗ điền gạch nét đứt; giữ hồn thư ở tem, mực jade italic,
                chữ ký "Yours," và tái bút. */}
            <p className="font-heading text-xl text-card-foreground md:text-2xl">Hello tourism,</p>

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cl-count" className={LETTER_LABEL}>
                  How many of you?
                </label>
                <input
                  id="cl-count"
                  type="text"
                  inputMode="numeric"
                  placeholder="2 travellers"
                  className={LETTER_BLANK}
                  value={state.count}
                  onChange={(e) => setState((s) => ({ ...s, count: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cl-dates" className={LETTER_LABEL}>
                  When are you free?
                </label>
                <input
                  id="cl-dates"
                  type="text"
                  placeholder="Oct 12 – 18"
                  className={LETTER_BLANK}
                  value={state.dates}
                  onChange={(e) => setState((s) => ({ ...s, dates: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cl-region" className={LETTER_LABEL}>
                Where are you dreaming of?
              </label>
              <Select
                value={state.region || null}
                onValueChange={(value) => setState((s) => ({ ...s, region: value ?? '' }))}
              >
                <SelectTrigger
                  id="cl-region"
                  className={`${LETTER_BLANK} h-auto w-full justify-between rounded-none py-1 font-heading text-lg text-primary-emphasis italic shadow-none focus-visible:ring-0`}
                >
                  <SelectValue placeholder="Anywhere in Vietnam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {/* Option mock từ REGIONS — nợ API categories như Nexora */}
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cl-loves" className={LETTER_LABEL}>
                What do you love when travelling?
              </label>
              <textarea
                id="cl-loves"
                rows={2}
                placeholder="Easy pace, food markets, a free afternoon now and then…"
                className={`${LETTER_BLANK} w-full resize-none leading-relaxed`}
                value={state.loves}
                onChange={(e) => setState((s) => ({ ...s, loves: e.target.value }))}
                aria-invalid={Boolean(errors.loves)}
              />
              {errors.loves && (
                <p role="alert" className={LETTER_ERROR}>
                  {errors.loves}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cl-email" className={LETTER_LABEL}>
                Where do we write back?
              </label>
              <input
                id="cl-email"
                type="email"
                placeholder="michael@example.com"
                className={LETTER_BLANK}
                value={state.email}
                onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && (
                <p role="alert" className={LETTER_ERROR}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Chữ ký — giữ chất thư */}
            <div className="flex flex-col items-end gap-1.5">
              <span className="font-heading text-lg text-card-foreground italic">Yours,</span>
              <div className="flex w-full flex-col gap-1.5 sm:w-56">
                <label htmlFor="cl-name" className="sr-only">
                  Your name
                </label>
                <input
                  id="cl-name"
                  type="text"
                  placeholder="Your name"
                  className={`${LETTER_BLANK} text-right`}
                  value={state.name}
                  onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && (
                  <p role="alert" className={`${LETTER_ERROR} text-right`}>
                    {errors.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={pending}
                className="cursor-pointer self-start rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? messages.contactForm.submitting : 'Send the letter'}
              </button>
              <p className="text-xs text-muted-foreground italic">
                P.S. A human reads every letter — no bots on this side.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
