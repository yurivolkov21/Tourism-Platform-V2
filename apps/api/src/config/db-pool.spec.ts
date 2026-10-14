import {
  MANUAL_SESSION_RESERVE,
  OVERLAPPING_INSTANCES,
  PGBOSS_POOL_MAX,
  PRISMA_APPLICATION_NAME,
  PRISMA_POOL_MAX,
  peakSessions,
  pgBossPoolConfig,
  prismaPoolConfig,
  SESSION_POOLER_CLIENT_CAP,
} from './db-pool.js';

/**
 * G23 (ADR-0024 AMEND 4): Session pooler của Supabase từ chối client thứ 16. Spec này
 * khoá ràng buộc giữa hai pool của một tiến trình và trần ấy, để ai nâng một con số
 * mà quên lúc deploy có hai instance cùng giữ phiên thì CI đỏ.
 */
describe('trần pool kết nối (G23)', () => {
  it('hai instance chồng nhau dùng hết cả hai pool vẫn chừa chỗ cho một phiên chạy tay', () => {
    const peak = peakSessions(PRISMA_POOL_MAX, PGBOSS_POOL_MAX, OVERLAPPING_INSTANCES);
    expect(peak + MANUAL_SESSION_RESERVE).toBeLessThanOrEqual(SESSION_POOLER_CLIENT_CAP);
  });

  it('cấu hình cũ (Prisma 10, pg-boss theo mặc định 10 của pg.Pool) vượt trần ngay với một instance', () => {
    // Đúng ca đo 14/10: một instance vừa thức giữ 15 phiên rồi bị từ chối phiên thứ 16.
    expect(peakSessions(10, 10, 1)).toBeGreaterThan(SESSION_POOLER_CLIENT_CAP);
  });

  it('cộng hai pool rồi nhân số instance', () => {
    expect(peakSessions(5, 2, 2)).toBe(14);
    expect(peakSessions(5, 2, 1)).toBe(7);
  });

  it('Prisma nhận đúng trần và tên phiên riêng', () => {
    expect(prismaPoolConfig('postgresql://u:p@host:5432/db')).toEqual({
      connectionString: 'postgresql://u:p@host:5432/db',
      max: PRISMA_POOL_MAX,
      application_name: PRISMA_APPLICATION_NAME,
    });
  });

  it('pg-boss nhận đúng trần; tên phiên để pg-boss tự đặt là pgboss', () => {
    expect(pgBossPoolConfig('postgresql://u:p@host:5432/db')).toEqual({
      connectionString: 'postgresql://u:p@host:5432/db',
      max: PGBOSS_POOL_MAX,
    });
  });

  it('tên phiên của Prisma khác tên pg-boss tự đặt, để log Supavisor tách được hai nguồn', () => {
    expect(PRISMA_APPLICATION_NAME).not.toBe('pgboss');
    expect(PRISMA_APPLICATION_NAME).not.toBe('Supavisor');
  });
});
