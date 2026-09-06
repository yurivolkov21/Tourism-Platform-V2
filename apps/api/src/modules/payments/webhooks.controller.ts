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
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../auth/public.decorator.js';
import { WEBHOOK_THROTTLE } from '../../config/throttle.js';
import { PaymentProvider } from '../../generated/prisma/enums.js';
import {
  PAYMENT_GATEWAYS,
  type PaymentGateway,
  resolveGateway,
  type VerifiedEvent,
} from './gateway.js';
import { PaymentsService } from './payments.service.js';

/**
 * Nơi nhận webhook của provider (spec P2 §3 W2). CỐ Ý dùng route Nest THUẦN —
 * KHÔNG phải procedure oRPC: bên gọi là server Stripe/PayPal chứ không phải
 * contract client, và verify signature cần RAW bytes của request, thứ mà tầng
 * contract sẽ JSON-parse mất.
 *
 * Raw body: app boot với `NestFactory.create(..., { rawBody: true })`
 * (main.ts + bootstrap của webhook int-test). Đã kiểm chứng với
 * @nestjs/platform-fastify 11.1.28: cờ này khiến JSON content parser của
 * adapter chạy `parseAs: 'buffer'` và cất nguyên bytes vào `request.rawBody`
 * trước bước parse JSON thường của Fastify — đúng thứ mà
 * `RawBodyRequest<FastifyRequest>` khai kiểu ở đây.
 *
 * Status contract (đã chứng minh ở Nexora):
 * - signature sai/thiếu → 400 (không bao giờ 500 — provider sẽ retry mãi mãi
 *   với một request không bao giờ thành công được);
 * - đã xử lý VÀ trùng lặp → 200 nhanh (với provider, duplicate là thành công;
 *   bất kỳ response non-2xx nào cũng kích hoạt redeliver).
 */
// Stripe/PayPal gọi vào — xác thực bằng CHỮ KÝ HMAC, không phải session.
// Quên @Public() ở đây = provider nhận 401, webhook retry rồi bỏ cuộc,
// booking kẹt PENDING dù tiền đã trừ. Có int test canh nhánh này.
//
// Throttle theo IP, trần rộng tay (W1 — xem WEBHOOK_THROTTLE): route public
// mà verify PayPal tốn một round-trip mạng, không trần là DoS ẩn danh rẻ tiền.
@Public()
@UseGuards(ThrottlerGuard)
@Throttle({ default: WEBHOOK_THROTTLE })
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
    // Provider chưa cấu hình (vd PAYPAL trước khi W5 ráp impl) → 404: với
    // deployment này endpoint coi như không tồn tại.
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
      // Body 400 là MÃ CỐ ĐỊNH (W1): chi tiết chỉ vào log — không phát miễn
      // phí cho kẻ dò webhook biết nó fail ở bước nào (header, parse, chữ ký).
      throw new BadRequestException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Webhook rejected',
      });
    }

    const result = await this.payments.handleEvent(provider, verified);
    // PHẢI chạy SAU handleEvent: PaymentEvent audit row cần ghi xong trước —
    // followUp nổ (throw → 500, provider retry) không được kéo theo mất log.
    // Không try/catch ở đây: throw lan thẳng ra ngoài, global exception
    // filter map nó thành 500 (Task 2: PayPal capture-on-approved dùng đúng
    // nhánh này).
    await gateway.followUp?.(verified);
    return {
      received: true as const,
      eventId: verified.eventId,
      type: verified.type,
      ...result,
    };
  }
}
