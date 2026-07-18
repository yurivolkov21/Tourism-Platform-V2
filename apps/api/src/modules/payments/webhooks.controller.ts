import {
  BadRequestException,
  Controller,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PaymentProvider } from '../../generated/prisma/enums.js';
import {
  PAYMENT_GATEWAYS,
  type PaymentGateway,
  resolveGateway,
  type VerifiedEvent,
} from './gateway.js';
import { PaymentsService } from './payments.service.js';

/**
 * Provider webhook receivers (spec P2 §3 W2). PLAIN Nest routes on purpose —
 * NOT oRPC procedures: the callers are Stripe/PayPal servers, not contract
 * clients, and signature verification needs the RAW request bytes, which the
 * contract layer would JSON-parse away.
 *
 * Raw body: the app boots with `NestFactory.create(..., { rawBody: true })`
 * (main.ts + webhook int-test bootstraps). Verified against
 * @nestjs/platform-fastify 11.1.28: the flag makes the adapter's JSON content
 * parser `parseAs: 'buffer'` and stash the untouched bytes on
 * `request.rawBody` before Fastify's normal JSON parsing — exactly what
 * `RawBodyRequest<FastifyRequest>` types here.
 *
 * Status contract (Nexora-proven):
 * - bad/missing signature → 400 (never 500 — the provider would retry forever
 *   against a request that can never succeed);
 * - processed AND duplicate → 200 fast (a duplicate is a success to the
 *   provider; anything non-2xx triggers redelivery).
 */
@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly payments: PaymentsService,
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[],
  ) {}

  @Post('stripe')
  @HttpCode(200)
  stripe(@Req() req: RawBodyRequest<FastifyRequest>) {
    return this.handle(PaymentProvider.STRIPE, req);
  }

  @Post('paypal')
  @HttpCode(200)
  paypal(@Req() req: RawBodyRequest<FastifyRequest>) {
    return this.handle(PaymentProvider.PAYPAL, req);
  }

  private async handle(provider: PaymentProvider, req: RawBodyRequest<FastifyRequest>) {
    // Unconfigured provider (e.g. PAYPAL before W5 lands the impl) → 404: for
    // this deployment the endpoint effectively does not exist.
    let gateway: PaymentGateway;
    try {
      gateway = resolveGateway(this.gateways, provider);
    } catch {
      throw new NotFoundException({
        code: 'WEBHOOK_PROVIDER_NOT_CONFIGURED',
        message: `No ${provider} gateway configured`,
      });
    }

    let verified: VerifiedEvent;
    try {
      verified = await gateway.verifyWebhook(req.rawBody ?? Buffer.alloc(0), req.headers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Rejected ${provider} webhook (signature invalid): ${message}`);
      throw new BadRequestException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: `Signature verification failed: ${message}`,
      });
    }

    const result = await this.payments.handleEvent(provider, verified);
    return {
      received: true as const,
      eventId: verified.eventId,
      type: verified.type,
      ...result,
    };
  }
}
