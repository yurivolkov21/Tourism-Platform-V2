import { type AnyContractProcedure, isContractProcedure } from '@orpc/contract';
import type { AdminProcedureKey } from './admin-access.js';
import { contract } from './contract.js';

/**
 * Bản liệt kê LÚC CHẠY của mọi thủ tục `contract.admin.*` (ADR-0052 §3) — cho decorator
 * `@AdminImplement` của API (tra khoá từ đối tượng thủ tục) và cho int test quét quyền (đọc
 * method + path). Nằm ở barrel, KHÔNG ở subpath `admin-access`: nó cần giá trị `contract`.
 */
export interface AdminProcedureEntry {
  key: AdminProcedureKey;
  method: string;
  path: string;
  procedure: AnyContractProcedure;
}

function collect(node: Record<string, unknown>, prefix: string, out: AdminProcedureEntry[]): void {
  for (const [name, child] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (isContractProcedure(child)) {
      const route = child['~orpc'].route;
      // oRPC mặc định POST khi route không khai method — cùng luật `fallbackContractConfig`.
      out.push({
        key: key as AdminProcedureKey,
        method: route.method ?? 'POST',
        path: route.path ?? '',
        procedure: child,
      });
    } else if (child !== null && typeof child === 'object') {
      collect(child as Record<string, unknown>, key, out);
    }
  }
}

let cached: readonly AdminProcedureEntry[] | undefined;

export function listAdminProcedures(): readonly AdminProcedureEntry[] {
  if (!cached) {
    const out: AdminProcedureEntry[] = [];
    collect(contract.admin as unknown as Record<string, unknown>, '', out);
    cached = out;
  }
  return cached;
}

/** Khoá của một thủ tục admin, tra bằng ĐỐI TƯỢNG (so `===`); không phải thủ tục admin → undefined. */
export function adminProcedureKey(procedure: unknown): AdminProcedureKey | undefined {
  return listAdminProcedures().find((entry) => entry.procedure === procedure)?.key;
}
