import { prisma } from '../auth/auth.config.js';

/**
 * Bọc `prisma.$transaction` để đếm transaction đang mở; trả hàm đọc số đếm (review S3). Ca "bust
 * SAU commit" của lệnh xoá đọc nó NGAY lúc bust được gọi: 0 nghĩa là transaction xoá đã commit.
 * Đọc DB trong mock thôi KHÔNG đủ: lượt đọc đi qua một kết nối khác của pool và thường tới
 * Postgres sau câu COMMIT, nên dời bust vào trong transaction vẫn xanh (đo 07/10: 3/3 lượt).
 *
 * Helper cho int spec — spec danh mục và spec điểm đến từng chép nguyên hàm này (review G6-F5).
 * Dùng `vi` toàn cục của `vitest.int.config.ts` (`globals: true`) như các spec, không import
 * `vitest`: thư mục này vẫn được build vào `dist` dù không mã chạy thật nào import nó. Spy sống
 * tới `vi.restoreAllMocks()` ở `beforeEach` của spec gọi nó.
 */
export function trackOpenTransactions(): () => number {
  let open = 0;
  const run = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
  vi.spyOn(prisma, '$transaction').mockImplementation(((...args: unknown[]) => {
    open += 1;
    return run(...args).finally(() => {
      open -= 1;
    });
  }) as never);
  return () => open;
}
