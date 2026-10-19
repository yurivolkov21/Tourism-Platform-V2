/**
 * Gửi MỘT sự kiện thử lên Sentry qua chính `initObservability` của API (ADR-0010 AMEND 1),
 * để biết DSN đúng và sự kiện tới nơi mà không phải chờ một lỗi 500 thật.
 *
 * Chạy (script `sentry:test` build trước rồi mới chạy file này):
 *   pnpm --filter @tourism/api sentry:test
 * Với DSN production (Git Bash, từ `apps/api`; biến đã export thắng `.env.local`):
 *   export SENTRY_DSN="$(grep '^SENTRY_DSN=' .env.production | cut -d= -f2- | tr -d '\r')" \
 *     && pnpm sentry:test; unset SENTRY_DSN
 */
import * as Sentry from '@sentry/node';
import { captureException, initObservability } from '../dist/lib/observability.js';

const dsn = process.env.SENTRY_DSN;
if (!dsn) {
  console.error('\n✗ Thiếu SENTRY_DSN — không có gì để thử.\n');
  process.exit(1);
}

initObservability({ dsn, environment: process.env.NODE_ENV ?? 'development' });
const stamp = new Date().toISOString();
captureException(new Error(`Sentry test from sentry:test at ${stamp}`));

// Sự kiện gửi bất đồng bộ: chờ hàng đợi xả xong rồi mới thoát.
const flushed = await Sentry.flush(5000);
if (!flushed) {
  console.error('\n✗ Hết 5 giây mà chưa gửi xong — kiểm mạng hoặc DSN.\n');
  process.exit(1);
}
console.log(`\n✓ Đã gửi sự kiện thử (${stamp}). Mở Sentry → Issues để thấy nó.\n`);
