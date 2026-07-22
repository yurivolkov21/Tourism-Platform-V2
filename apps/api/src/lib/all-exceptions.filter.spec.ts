import type { ArgumentsHost } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

/** Reply giả: bắt lại status + body mà filter gửi. */
function fakeHost(): { host: ArgumentsHost; sent: () => { status: number; body: unknown } } {
  let status = 0;
  let body: unknown;
  const reply = {
    status(code: number) {
      status = code;
      return this;
    },
    send(payload: unknown) {
      body = payload;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ArgumentsHost;
  return { host, sent: () => ({ status, body }) };
}

describe('AllExceptionsFilter (ADR-0010)', () => {
  const filter = new AllExceptionsFilter();

  it('HttpException chuẩn → suy code từ status', () => {
    const { host, sent } = fakeHost();
    filter.catch(new NotFoundException('Nope'), host);
    expect(sent()).toEqual({
      status: 404,
      body: { defined: false, code: 'NOT_FOUND', status: 404, message: 'Nope', data: null },
    });
  });

  it('guard 401/403 → UNAUTHORIZED / FORBIDDEN', () => {
    const a = fakeHost();
    filter.catch(new UnauthorizedException(), a.host);
    expect(a.sent().status).toBe(401);
    expect((a.sent().body as { code: string }).code).toBe('UNAUTHORIZED');

    const b = fakeHost();
    filter.catch(new ForbiddenException(), b.host);
    expect((b.sent().body as { code: string }).code).toBe('FORBIDDEN');
  });

  it('HttpException body object có `code` (webhook) → GIỮ NGUYÊN code', () => {
    const { host, sent } = fakeHost();
    filter.catch(
      new BadRequestException({ code: 'WEBHOOK_SIGNATURE_INVALID', message: 'bad sig' }),
      host,
    );
    expect(sent().body).toMatchObject({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'bad sig',
      status: 400,
    });
  });

  it('status lạ không trong bảng → HTTP_<status>', () => {
    const { host, sent } = fakeHost();
    filter.catch(new HttpException('teapot', 418), host);
    expect((sent().body as { code: string }).code).toBe('HTTP_418');
  });

  it('lỗi bất ngờ (không phải HttpException) → 500 ẩn chi tiết', () => {
    const { host, sent } = fakeHost();
    filter.catch(new Error('secret db string leak'), host);
    expect(sent()).toEqual({
      status: 500,
      body: {
        defined: false,
        code: 'INTERNAL_SERVER_ERROR',
        status: 500,
        message: 'Internal server error', // KHÔNG leak message thật
        data: null,
      },
    });
  });
});
