import { All, Controller, Req, Res } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from './auth.config.js';

/**
 * Mount Better Auth handler tại /api/auth/* (pattern Fastify chính chủ của BA
 * docs, bọc trong Nest controller để sống theo lifecycle + testable qua
 * Test.createTestingModule): Fastify request → Web `Request` → `auth.handler`
 * → chép Response về Fastify reply.
 */
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
