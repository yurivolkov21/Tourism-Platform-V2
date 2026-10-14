/**
 * Trần kết nối Postgres của MỘT tiến trình API (G23, ADR-0024 AMEND 4).
 *
 * Session pooler của Supabase (cổng 5432) nhận tối đa `SESSION_POOLER_CLIENT_CAP`
 * client cùng lúc; client vượt trần nhận `EMAXCONNSESSION`, với Prisma là một HTTP 500.
 * Một tiến trình mở HAI pool riêng (client Prisma dùng chung và pg-boss của worker chạy
 * kèm), và lúc Render deploy thì bản cũ sống tới khi bản mới qua health check, kết nối
 * rảnh của bản cũ vẫn giữ phiên tới khi nó tắt. Nên hai pool cộng lại phải vừa cho
 * `OVERLAPPING_INSTANCES` instance cùng dùng hết, chừa chỗ cho một phiên chạy tay.
 * `db-pool.spec.ts` khoá ràng buộc này.
 */

/** `pool_size` của Session pooler hiện tại — lỗi Supavisor ghi "limited to pool_size: 15". */
export const SESSION_POOLER_CLIENT_CAP = 15;

/** Bản cũ và bản mới cùng giữ phiên trong lúc Render chuyển traffic (đo 14/10: 8 giây). */
export const OVERLAPPING_INSTANCES = 2;

/** Chỗ chừa cho một phiên chạy tay, ví dụ `prisma migrate deploy` từ máy dev. */
export const MANUAL_SESSION_RESERVE = 1;

/**
 * Pool của client Prisma dùng chung cho HTTP và worker. Lúc dồn tải, request xếp hàng
 * chờ kết nối thay vì nhận 500; instance free chỉ có 0,1 CPU nên CPU mới là nút thắt.
 */
export const PRISMA_POOL_MAX = 5;

/**
 * Pool riêng của pg-boss. Nó chỉ chạy câu ngắn (poll, ghi trạng thái job) và không giữ
 * kết nối trong lúc handler chạy; đo 14/10 nó mở 5 tới 7 phiên lúc khởi động và mỗi khi
 * sáu vòng poll dồn lại, rồi nhả về 2 khi rảnh.
 */
export const PGBOSS_POOL_MAX = 2;

/** Tên phiên của Prisma trong `pg_stat_activity` và log Supavisor; pg-boss tự đặt `pgboss`. */
export const PRISMA_APPLICATION_NAME = 'tourism-api';

/** Số phiên tối đa khi `instances` instance cùng dùng hết cả hai pool. */
export function peakSessions(prismaMax: number, pgBossMax: number, instances: number): number {
  return instances * (prismaMax + pgBossMax);
}

/** Cấu hình pool cho `PrismaPg` — hàm thuần để test khoá được mà không phải dựng client. */
export function prismaPoolConfig(connectionString: string): {
  connectionString: string;
  max: number;
  application_name: string;
} {
  return { connectionString, max: PRISMA_POOL_MAX, application_name: PRISMA_APPLICATION_NAME };
}

/** Phần kết nối trong cấu hình `PgBoss`; schema `pgboss` do nơi gọi đặt. */
export function pgBossPoolConfig(connectionString: string): {
  connectionString: string;
  max: number;
} {
  return { connectionString, max: PGBOSS_POOL_MAX };
}
