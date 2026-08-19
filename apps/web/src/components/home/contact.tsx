'use client';

import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { CalendarIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon, UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import {
  type ComponentType,
  type FormEvent,
  type ReactNode,
  type SVGProps,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api } from '@/lib/api/client';
import { classifySubmitError, submitToast } from '@/lib/api/submit';
import { useSession } from '@/lib/auth-client';
import { buildEnquiryPayload, type ContactFormState, validateEnquiry } from '@/lib/enquiry-form';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { EMAIL, PHONE } from '@/lib/site';
import { REGIONS } from '@/mocks/regions';
import { SectionEyebrow } from './section-eyebrow';

// Convert từ Estate contact.tsx: form trái + ảnh phải. Static-first tới 19/08,
// nay NỐI `enquiries.create` cùng khuôn `contact-split.tsx` (yêu cầu user):
// state `ContactFormState` + `validateEnquiry`/`buildEnquiryPayload` dùng
// CHUNG lib (không khai lại rule), honeypot `website`, toast phân loại
// success/error/throttle, điền sẵn tên từ session. Khác biệt duy nhất so với
// /contact: ô "Region" từ text tự do → `<select>` 4 lựa chọn (Anywhere + 3
// miền) để `interests` mang key vùng chuẩn thay vì chuỗi khách gõ.
// Review #30 (A+B+C): A — nới khung lên max-w-7xl như các section khác, ảnh
// bỏ kích thước cố định và bám trọn cột phải; B — overlay "Answer times" mỏng
// thay bằng glass card đáy ảnh chứa 3 hàng liên hệ (email/phone/giờ phản hồi);
// C — field kiểu pixels/ContactSection: icon nằm trong input, viền wrapper
// chuyển primary khi focus-within (shadcn Input/Textarea bỏ viền riêng).
const fieldMotion = {
  initial: { y: 50, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true },
  transition: SPRING,
};

// 3 bước "What happens next" — trả lời câu hỏi "gửi form xong thì sao?"
const STEPS = [
  {
    title: 'Tell us your dates',
    description: 'Share when, where, and how you like to travel.',
  },
  {
    title: 'Get itineraries in 24 hours',
    description: 'Local guides draft two or three routes around your pace.',
  },
  {
    title: 'Book when you love one',
    description: 'No payment until you approve the plan.',
  },
];

// Class gỡ viền/ring riêng của shadcn Input/Textarea khi nằm trong wrapper
// có viền (tránh viền kép — wrapper lo focus ring qua focus-within).
// dark:bg-transparent BẮT BUỘC (navbar #5): base có dark:bg-input/30 — nền
// riêng chỉ-dark-mode mà bg-transparent (variant khác) không gỡ được, gây
// "hai lớp màu" trong field ở dark theme.
// `aria-invalid:*` cũng gỡ (nối API 19/08): Input/Textarea của @tourism/ui tự
// vẽ ring đỏ khi `aria-invalid`, mà ở đây viền là của WRAPPER — để cả hai thì
// thành hai lớp đỏ lồng nhau (đo bằng ảnh thật). Trạng thái lỗi vẽ ở wrapper
// qua prop `error` của `ContactField`; input chỉ giữ `aria-invalid` cho máy đọc.
export const BARE_FIELD =
  'border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 dark:bg-transparent aria-invalid:border-0 aria-invalid:ring-0';

/** Lỗi inline dưới field — cùng khuôn `LETTER_ERROR` của contact-split. */
const FIELD_ERROR = 'mt-1.5 text-xs text-destructive-emphasis';

export function ContactField({
  id,
  label,
  icon: Icon,
  multiline = false,
  error,
  children,
}: {
  id: string;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  multiline?: boolean;
  /** Lỗi inline dưới ô (nối API 19/08); id `${id}-error` để input trỏ tới. */
  error?: string;
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
        } ${error ? 'border-destructive' : ''}`}
        {...fieldMotion}
      >
        {Icon ? (
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </motion.div>
      {error ? (
        <p id={`${id}-error`} role="alert" className={FIELD_ERROR}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const INITIAL_STATE: ContactFormState = {
  name: '',
  email: '',
  loves: '',
  dates: '',
  count: '',
  region: 'any',
  website: '',
};

export function Contact() {
  const [state, setState] = useState<ContactFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<ReturnType<typeof validateEnquiry>>({});
  const [pending, setPending] = useState(false);

  const set = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    // Gõ lại vào ô đang lỗi thì xoá lỗi của RIÊNG ô đó (khuôn sweep 19/08).
    setErrors((e) => (key in e ? { ...e, [key]: undefined } : e));
  };

  // Điền sẵn tên khi đã đăng nhập — cùng ba lý do và cùng chốt `filledOnce`
  // đã ghi ở contact-split.tsx (session tới bất đồng bộ; khách cố ý xoá tên).
  const { data: session } = useSession();
  const filledOnce = useRef(false);
  useEffect(() => {
    const name = session?.user?.name;
    if (!name || filledOnce.current) return;
    filledOnce.current = true;
    setState((s) => (s.name ? s : { ...s, name }));
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateEnquiry(state);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      await api.enquiries.create(buildEnquiryPayload(state));
      submitToast('success', {
        title: messages.homeContact.toast.success.title,
        description: messages.homeContact.toast.success.body,
      });
      setState(INITIAL_STATE);
      setErrors({});
    } catch (error) {
      // Lỗi mạng/5xx/429 → toast phân loại, GIỮ NGUYÊN dữ liệu đã nhập.
      const kind = classifySubmitError(error);
      const copy =
        kind === 'throttle'
          ? messages.homeContact.toast.throttle
          : messages.homeContact.toast.error;
      submitToast(kind, { title: copy.title, description: copy.body });
    } finally {
      setPending(false);
    }
  }

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
            transition={SPRING_HEADING}
          >
            Tell us your dates, <br />
            we’ll draw the route
          </motion.h2>

          <form className="relative mt-15 flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
            {/* Honeypot — cùng kỹ thuật contact-split/newsletter: wrapper
                aria-hidden + tabIndex -1, CSS đẩy khỏi viewport (KHÔNG
                display:none) để bot đọc DOM thô vẫn tưởng là field thật. */}
            <div
              aria-hidden="true"
              tabIndex={-1}
              className="absolute -left-[9999px] h-px w-px overflow-hidden"
            >
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={state.website}
                onChange={(e) => set('website', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ContactField id="contact-name" label="Your name" icon={UserIcon} error={errors.name}>
                <Input
                  id="contact-name"
                  type="text"
                  placeholder="Michael Anderson"
                  className={BARE_FIELD}
                  value={state.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                />
              </ContactField>
              <ContactField
                id="contact-email"
                label="Email address"
                icon={MailIcon}
                error={errors.email}
              >
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="michael@example.com"
                  className={BARE_FIELD}
                  value={state.email}
                  onChange={(e) => set('email', e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
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
                  value={state.dates}
                  onChange={(e) => set('dates', e.target.value)}
                />
              </ContactField>
              <ContactField
                id="contact-region"
                label={messages.homeContact.regionLabel}
                icon={MapPinIcon}
              >
                {/* `<select>` gốc, tạo kiểu như Input trần: cùng chiều cao,
                    không viền/nền riêng (wrapper lo viền + focus ring). */}
                <select
                  id="contact-region"
                  value={state.region}
                  onChange={(e) => set('region', e.target.value)}
                  className={`${BARE_FIELD} h-8 w-full cursor-pointer text-sm text-foreground outline-none`}
                >
                  <option value="any">{messages.homeContact.regionAny}</option>
                  {REGIONS.map((region) => (
                    <option key={region.key} value={region.key}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </ContactField>
            </div>

            <ContactField id="contact-message" label="Message" multiline error={errors.loves}>
              <Textarea
                id="contact-message"
                rows={4}
                placeholder="E.g. Two of us, easy pace, love food markets"
                className={`${BARE_FIELD} resize-none pt-0`}
                value={state.loves}
                onChange={(e) => set('loves', e.target.value)}
                aria-invalid={Boolean(errors.loves)}
                aria-describedby={errors.loves ? 'contact-message-error' : undefined}
              />
            </ContactField>

            <motion.div className="mt-2" {...fieldMotion}>
              <button
                type="submit"
                disabled={pending}
                className="cursor-pointer rounded-full bg-primary px-6 py-3.5 text-xs tracking-wide text-primary-foreground uppercase transition-colors duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? messages.homeContact.submitting : 'Get my itineraries'}
              </button>
            </motion.div>
          </form>
        </div>

        {/* Cột phải (#31): panel lai kiểu Nexora "Plan your trip" — nền primary,
            timeline "What happens next" 3 bước dọc tự dựng (mượn ngôn ngữ badge
            số + đường nối của stepper, KHÔNG phải wizard tương tác) + card liên
            hệ đáy panel. Thay hẳn khối ảnh placeholder cũ. */}
        {/* Màu panel (#32): gradient dọc primary → region-deep (mặc định = jade sâu
            brand; --region-* ở page-level là hợp lệ theo ADR-0013 #4) cho khối bớt
            phẳng; eyebrow nhuộm spark (vàng nắng) làm điểm nhiệt trên nền jade. */}
        <motion.div
          className="flex min-h-[455px] w-full flex-col rounded-xl bg-linear-to-b from-primary to-(--region-deep) p-8 text-primary-foreground sm:p-10"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING}
        >
          <span className="text-xs font-semibold tracking-[0.2em] text-(--region-spark) uppercase">
            What happens next
          </span>
          <h3 className="mt-3 max-w-[360px] font-heading text-2xl leading-snug font-medium">
            Three steps between you and the road
          </h3>

          {/* Timeline dọc: badge số + đường nối, motion trồi stagger từng bước */}
          <ol className="mt-10 flex flex-1 flex-col">
            {STEPS.map((step, index) => (
              <motion.li
                key={step.title}
                className="flex gap-4"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING, delay: 0.15 * index }}
              >
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 font-heading text-sm font-semibold">
                    {index + 1}
                  </span>
                  {index < STEPS.length - 1 ? (
                    <span aria-hidden="true" className="w-px flex-1 bg-primary-foreground/20" />
                  ) : null}
                </div>
                <div className={index < STEPS.length - 1 ? 'pb-8' : ''}>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-primary-foreground/75">{step.description}</p>
                </div>
              </motion.li>
            ))}
          </ol>

          {/* Card liên hệ — giữ nguyên 3 hàng, đổi da theo nền primary */}
          <motion.div
            className="mt-10 flex flex-col gap-3.5 rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 text-sm"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ ...SPRING, delay: 0.2 }}
          >
            <a
              href={`mailto:${EMAIL}`}
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <MailIcon className="size-4 shrink-0" aria-hidden="true" />
              {EMAIL}
            </a>
            <a
              href={`tel:${PHONE.replace(/\s/g, '')}`}
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <PhoneIcon className="size-4 shrink-0" aria-hidden="true" />
              {PHONE}
            </a>
            <p className="flex items-center gap-3 text-primary-foreground/75">
              <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
              Mon–Fri within the hour · weekends same day
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
