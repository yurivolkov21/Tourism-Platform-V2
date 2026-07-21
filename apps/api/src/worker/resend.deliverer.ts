import { Injectable, Logger } from '@nestjs/common';
import { EmailType } from '../generated/prisma/enums.js';
import { defaultHttpPost, type HttpPost } from '../lib/provider-http.js';
import type { EmailDeliverer } from './deliverer.js';
import { resolveRecipient } from './recipient.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface ResendDelivererOptions {
  apiKey: string;
  /** From theo RFC-5322, vd `Tourism <noreply@tourism.test>` (env EMAIL_FROM). */
  from: string;
  /**
   * Base URL của web app (env FRONTEND_URL) — vá review Task 6 Khoản 2, dùng
   * để ghép URL trang xác nhận huỷ đăng ký gắn vào email NEWSLETTER_WELCOME.
   * Nhận qua option (giống `apiKey`/`from`) thay vì import thẳng `env` — giữ
   * seam test-được-offline (D2) của file này.
   */
  frontendUrl: string;
}

/**
 * Bản cài Resend của {@link EmailDeliverer} (spec P2 §3 W5) — binding P2 đứng
 * sau EMAIL_DELIVERER khi RESEND_API_KEY được set (worker.module.ts; không có
 * key thì giữ ConsoleDeliverer của P1, dev boot không cần email — pattern
 * Nexora).
 *
 * Render cố ý tối giản: subject theo từng type + vài dòng HTML lấy từ các field
 * trong outbox payload (P2 chưa dùng react-email — template đẹp để P3 lo). Lỗi
 * thì THROW để OutboxService.drainOnce đếm attempt rồi retry / park FAILED theo
 * state machine của nó; HTTP đi qua seam {@link HttpPost} inject được (D2: unit
 * test chạy offline).
 */
@Injectable()
export class ResendDeliverer implements EmailDeliverer {
  private readonly logger = new Logger(ResendDeliverer.name);

  constructor(
    private readonly options: ResendDelivererOptions,
    private readonly httpPost: HttpPost = defaultHttpPost,
  ) {}

