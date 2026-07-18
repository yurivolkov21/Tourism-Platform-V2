import { Injectable, Logger } from '@nestjs/common';
import { EmailType } from '../generated/prisma/enums.js';
import { defaultHttpPost, type HttpPost } from '../lib/provider-http.js';
import type { EmailDeliverer } from './deliverer.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface ResendDelivererOptions {
  apiKey: string;
  /** RFC-5322 From, e.g. `Tourism <noreply@tourism.test>` (env EMAIL_FROM). */
  from: string;
}

/**
 * Resend implementation of {@link EmailDeliverer} (spec P2 §3 W5) — the P2
 * binding behind EMAIL_DELIVERER when RESEND_API_KEY is set (worker.module.ts;
 * without the key the P1 ConsoleDeliverer stays, dev boots need no email —
 * Nexora pattern).
 *
 * Rendering is deliberately minimal: per-type subject + a few HTML lines from
 * the outbox payload fields (no react-email in P2 — P3 owns pretty templates).
 * Errors THROW so OutboxService.drainOnce counts the attempt and retries /
 * parks FAILED per its state machine; HTTP goes through the injectable
 * {@link HttpPost} seam (D2: unit tests stay offline).
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
    const to = typeof fields.email === 'string' ? fields.email : undefined;
    if (!to) {
      // Producer bug, not transient — still throw: drain retries then parks
      // the row FAILED with this message for operator triage.
      throw new Error(`outbox payload for ${type} has no recipient email`);
    }
    const { subject, html } = renderEmail(type, fields);

    const response = await this.httpPost(RESEND_EMAILS_URL, {
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: this.options.from, to: [to], subject, html }),
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
 * Pure per-type rendering — exported for unit tests. All copy is English-only
 * (CLAUDE.md #7); payload fields are HTML-escaped (contact names are
 * user-supplied).
 */
export function renderEmail(
  type: EmailType,
  payload: Record<string, unknown>,
): { subject: string; html: string } {
  const f = (key: string): string | undefined => {
    const value = payload[key];
    return typeof value === 'string' && value.length > 0 ? escapeHtml(value) : undefined;
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
      // Exhaustiveness backstop — a new EmailType fails loudly here (and the
      // spec's enum-coverage test fails first).
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
