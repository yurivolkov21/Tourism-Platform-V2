import type { ReactNode } from 'react';
import { render, toPlainText } from 'react-email';
import { EmailType } from '../../generated/prisma/enums.js';
import {
  accentLink,
  BodyParagraph,
  CodeBox,
  CtaButton,
  DataCard,
  EmailShell,
  MoneyValue,
  NoteParagraph,
  PillValue,
  PlainValue,
  QuoteCard,
} from './layout.js';

/**
 * Render email theo từng type (ADR-0025, vòng 2): copy + cấu trúc port từ
 * `email.templates.ts` của Nexora tiền nhiệm (hệ Barebone user duyệt 13/07),
 * thích nghi theo payload outbox v2 — field bản cũ có mà payload v2 không
 * mang (ảnh hero tour, rating sao, URL review) thì degrade về nhánh monogram
 * của chính hệ đó, KHÔNG bịa dữ liệu.
 *
 * ASYNC vì render() của react-email đi qua streaming API của React. React tự
 * escape mọi text node; riêng SUBJECT là plain text ngoài React — mọi giá trị
 * vào subject phải qua `subjectText` (cắt CR/LF chống header injection).
 * Kèm bản `text` thuần (deliverability — bản cũ cũng gửi 2 part).
 */
export async function renderEmail(
  type: EmailType,
  payload: Record<string, unknown>,
  /** Base URL web (env FRONTEND_URL) — nguồn của mọi URL nút bấm + unsubscribe. */
  frontendUrl?: string,
): Promise<{ subject: string; html: string; text: string }> {
  const { subject, node } = buildEmail(type, payload, frontendUrl);
  const html = await render(node);
  return { subject, html, text: toPlainText(html) };
}

