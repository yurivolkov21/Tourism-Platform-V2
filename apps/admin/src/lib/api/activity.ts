import type {
  AdminActivityListResult,
  AdminActivityRecordExportInput,
  AdminActivityRecordExportResult,
} from '@tourism/contract';
import type { ActivityQuery } from '@/lib/activity-query';
import { api, withAdminAuth } from './client';

/** Bọc mỏng `admin.activity.*` (ADR-0061) — cùng nếp `lib/api/users.ts`. Quyền gác ở API. */
export async function fetchAdminActivity(
  cookie: string,
  query: ActivityQuery,
): Promise<AdminActivityListResult> {
  return api.admin.activity.list(query, { context: withAdminAuth(cookie) });
}

/**
 * Báo một lượt xuất Excel đã dựng xong (ADR-0061 §5). Ném khi API lỗi — route xuất tự bắt, log
 * một dòng và vẫn giao file (spec §7).
 */
export async function recordAdminExport(
  cookie: string,
  input: AdminActivityRecordExportInput,
): Promise<AdminActivityRecordExportResult> {
  return api.admin.activity.recordExport(input, { context: withAdminAuth(cookie) });
}
