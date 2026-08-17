'use client';

import type { MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { CheckIcon, ClockIcon, CompassIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { SlotImage } from '@/components/slot-image';
import { api } from '@/lib/api/client';
import { classifySubmitError, submitToast } from '@/lib/api/submit';
import { useSession } from '@/lib/auth-client';
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
const LETTER_ERROR = 'text-xs text-destructive-emphasis';

const INITIAL_STATE: ContactFormState = {
  name: '',
  email: '',
  loves: '',
  dates: '',
  count: '',
  region: '',
  website: '',
};

export function ContactSplit({ panelImage = null }: { panelImage?: MediaItem | null }) {
  const [state, setState] = useState<ContactFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<ReturnType<typeof validateEnquiry>>({});
  const [pending, setPending] = useState(false);

  // Khách đã đăng nhập thì điền sẵn CHỮ KÝ bằng tên thật (17/08).
  //
  // Chỉ chữ ký, KHÔNG đụng lời chào "Hello tourism,": lá thư là của khách gửi
  // cho công ty, đổi lời chào thành tên khách sẽ thành ra khách tự chào mình
  // rồi tự ký tên ở ngay dưới.
  //
  // `filledOnce` chặn hai tình huống thật, không phải phòng xa:
  //  1. `useSession` trả về BẤT ĐỒNG BỘ — khách gõ tay xong session mới tới thì
  //     điền đè sẽ xoá mất chữ họ vừa gõ.
  //  2. Khách CỐ Ý xoá tên đi (gửi hộ người khác) — effect chạy lại vì lý do
  //     khác mà điền lại thì hoá ra tranh bàn phím với người dùng.
  const { data: session } = useSession();
  const filledOnce = useRef(false);
  useEffect(() => {
    const name = session?.user?.name;
    if (!name || filledOnce.current) return;
    filledOnce.current = true;
    // Chỉ điền khi ô còn TRỐNG — không ghi đè thứ khách đã gõ.
    setState((s) => (s.name ? s : { ...s, name }));
  }, [session]);

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
      {/* MỘT card chia đôi (đổi 17/08, wireframe `docs/design/mockups/contact-split-panel.src.html`).
          Lịch sử ngắn để khỏi lặp lại: sáng nay từng đóng khung cột trái thành
          card thứ hai — user bác vì "hai khung nhìn kỳ". Hai khối rời luôn đọc
          ra là hai vật thể dù cân cỡ nào; mẫu ReUI contact-2 giải bằng cách cho
          chúng vào CHUNG một card, một nửa là panel TRÀN VIỀN. `overflow-hidden`
          ở card là thứ làm ảnh chạm sát mép và bo theo góc card. */}
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl border bg-card shadow-(--shadow-card) md:grid-cols-2">
        {/* ── TRÁI: panel ảnh tràn viền ── */}
        <motion.aside
          className="dark relative flex min-h-104 flex-col overflow-hidden p-8 text-on-media md:min-h-0 md:p-11"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING}
        >
          <SlotImage
            image={panelImage}
            label="Contact — the people who answer"
            sizes="(min-width: 768px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full"
          />
          {/* Scrim bằng TOKEN chứ không màu cứng: đậm ở đáy và mép trái để chữ
              đọc được, nhạt dần lên góc trên-phải. Đo trên wireframe: chữ thấp
              nhất 6.79:1, cao nhất 15.31:1 — đều trên ngưỡng 4.5. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-t from-hero via-hero/85 to-hero/40"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-r from-hero/60 via-transparent to-transparent"
          />

          <div className="relative flex h-full flex-col">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-foreground/15 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary-emphasis" />
              We can help
            </span>

            <h2 className="mt-6 max-w-[15ch] font-heading text-[34px] leading-tight font-medium text-balance md:text-[40px]/12">
              Let’s plan your dates
              <span className="text-primary-emphasis italic"> before the seats go.</span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-foreground/75 md:text-base">
              Tell us your dates and pace. A real person reads every letter and writes back — no
              bots on this side.
            </p>

            {/* Hàng thông tin lấy lối của ReUI contact-5: nhãn nhỏ viết hoa ở
                trên, giá trị đậm ở dưới. `mt-auto` ghim cụm này xuống đáy panel. */}
            <dl className="mt-auto flex flex-col gap-5 pt-10">
              {[
                { icon: PhoneIcon, k: 'Phone', v: PHONE, href: `tel:${PHONE.replace(/\s/g, '')}` },
                { icon: MailIcon, k: 'Email', v: EMAIL, href: `mailto:${EMAIL}` },
                {
                  icon: ClockIcon,
                  k: 'Response time',
                  v: 'Within the hour · Mon–Fri, 8am–6pm',
                },
                {
                  icon: MapPinIcon,
                  k: 'Headquarters',
                  v: OFFICES[0]?.addressLines.join(', ') ?? '',
                },
              ].map((row) => (
                <div key={row.k} className="flex items-start gap-3.5">
                  <row.icon
                    className="mt-1 size-4 shrink-0 text-primary-emphasis"
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="text-[10.5px] font-semibold tracking-[0.12em] text-foreground/60 uppercase">
                      {row.k}
                    </dt>
                    <dd className="mt-0.5 text-base leading-6 font-medium">
                      {row.href ? (
                        <a href={row.href} className="transition-opacity hover:opacity-80">
                          {row.v}
                        </a>
                      ) : (
                        row.v
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </motion.aside>

        {/* Phải: "LÁ THƯ" — chữ ký của trang (đặt cược táo bạo ở MỘT chỗ =
            chính form, vì luận đề trang là "not a hotline"). Bản 1 kiểu
            mad-libs (blank giữa câu) bị chê rối mắt → bản 2: bố cục thư RÕ
            RÀNG — mở "Hello tourism," + từng dòng nhãn-câu-hỏi + chỗ điền
            gạch nét đứt mực jade italic, chữ ký "Yours," + tem + tái bút. */}
        <motion.div
          className="relative"
          initial={{ x: 40, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, ...SPRING }}
        >
          <form
            className="relative flex h-full flex-col gap-6 p-8 md:p-11"
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

            {/* Bốn lựa chọn thì HIỆN HẾT, không giấu sau dropdown (đổi 17/08).
                Ngưỡng thường dùng là ≤5 thì bày ra; ở đây đúng 4. Lợi lớn nhất
                không phải bớt một cú bấm, mà là ba miền TỰ HIỆN RA — khách nước
                ngoài chưa chắc biết Việt Nam chia ba miền, dropdown thì giấu
                điều đó sau một cú bấm.

                `fieldset` + `input[type=radio]` THẬT, không phải div giả: có
                điều hướng phím mũi tên và trình đọc màn hình đọc đúng nhóm.
                Cùng bài học với bộ lọc sao ở modal reviews (Biome chặn
                `span role="group"`).

                Tạo kiểu theo lối ô tick tay trên thư in sẵn — viền nét đứt như
                mọi chỗ điền khác, chọn rồi thì đổi màu mực jade — chứ KHÔNG
                dùng chấm tròn radio mặc định, nó lạc hẳn khỏi ngôn ngữ lá thư.

                `any` map sang `interests: []` ở `buildEnquiryPayload`, nên chọn
                sẵn nó không đổi dữ liệu gửi đi mà bỏ được trạng thái trống. */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className={LETTER_LABEL}>Where are you dreaming of?</legend>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[{ key: 'any', name: 'Anywhere in Vietnam' }, ...REGIONS].map((option) => {
                  const checked = (state.region || 'any') === option.key;
                  return (
                    <label
                      key={option.key}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-sm border-2 border-dashed px-3 py-2 transition-colors ${
                        checked
                          ? 'border-primary bg-primary/5 text-primary-emphasis'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      } focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2`}
                    >
                      <input
                        type="radio"
                        name="region"
                        value={option.key}
                        checked={checked}
                        onChange={() => setState((s) => ({ ...s, region: option.key }))}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${
                          checked ? 'border-primary' : 'border-border'
                        }`}
                      >
                        {checked ? <CheckIcon className="size-3 text-primary-emphasis" /> : null}
                      </span>
                      <span className="font-heading text-[15px] italic">{option.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

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