/** Giá trị string từ payload — KHÔNG escape (React lo khi render). */
function field(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Giá trị cho SUBJECT — plain text, ngoài vòng escape của React. Cắt CR/LF:
 * ký tự xuống dòng trong header là đường header injection (chèn Bcc/To).
 */
function subjectText(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.replaceAll(/[\r\n]+/g, ' ').trim();
}

/** '2026-10-12' → 'Oct 12, 2026' — payload mang date dạng ::text từ SQL. */
function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function buildEmail(
  type: EmailType,
  payload: Record<string, unknown>,
  frontendUrl?: string,
): { subject: string; node: ReactNode } {
  const f = (key: string) => field(payload, key);
  const s = (key: string) => subjectText(payload, key);
  const code = f('code') ?? 'your booking';
  const subjectCode = s('code') ?? 'your booking';
  const name = f('name');
  const title = f('title');
  /**
   * Số tiền để IN — `undefined` khi không có đồng nào thật sự chuyển.
   *
   * `'0.00'` là chuỗi TRUTHY, nên bản cũ biến một khoản hoàn bằng không thành
   * dòng "Refund issued 0.00 USD" cộng câu "your refund is on its way". Ca ấy
   * hiếm khi ADR-0029 §2 mới ra (chỉ booking đã hoàn đủ từ trước), nhưng
   * §AMEND 3 làm nó thành ĐƯỜNG THƯỜNG: mọi yêu cầu huỷ sát ngày khởi hành đều
   * duyệt với mức 0% theo bậc chính sách.
   *
   * Không email nào được phép loan báo một khoản tiền bằng không, nên chặn ở
   * ĐÂY, một chỗ cho mọi loại mail.
   */
  const amountRaw = f('amount');
  const money =
    amountRaw && f('currency') && Number(amountRaw) > 0
      ? `${amountRaw} ${f('currency')}`
      : undefined;
  // URL nút bấm derive từ frontendUrl — route THẬT của web v2, không bịa.
  const manageUrl = frontendUrl ? `${frontendUrl}/account/bookings` : undefined;
  const browseUrl = frontendUrl ? `${frontendUrl}/tours` : undefined;
  const blogUrl = frontendUrl ? `${frontendUrl}/blog` : undefined;
  const supportUrl = frontendUrl ? `${frontendUrl}/contact` : undefined;
  const policyUrl = frontendUrl ? `${frontendUrl}/cancellation-policy` : undefined;
  const bookingReason = "You're receiving this because of a booking made at Nexora.";

  switch (type) {
    case EmailType.BOOKING_CONFIRMATION: {
      const dates =
        formatDate(f('startDate')) && formatDate(f('endDate'))
          ? `${formatDate(f('startDate'))} → ${formatDate(f('endDate'))}`
          : undefined;
      return {
        subject: `Booking confirmed — ${subjectCode}${s('title') ? ` · ${s('title')}` : ''}`,
        node: (
          <EmailShell
            preview={`Your seats${title ? ` for ${title}` : ''} are reserved — booking ${code}.`}
            heading={name ? `You're going, ${name}!` : "You're going!"}
            note={
              <NoteParagraph>
                Questions? Reply to this email — a real person reads it.
              </NoteParagraph>
            }
            footerReason={bookingReason}
          >
            <BodyParagraph>
              Your payment is confirmed and your seats are reserved. Keep this email handy on the
              day.
            </BodyParagraph>
            <DataCard
              rows={[
                [
                  'Booking code',
                  <PlainValue key="v">
                    <strong>{code}</strong>
                  </PlainValue>,
                ],
                ...(title
                  ? ([['Tour', <PlainValue key="v">{title}</PlainValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
                ...(dates
                  ? ([['Departure', <PlainValue key="v">{dates}</PlainValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
                ...(money
                  ? ([['Total paid', <MoneyValue key="v">{money}</MoneyValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
              ]}
            />
            {manageUrl ? <CtaButton href={manageUrl}>View my booking</CtaButton> : null}
          </EmailShell>
        ),
      };
    }
    case EmailType.BOOKING_REFUNDED:
      return {
        subject: `Refund on its way — ${subjectCode}`,
        node: (
          <EmailShell
            preview={`Your refund for booking ${code} has been issued.`}
            heading="Your refund is on its way"
            note={
              <NoteParagraph>
                The amount typically appears within 5–10 business days, depending on your bank.
                Anything unclear? Reply to this email.
              </NoteParagraph>
            }
            footerReason={bookingReason}
          >
            <BodyParagraph>
              {name ? `Hi ${name}, we` : 'We'}&#39;ve refunded your booking <strong>{code}</strong>
              {title ? ` — ${title}` : ''}.
            </BodyParagraph>
            <DataCard
              rows={[
                ...(money
                  ? ([['Refund issued', <MoneyValue key="v">{money}</MoneyValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
                ...(f('reason')
                  ? ([['Reason', <PlainValue key="v">{f('reason')}</PlainValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
                ['Returns to', <PlainValue key="v">Original payment method</PlainValue>],
              ]}
            />
          </EmailShell>
        ),
      };
    case EmailType.REVIEW_APPROVED:
      return {
        subject: `Your review is live${s('title') ? ` — ${s('title')}` : ''}`,
        node: (
          <EmailShell
            preview={`Your review${title ? ` of ${title}` : ''} is now published.`}
            heading="Your review is live"
            note={
              <NoteParagraph>
                Want to tweak anything? Reply to this email and we&#39;ll help.
              </NoteParagraph>
            }
            footerReason="You're receiving this because you reviewed a Nexora tour."
          >
            <BodyParagraph>
              {name ? `Thanks for sharing, ${name}. ` : 'Thanks for sharing. '}Your review
              {title ? (
                <>
                  {' '}
                  of <strong>{title}</strong>
                </>
              ) : null}{' '}
              is now published — stories like yours help other travellers choose with confidence.
            </BodyParagraph>
          </EmailShell>
        ),
      };
    /**
     * ADR-0031 §6 — bác bỏ mà im lặng là để khách đợi một thứ không bao giờ
     * tới, đúng thứ vừa vá ở mail duyệt huỷ. Mail này KHÔNG xin lỗi và KHÔNG
     * vòng vo: nói điều đã xảy ra, nói lý do người duyệt viết, và mở một cửa
     * để hỏi lại.
     *
     * `note` là LÝ DO do admin gõ. Vắng thì bỏ hẳn khối trích dẫn — một ô
     * trống có nhãn "vì sao" còn tệ hơn không có nhãn nào.
     */
    case EmailType.REVIEW_REJECTED:
      return {
        subject: `About your review${s('title') ? ` — ${s('title')}` : ''}`,
        node: (
          <EmailShell
            preview={`Your review${title ? ` of ${title}` : ''} was not published.`}
            heading="Your review was not published"
            note={
              <NoteParagraph>
                Think we got this wrong? Reply to this email and a person will take another look.
              </NoteParagraph>
            }
            footerReason="You're receiving this because you reviewed a Nexora tour."
          >
            <BodyParagraph>
              {name ? `Hi ${name}, thanks for writing. ` : 'Thanks for writing. '}Your review
              {title ? (
                <>
                  {' '}
                  of <strong>{title}</strong>
                </>
              ) : null}{' '}
              will not appear on the site.
            </BodyParagraph>
            {f('note') ? <QuoteCard label="WHY">&quot;{f('note')}&quot;</QuoteCard> : null}
          </EmailShell>
        ),
      };
    case EmailType.ENQUIRY_RECEIVED:
      return {
        subject: `We received your enquiry${s('tourTitle') ? ` — ${s('tourTitle')}` : ''}`,
        node: (
          <EmailShell
            preview="We've got your message — we reply within one business day."
            heading="We've got your message"
            note={
              browseUrl ? (
                <NoteParagraph>
                  While you wait,{' '}
                  <a href={browseUrl} style={accentLink}>
                    browse our tours
                  </a>{' '}
                  — or reply to this email to add anything.
                </NoteParagraph>
              ) : (
                <NoteParagraph>Reply to this email if you have anything to add.</NoteParagraph>
              )
            }
            footerReason="You're receiving this because you contacted Nexora."
          >
            <BodyParagraph>
              {name ? `Hi ${name}, a` : 'A'} local expert is reading it now and will get back to you
              within one business day.
            </BodyParagraph>
            {f('message') ? (
              <QuoteCard label="YOUR MESSAGE">&quot;{f('message')}&quot;</QuoteCard>
            ) : null}
          </EmailShell>
        ),
      };
    // Alert nội bộ: gửi tới hộp thư admin, KHÔNG gửi cho khách — mọi thứ
    // admin cần để phân loại lead nằm trong data card + quote card.
    case EmailType.ENQUIRY_ADMIN_ALERT:
      return {
        subject: `New enquiry from ${s('name') ?? 'a visitor'}`,
        node: (
          <EmailShell
            preview="New enquiry received."
            heading="New enquiry received"
            footerReason="Internal alert for the Nexora team."
          >
            <DataCard
              rows={[
                ['Name', <PlainValue key="v">{f('name') ?? '—'}</PlainValue>],
                ['Email', <PlainValue key="v">{f('email') ?? '—'}</PlainValue>],
                ['Tour', <PlainValue key="v">{f('tourTitle') ?? 'General enquiry'}</PlainValue>],
              ]}
            />
            {f('message') ? (
              <QuoteCard label="MESSAGE">&quot;{f('message')}&quot;</QuoteCard>
            ) : null}
          </EmailShell>
        ),
      };
    case EmailType.CANCELLATION_REQUESTED:
      return {
        subject: `We're reviewing your cancellation request — ${subjectCode}`,
        node: (
          <EmailShell
            preview={`Your cancellation request for booking ${code} is under review.`}
            heading="We're reviewing your request"
            note={
              <NoteParagraph>
                Until a decision is made, your booking and seats stay unchanged. Changed your mind?
                Reply to this email.
              </NoteParagraph>
            }
            footerReason={bookingReason}
          >
            <BodyParagraph>
              {name ? `Hi ${name}, we` : 'We'}&#39;ve received your request to cancel booking{' '}
              <strong>{code}</strong>
              {title ? ` (${title})` : ''}. Our team reviews every request within 48 hours.
            </BodyParagraph>
            <DataCard
              rows={[
                ['Status', <PillValue key="v">Under review</PillValue>],
                ['If approved', <PlainValue key="v">A refund email follows</PlainValue>],
              ]}
            />
            {f('reason') ? (
              <QuoteCard label="YOUR REASON">&quot;{f('reason')}&quot;</QuoteCard>
            ) : null}
          </EmailShell>
        ),
      };
    case EmailType.CANCELLATION_APPROVED:
      return {
        subject: `Cancellation approved — ${subjectCode}`,
        node: (
          <EmailShell
            preview={`Your cancellation of booking ${code} has been approved.`}
            heading="Your cancellation is approved"
            note={
              // Ca KHÔNG hoàn đồng nào không được im lặng: một mail báo "đã
              // duyệt huỷ" mà không nhắc gì tới tiền để khách tự đoán, rồi ngồi
              // đợi một khoản không bao giờ tới.
              money ? (
                <NoteParagraph>
                  The refund typically appears within 5–10 business days, depending on your bank.
                </NoteParagraph>
              ) : (
                <NoteParagraph>
                  No further refund is due on this booking.{' '}
                  {policyUrl ? (
                    <a href={policyUrl}>See our refund schedule</a>
                  ) : (
                    'See our refund schedule for how cancellations are refunded.'
                  )}
                </NoteParagraph>
              )
            }
            footerReason={bookingReason}
          >
            <BodyParagraph>
              {name ? `Hi ${name}, your` : 'Your'} cancellation of booking <strong>{code}</strong>
              {title ? ` (${title})` : ''} has been approved
              {money ? ' and your refund is on its way' : ''}.
            </BodyParagraph>
            <DataCard
              rows={[
                ['Status', <PillValue key="v">Cancelled</PillValue>],
                ...(money
                  ? ([['Refund issued', <MoneyValue key="v">{money}</MoneyValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
              ]}
            />
            {f('note') ? (
              <QuoteCard label="NOTE FROM OUR TEAM">&quot;{f('note')}&quot;</QuoteCard>
            ) : null}
          </EmailShell>
        ),
      };
    case EmailType.CANCELLATION_DENIED:
      return {
        subject: `About your cancellation request — ${subjectCode}`,
        node: (
          <EmailShell
            preview={`An update on your cancellation request for booking ${code}.`}
            heading="About your cancellation request"
            footerReason={bookingReason}
          >
            <BodyParagraph>
              {name ? `Hi ${name}, we` : 'We'}&#39;ve reviewed your request for booking{' '}
              <strong>{code}</strong>
              {title ? ` (${title})` : ''} and unfortunately we&#39;re unable to approve it this
              time.
            </BodyParagraph>
            {f('note') ? <QuoteCard label="REASON">&quot;{f('note')}&quot;</QuoteCard> : null}
            <BodyParagraph>
              Your booking remains active and we&#39;d love to welcome you on the day. Special
              circumstances? Reply to this email — we read every case individually.
            </BodyParagraph>
            {manageUrl ? <CtaButton href={manageUrl}>View my booking</CtaButton> : null}
          </EmailShell>
        ),
      };
    case EmailType.NEWSLETTER_WELCOME: {
      // Link huỷ đăng ký (GDPR/CAN-SPAM): id/token do NewsletterService sinh
      // sẵn lúc enqueue; ở đây chỉ ghép URL — bản cũ chỉ có "reply to
      // unsubscribe", v2 có trang xác nhận thật nên link thẳng.
      const unsubscribeUrl = buildUnsubscribeUrl(frontendUrl, payload);
      return {
        subject: 'Welcome to the Nexora newsletter',
        node: (
          <EmailShell
            preview="Stories from the road, monthly — welcome aboard."
            heading="Stories from the road, monthly"
            footerReason="You subscribed on nexora-travel.agency."
            unsubscribeUrl={unsubscribeUrl}
          >
            <BodyParagraph>
              Welcome aboard. Once a month — never more — you&#39;ll get new journeys before
              they&#39;re public, field notes from our local guides, and seasonal tips for timing
              Vietnam right.
            </BodyParagraph>
            <DataCard
              rows={[
                ['New journeys first', <PlainValue key="v">Small groups sell out fast</PlainValue>],
                ['Field notes', <PlainValue key="v">Long-form, from our guides</PlainValue>],
                [
                  'Seasonal tips',
                  <PlainValue key="v">Lanterns, terraces, golden weeks</PlainValue>,
                ],
              ]}
            />
            {blogUrl ? <CtaButton href={blogUrl}>Read the blog</CtaButton> : null}
          </EmailShell>
        ),
      };
    }
    case EmailType.EMAIL_CHANGED:
      return {
        subject: 'Your email address was changed',
        node: (
          <EmailShell
            preview="The email on your Nexora account was changed."
            heading="Your email was changed"
            footerReason="You're receiving this because your Nexora account email was changed."
          >
            <BodyParagraph>
              The email address on your account was just changed. If you made this change, no action
              is needed.
            </BodyParagraph>
            <BodyParagraph>
              If this wasn&#39;t you, your account may be at risk — please contact us right away.
            </BodyParagraph>
            {supportUrl ? <CtaButton href={supportUrl}>Contact support</CtaButton> : null}
          </EmailShell>
        ),
      };
    // AUTH-2 (ADR-0008) — link do Better Auth sinh, truyền qua payload.url.
    case EmailType.PASSWORD_RESET:
      return {
        subject: 'Reset your password',
        node: (
          <EmailShell
            preview="Reset your Nexora password."
            heading="Reset your password"
            note={
              <NoteParagraph>
                If you did not request this, you can safely ignore this email.
              </NoteParagraph>
            }
            footerReason="You're receiving this because a password reset was requested for your account."
          >
            <BodyParagraph>
              {name ? `Hi ${name}, we` : 'We'} received a request to reset your password. The link
              below takes you to a fresh one.
            </BodyParagraph>
            {f('url') ? <CtaButton href={f('url') ?? ''}>Reset your password</CtaButton> : null}
          </EmailShell>
        ),
      };
    case EmailType.EMAIL_VERIFICATION:
      return {
        subject: 'Verify your email',
        node: (
          <EmailShell
            preview="Confirm your email address."
            heading="Verify your email"
            footerReason="You're receiving this because an account was created with this address."
          >
            <BodyParagraph>
              {name ? `Hi ${name}, please` : 'Please'} confirm your email address to finish setting
              up your account.
            </BodyParagraph>
            {f('url') ? <CtaButton href={f('url') ?? ''}>Verify your email</CtaButton> : null}
          </EmailShell>
        ),
      };
    // ADR-0017 §5a — plugin emailOTP: verify email gửi mã 6 số thay vì URL.
    case EmailType.EMAIL_OTP:
      return {
        subject: 'Your verification code',
        node: (
          <EmailShell
            preview="Your Nexora verification code."
            heading="Your verification code"
            note={
              <NoteParagraph>
                Didn&#39;t request this code? You can safely ignore this email.
              </NoteParagraph>
            }
            footerReason="You're receiving this because this address was used to sign up at Nexora."
          >
            <BodyParagraph>
              Enter this code on the verification page. It expires in 10 minutes.
            </BodyParagraph>
            {f('otp') ? <CodeBox code={f('otp') ?? ''} /> : null}
          </EmailShell>
        ),
      };
    default: {
      // Chốt exhaustiveness — EmailType mới sẽ fail ầm ĩ ở đây (và test
      // enum-coverage của spec fail trước).
      const exhaustive: never = type;
      throw new Error(`No email template for type ${String(exhaustive)}`);
    }
  }
}

/**
 * Ghép URL trang xác nhận huỷ đăng ký. CHỈ ghép khi có ĐỦ `frontendUrl` lẫn
 * cặp `subscriberId`/`unsubscribeToken` — thiếu một trong ba thì bỏ qua,
 * KHÔNG throw: nhánh degrade êm, không phải lỗi chặn gửi email. Export cho
 * deliverer dùng lại ở header List-Unsubscribe (URL thô ngoài HTML).
 */
export function buildUnsubscribeUrl(
  frontendUrl: string | undefined,
  payload: Record<string, unknown>,
): string | undefined {
  const id = payload.subscriberId;
  const token = payload.unsubscribeToken;
  if (!frontendUrl || typeof id !== 'string' || typeof token !== 'string') return undefined;
  if (id.length === 0 || token.length === 0) return undefined;
  return `${frontendUrl}/newsletter/unsubscribe?id=${id}&token=${token}`;
}
