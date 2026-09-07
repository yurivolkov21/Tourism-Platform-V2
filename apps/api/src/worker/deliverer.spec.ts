import { Logger } from '@nestjs/common';
import { EmailType } from '../generated/prisma/enums.js';
import { ConsoleDeliverer } from './deliverer.js';

/**
 * W2 mục 6 (audit cụm 6 — Vừa-Thấp): ConsoleDeliverer log NGUYÊN payload —
 * URL reset (mang token) + OTP ra stdout; lưới duy nhất trước đây là "prod
 * có RESEND_API_KEY nên không dùng deliverer này". Nay payload đi qua
 * redactDeep trước khi stringify — cùng máy che của bề mặt admin.
 */
describe('ConsoleDeliverer', () => {
  it('ở development KHÔNG che — đó là đường duy nhất lấy OTP/link reset khi không có RESEND_API_KEY', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      lines.push(String(message));
    });
    try {
      await new ConsoleDeliverer(false).deliver(EmailType.EMAIL_OTP, {
        email: 'khach@example.com',
        otp: '123456',
      });
    } finally {
      spy.mockRestore();
    }
    expect(lines.join('\n')).toContain('123456');
  });

  it('che url/otp trong payload trước khi log (ngoài development)', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      lines.push(String(message));
    });
    try {
      await new ConsoleDeliverer(true).deliver(EmailType.PASSWORD_RESET, {
        email: 'khach@example.com',
        url: 'http://localhost:3001/reset-password/token-tuyet-mat',
        otp: '123456',
      });
    } finally {
      spy.mockRestore();
    }
    const line = lines.join('\n');
    expect(line).toContain('PASSWORD_RESET');
    // Địa chỉ nhận vẫn hiện (debug dev cần biết gửi cho ai)…
    expect(line).toContain('khach@example.com');
    // …nhưng credential thì không.
    expect(line).not.toContain('token-tuyet-mat');
    expect(line).not.toContain('123456');
    expect(line).toContain('[redacted]');
  });
});
