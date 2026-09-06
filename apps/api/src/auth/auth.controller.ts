import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AUTH_THROTTLE } from '../config/throttle.js';
import { auth } from './auth.config.js';
import { Public } from './public.decorator.js';
import { WriteOnlyThrottlerGuard } from './write-only-throttler.guard.js';

/**
 * Route BA lộ user-enumeration mà không app nào của ta gọi (ADR-0017 §7c):
 * USER_NOT_FOUND ≠ INVALID_OTP trên cùng path — kẻ dò không cần biết mã.
 * BA không cho tắt từng route nên chuẩn hoá tại mount (xem handle()).
 */
const OTP_CHECK_PATH = '/api/auth/email-otp/check-verification-otp';
/** Body 400 duy nhất của path trên — khớp shape lỗi INVALID_OTP thật của BA. */
const OTP_CHECK_GENERIC_400 = JSON.stringify({ code: 'INVALID_OTP', message: 'Invalid OTP' });

/**
 * Mount Better Auth handler tại /api/auth/* (pattern Fastify chính chủ của BA
 * docs, bọc trong Nest controller để sống theo lifecycle + testable qua
 * Test.createTestingModule): Fastify request → Web `Request` → `auth.handler`
 * → chép Response về Fastify reply.
 */
// Mount Better Auth — chính là nơi đăng nhập, không thể đòi đã đăng nhập.
@Public()
// Trần Nest cho cụm auth (W2 mục 3): chỉ đếm non-GET, xem AUTH_THROTTLE.
@UseGuards(WriteOnlyThrottlerGuard)
@Throttle({ default: AUTH_THROTTLE })
@Controller()
export class AuthController {
  // NB: adapter Fastify (find-my-way) chỉ nhận wildcard `*` cuối route —
  // named wildcard kiểu Express (`*splat`) sẽ throw lúc route registration.
  @All('api/auth/*')
  async handle(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const headers = fromNodeHeaders(request.headers);
    // Body đã được Fastify parse → re-stringify; content-length cũ không còn
    // đúng nữa, phải bỏ để undici tự tính lại.
    headers.delete('content-length');

    const webRequest = new Request(url, {
      method: request.method,
      headers,
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });

    const response = await auth.handler(webRequest);

    // ADR-0017 §7c: mọi 400 của check-verification-otp trả CÙNG một body —
    // "email không tồn tại" và "mã sai" phải bất khả phân biệt từ ngoài.
    if (url.pathname === OTP_CHECK_PATH && response.status === 400) {
      reply.status(400).header('content-type', 'application/json').send(OTP_CHECK_GENERIC_400);
      return;
    }

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      // set-cookie KHÔNG được gộp qua forEach (mất cookie thứ hai) — xử riêng.
      if (key !== 'set-cookie') reply.header(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) reply.header('set-cookie', cookies);

    reply.send(response.body ? await response.text() : null);
  }
}
