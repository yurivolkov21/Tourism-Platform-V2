import { Injectable, Logger } from '@nestjs/common';
import { EmailType } from '../generated/prisma/enums.js';
import { defaultHttpPost, type HttpPost } from '../lib/provider-http.js';
import type { EmailDeliverer } from './deliverer.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface ResendDelivererOptions {
  apiKey: string;
  /** From theo RFC-5322, vd `Tourism <noreply@tourism.test>` (env EMAIL_FROM). */
  from: string;
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
    const to =
      typeof fields.to === 'string' && fields.to.length > 0
        ? fields.to
        : typeof fields.email === 'string'
          ? fields.email
          : undefined;
    if (!to) {
      // Bug ở producer, không phải lỗi tạm thời — vẫn throw: drain retry rồi
      // park row FAILED kèm message này cho operator triage.
      throw new Error(`outbox payload for ${type} has no recipient email`);
    }
    const { subject, html } = renderEmail(type, fields);

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
    case EmailType.NEWSLETTER_WELCOME:
      return {
        subject: 'Welcome to the Tourism newsletter',
        html: wrap(
          greeting,
          '<p>Thanks for subscribing — expect fresh tours and travel ideas in your inbox.</p>',
          footer,
        ),
      };
    case EmailType.EMAIL_CHANGED:
      return {
        subject: 'Your email address was changed',
        html: wrap(
          greeting,
          '<p>The email address on your account was just changed. If this was not you, please contact support immediately.</p>',
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