  async deliver(type: EmailType, payload: unknown): Promise<void> {
    const fields = asRecord(payload);
    /**
     * Người nhận: `to` (nếu có) THẮNG `email`.
     *
     * Vì sao cần tách: hầu hết email gửi cho chính chủ nhân của `email`
     * trong payload, nhưng ENQUIRY_ADMIN_ALERT thì ngược lại — `email` ở
     * đó là địa chỉ KHÁCH (để admin đọc), còn người nhận phải là admin.
     * Không tách thì alert bay thẳng về hộp thư khách và không admin nào
     * biết có lead mới — đúng thứ tính năng này sinh ra để sửa.
     */
    const to = resolveRecipient(fields);
    if (!to) {
      // Bug ở producer, không phải lỗi tạm thời — vẫn throw: drain retry rồi
      // park row FAILED kèm message này cho operator triage.
      throw new Error(`outbox payload for ${type} has no recipient email`);
    }
    const { subject, html } = renderEmail(type, fields, this.options.frontendUrl);

    /**
     * List-Unsubscribe (RFC 2369) — vá review Task 6 Khoản 2. CHỈ áp cho
     * NEWSLETTER_WELCOME (loại email duy nhất hiện có `subscriberId`/
     * `unsubscribeToken` trong payload).
     *
     * CỐ Ý KHÔNG kèm one-click RFC 8058 (`List-Unsubscribe-Post`): one-click
     * khiến mail client (Gmail, Outlook…) tự POST thẳng
     * `List-Unsubscribe=One-Click` vào URL trong header — body đó không khớp
     * schema JSON `{id, token}` mà endpoint `unsubscribe` của ta chờ, request
     * sẽ fail toàn bộ. Trỏ về TRANG xác nhận (GET, đọc thuần, không side
     * effect — xem `unsubscribeConfirm`) là lựa chọn an toàn: khách vẫn phải
     * tự bấm nút trên trang mới thực sự huỷ (POST).
     */
    const unsubscribeUrl = buildUnsubscribeUrl(this.options.frontendUrl, fields);
    const resendHeaders =
      type === EmailType.NEWSLETTER_WELCOME && unsubscribeUrl
        ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } }
        : {};

    const response = await this.httpPost(RESEND_EMAILS_URL, {
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [to],
        subject,
        html,
        ...resendHeaders,
      }),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Resend API failed (HTTP ${response.status}): ${response.body.slice(0, 300)}`,
      );
    }
    this.logger.log(`Delivered ${type} to ${to} via Resend`);
  }
}

/**
 * Render thuần theo từng type — export cho unit test. Toàn bộ copy English-only
 * (CLAUDE.md #7); các field trong payload đều được HTML-escape (tên người liên
 * hệ do user nhập).
 */
export function renderEmail(
  type: EmailType,
  payload: Record<string, unknown>,
  /** Chỉ dùng cho NEWSLETTER_WELCOME (link huỷ đăng ký) — các type khác bỏ qua tham số này. */
  frontendUrl?: string,
): { subject: string; html: string } {
  const f = (key: string): string | undefined => {
    const value = payload[key];
    return typeof value === 'string' && value.length > 0 ? escapeHtml(value) : undefined;
  };
  /**
   * Giá trị cho SUBJECT — subject là plain text, KHÔNG phải HTML.
   *
   * Dùng `f()` ở subject là sai: khách tên `O'Brien` sẽ hiện thành
   * `O&#39;Brien` trong hộp thư. Các subject cũ không lộ ra vì chúng chỉ
   * dùng chuỗi cố định hoặc mã booking (`BK-XXXX`, escape là no-op) —
   * ENQUIRY_ADMIN_ALERT là case đầu tiên nhét field tự do vào subject.
   *
   * Vẫn phải cắt CR/LF: ký tự xuống dòng trong header là đường header
   * injection (chèn thêm Bcc/To vào email).
   */
  const subjectText = (key: string): string | undefined => {
    const value = payload[key];
    if (typeof value !== 'string' || value.length === 0) return undefined;
    return value.replaceAll(/[\r\n]+/g, ' ').trim();
  };
  const code = f('code') ?? 'your booking';
  const greeting = `<p>Hi ${f('name') ?? 'there'},</p>`;
  const title = f('title');
  const money = f('amount') && f('currency') ? `${f('amount')} ${f('currency')}` : undefined;
  const footer = '<p>— The Tourism team</p>';
  const wrap = (...lines: (string | undefined)[]) =>
    lines.filter((line): line is string => Boolean(line)).join('\n');

  switch (type) {
    case EmailType.BOOKING_CONFIRMATION:
      return {
        subject: `Booking ${code} confirmed`,
        html: wrap(
          greeting,
          `<p>Your booking <strong>${code}</strong>${title ? ` for <strong>${title}</strong>` : ''} is confirmed.</p>`,
          money ? `<p>Amount paid: <strong>${money}</strong>.</p>` : undefined,
          footer,
        ),
      };
    case EmailType.BOOKING_REFUNDED:
      return {
        subject: `Refund issued for booking ${code}`,
        html: wrap(
          greeting,
          `<p>We have issued a refund${money ? ` of <strong>${money}</strong>` : ''} on booking <strong>${code}</strong>${title ? ` (${title})` : ''}.</p>`,
          f('reason') ? `<p>Reason: ${f('reason')}.</p>` : undefined,
          footer,
        ),
      };
    case EmailType.REVIEW_APPROVED:
      return {
        subject: 'Your review is now live',
        html: wrap(
          greeting,
          `<p>Your review${title ? ` of <strong>${title}</strong>` : ''} has been approved and published.</p>`,
          footer,
        ),
      };
    case EmailType.ENQUIRY_RECEIVED:
      return {
        subject: 'We received your enquiry',
        html: wrap(
          greeting,
          `<p>Thanks for reaching out${title ? ` about <strong>${title}</strong>` : ''} — we will get back to you shortly.</p>`,
          footer,
        ),
      };
    // Alert nội bộ: gửi tới hộp thư admin, KHÔNG gửi cho khách. Payload mang
    // sẵn mọi thứ admin cần để phân loại lead mà không phải mở CRM.
    case EmailType.ENQUIRY_ADMIN_ALERT:
      return {
        subject: `New enquiry from ${subjectText('name') ?? 'a visitor'}`,
        html: `<p>New enquiry received.</p>
<p><strong>Name:</strong> ${f('name')}<br/>
<strong>Email:</strong> ${f('email')}<br/>
<strong>Tour:</strong> ${f('tourTitle') ?? 'General enquiry'}</p>
<p>${f('message')}</p>`,
      };
    case EmailType.CANCELLATION_REQUESTED:
      return {
        subject: `Cancellation request received for booking ${code}`,
        html: wrap(
          greeting,
          `<p>We received your cancellation request for booking <strong>${code}</strong>${title ? ` (${title})` : ''}. Our team will review it and follow up.</p>`,
          f('reason') ? `<p>Your reason: ${f('reason')}.</p>` : undefined,
          footer,
        ),
      };
    case EmailType.CANCELLATION_APPROVED:
      return {
        subject: `Cancellation approved for booking ${code}`,
        html: wrap(
          greeting,
          `<p>Your cancellation of booking <strong>${code}</strong>${title ? ` (${title})` : ''} has been approved${money ? ` and <strong>${money}</strong> has been refunded` : ''}.</p>`,
          f('note') ? `<p>Note from our team: ${f('note')}.</p>` : undefined,
          footer,
        ),
      };
    case EmailType.CANCELLATION_DENIED:
      return {
        subject: `Cancellation request denied for booking ${code}`,
        html: wrap(
          greeting,
          `<p>Unfortunately we could not approve your cancellation request for booking <strong>${code}</strong>${title ? ` (${title})` : ''}.</p>`,
          f('note') ? `<p>Note from our team: ${f('note')}.</p>` : undefined,
          footer,
        ),
      };
    case EmailType.NEWSLETTER_WELCOME: {
      // Link huỷ đăng ký — vá review Task 6 Khoản 2 (GDPR/CAN-SPAM đòi hỏi
      // mọi email bản tin phải có đường huỷ tới được từ hộp thư thật).
      // `subscriberId`/`unsubscribeToken` do NewsletterService.subscribe()
      // sinh sẵn lúc enqueue; ở đây chỉ ghép URL, không tự tính lại token.
      const unsubscribeUrl = buildUnsubscribeUrl(frontendUrl, payload);
      return {
        subject: 'Welcome to the Tourism newsletter',
        html: wrap(
          greeting,
          '<p>Thanks for subscribing — expect fresh tours and travel ideas in your inbox.</p>',
          unsubscribeUrl
            ? `<p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>`
            : undefined,
          footer,
        ),
      };
    }
    case EmailType.EMAIL_CHANGED:
      return {
        subject: 'Your email address was changed',
        html: wrap(
          greeting,
          '<p>The email address on your account was just changed. If this was not you, please contact support immediately.</p>',
          footer,
        ),
      };
    // AUTH-2 (ADR-0008) — link do Better Auth sinh, truyền qua payload.url; `f()`
    // escape (an toàn HTML, `&amp;` trong href là chuẩn, client decode lại).
    case EmailType.PASSWORD_RESET:
      return {
        subject: 'Reset your password',
        html: wrap(
          greeting,
          f('url')
            ? `<p>We received a request to reset your password: <a href="${f('url')}">reset your password</a>.</p>`
            : '<p>We received a request to reset your password.</p>',
          '<p>If you did not request this, you can safely ignore this email.</p>',
          footer,
        ),
      };
    case EmailType.EMAIL_VERIFICATION:
      return {
        subject: 'Verify your email',
        html: wrap(
          greeting,
          f('url')
            ? `<p>Please confirm your email address: <a href="${f('url')}">verify your email</a>.</p>`
            : '<p>Please confirm your email address.</p>',
          footer,
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
 * Ghép URL trang xác nhận huỷ đăng ký (vá review Task 6 Khoản 2). CHỈ ghép
 * khi có ĐỦ `frontendUrl` lẫn cặp `subscriberId`/`unsubscribeToken` trong
 * payload — thiếu một trong ba (email cũ trước bản vá này, hoặc payload test
 * tối giản không mang hai field mới) thì bỏ qua, KHÔNG throw: đây là một
 * nhánh degrade êm, không phải lỗi chặn gửi email.
 */
function buildUnsubscribeUrl(
  frontendUrl: string | undefined,
  payload: Record<string, unknown>,
): string | undefined {
  const id = payload.subscriberId;
  const token = payload.unsubscribeToken;
  if (!frontendUrl || typeof id !== 'string' || typeof token !== 'string') return undefined;
  if (id.length === 0 || token.length === 0) return undefined;
  return `${frontendUrl}/newsletter/unsubscribe?id=${id}&token=${token}`;
}

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
