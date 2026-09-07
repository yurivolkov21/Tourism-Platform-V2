import { ORPCError } from '@orpc/client';
import { describe, expect, it } from 'vitest';
import { ADMIN_FORBIDDEN_DIGEST, markAdminForbidden } from './forbidden';

// ADR-0026 AMEND 3 §B — admin bị thu hồi role giữa phiên: lỗi 403 từ oRPC
// phải mang digest ADMIN_FORBIDDEN để error boundary (client) nhận ra và đưa
// về /not-authorized; Next chuyển digest sang boundary kể cả production.
describe('markAdminForbidden', () => {
  it('ORPCError status 403 → gắn digest ADMIN_FORBIDDEN, trả lại CHÍNH lỗi đó', () => {
    const error = new ORPCError('FORBIDDEN', { status: 403 });
    const marked = markAdminForbidden(error);
    expect(marked).toBe(error);
    expect((marked as { digest?: string }).digest).toBe(ADMIN_FORBIDDEN_DIGEST);
  });

  it('ORPCError status khác (401, 500) → KHÔNG gắn digest', () => {
    for (const status of [401, 500]) {
      const marked = markAdminForbidden(new ORPCError('X', { status }));
      expect((marked as { digest?: string }).digest).toBeUndefined();
    }
  });

  it('lỗi không phải ORPCError → trả nguyên, không đụng', () => {
    const plain = new Error('mạng đứt');
    expect(markAdminForbidden(plain)).toBe(plain);
    expect((plain as { digest?: string }).digest).toBeUndefined();
  });
});
