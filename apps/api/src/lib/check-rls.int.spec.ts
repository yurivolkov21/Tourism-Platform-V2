import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { TEST_DATABASE_URL } from '../../vitest.int.config.js';
import { prisma } from '../auth/auth.config.js';

/**
 * `scripts/check-rls.sh` là lưới CI cho bảng mới quên RLS (W2). CHANGELOG khai
 * "đã mutation-test" mà repo không có bằng chứng — đây là ca ÂM chạy được:
 * tắt RLS một bảng trên tourism_test → script phải đỏ và gọi tên bảng; bật lại
 * → xanh. Chạy trong int suite vì cần DB thật.
 */
const SCRIPT = path.resolve(process.cwd(), '../../scripts/check-rls.sh');

function runCheck() {
  return spawnSync('bash', [SCRIPT], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf8',
  });
}

describe('scripts/check-rls.sh', () => {
  afterAll(async () => {
    await prisma.$executeRawUnsafe('ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY');
    await prisma.$disconnect();
  });

  it('mọi bảng bật RLS → exit 0', () => {
    const res = runCheck();
    expect(res.status, res.stdout + res.stderr).toBe(0);
  });

  it('một bảng bị tắt RLS → exit 1 và gọi đúng tên bảng', async () => {
    await prisma.$executeRawUnsafe('ALTER TABLE subscribers DISABLE ROW LEVEL SECURITY');
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('subscribers');
    await prisma.$executeRawUnsafe('ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY');
    expect(runCheck().status).toBe(0);
  });
});
