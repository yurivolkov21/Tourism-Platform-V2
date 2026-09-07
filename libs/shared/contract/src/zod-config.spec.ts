import { describe, expect, it, vi } from 'vitest';

// ADR-0038 AMEND 1 §e: CSP production không có 'unsafe-eval'; zod 4 thử
// `Function("")` để bật JIT ngay lúc dựng z.object. Spec này nạp contract
// trong module graph MỚI (vitest cô lập theo file) với `Function` bị spy —
// một lần gọi là một vi phạm CSP trên prod.
describe('zod config qua @tourism/contract', () => {
  it('nạp contract + parse KHÔNG gọi Function() — jitless đứng trước mọi schema', async () => {
    const spy = vi.spyOn(globalThis, 'Function');
    const { z } = await import('zod');
    const contract = await import('./index.js');
    expect(z.config().jitless).toBe(true);
    expect(contract.BookingSchema.safeParse({}).success).toBe(false);
    expect(z.object({ a: z.string() }).safeParse({ a: 'x' }).success).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
