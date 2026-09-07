import { All, Controller, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AUTH_THROTTLE } from '../config/throttle.js';
import { auth } from './auth.config.js';
import { Public } from './public.decorator.js';

/**
 * Mount Better Auth handler tại /api/auth/* (pattern Fastify chính chủ của BA
 * docs, bọc trong Nest controller để sống theo lifecycle + testable qua
 * Test.createTestingModule): Fastify request → Web `Request` → `auth.handler`
 * → chép Response về Fastify reply.
 */
// Mount Better Auth — chính là nơi đăng nhập, không thể đòi đã đăng nhập.
@Public()
// Trần Nest cho cụm auth (W2 mục 3): AUTH_THROTTLE đè default của guard
// toàn cục ADR-0037 (không cần @UseGuards riêng — đếm đôi cùng key). Guard
// nối pathname vào key vì handler này là wildcard — mỗi đường auth một bucket.
// Route `check-verification-otp` lộ enumeration bị TẮT bằng `disabledPaths`
// trong auth.config (ADR-0017 §7c), không còn vá body ở đây.
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
