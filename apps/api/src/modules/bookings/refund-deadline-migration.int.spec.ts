import { prisma } from '../../auth/auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — migration mở rộng M1 của đợt hoàn
 * tiền một hạn chót (ADR-0041, spec 2026-09-15 §4.2).
 *
 * Kiểm trên CATALOG của Postgres chứ không qua Prisma client: client sinh từ
 * schema.prisma nên chỉ nói được schema muốn gì, không nói được DB thật đã nhận
 * gì. `ALTER FUNCTION … SET search_path` còn không có mặt trong schema.prisma,
 * nên đây là chỗ duy nhất canh nó.
 */
describe('migration 20260915120000_refund_deadline_expand', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enum EmailType có BOOKING_CANCELLED ở CUỐI — khớp thứ tự EmailTypeSchema', async () => {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT unnest(enum_range(NULL::"EmailType"))::text AS value
    `;
    expect(rows.at(-1)?.value).toBe('BOOKING_CANCELLED');
  });

  it('cancellation_requests.reason cho phép NULL — khách tự huỷ không bắt buộc ghi lý do', async () => {
    const rows = await prisma.$queryRaw<{ is_nullable: string }[]>`
      SELECT is_nullable::text AS is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cancellation_requests'
        AND column_name = 'reason'
    `;
    expect(rows).toEqual([{ is_nullable: 'YES' }]);
  });

  it('trigger function refunds_sum_within_total ghim search_path (mục CÒN TREO 09/09)', async () => {
    const rows = await prisma.$queryRaw<{ config: string[] | null }[]>`
      SELECT p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'refunds_sum_within_total'
    `;
    expect(rows).toEqual([{ config: ['search_path=public, pg_temp'] }]);
  });
});
