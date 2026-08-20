import { Injectable, Logger } from '@nestjs/common';
import { EmailType } from '../generated/prisma/enums.js';
import { defaultHttpPost, type HttpPost } from '../lib/provider-http.js';
import type { EmailDeliverer } from './deliverer.js';
import { buildUnsubscribeUrl, renderEmail } from './emails/render-email.js';
import { resolveRecipient } from './recipient.js';

// Re-export cho spec + mọi consumer cũ: render giờ sống ở emails/ (ADR-0025)
// nhưng "renderEmail của deliverer" vẫn là cùng một hàm.
export { renderEmail } from './emails/render-email.js';

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
 * Render đi qua react-email (ADR-0025, thay bản HTML trần của P2): layout
 * Nexora chung + copy giữ nguyên văn, xem `emails/render-email.tsx`. Lỗi
 * thì THROW để OutboxService.drainOnce đếm attempt rồi retry / park FAILED
 * theo state machine của nó; HTTP đi qua seam {@link HttpPost} inject được
 * (D2: unit test chạy offline).
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
    const { subject, html, text } = await renderEmail(type, fields, this.options.frontendUrl);

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
        // Bản plain-text đi kèm (deliverability) — render từ chính HTML.
        text,
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

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}
