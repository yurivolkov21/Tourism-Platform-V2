/**
 * Tri-state của mọi section dữ liệu API (ADR-0047 §3, port từ
 * `apps/web/src/lib/api/resilience.ts` — ADR-0016 §4): lỗi ≠ rỗng ≠ có nội dung.
 */
export type Settled<T> = { ok: true; data: T } | { ok: false; data: null };

export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch {
    return { ok: false, data: null };
  }
}

/** `failed` thắng `isEmpty`: empty-state khi API lỗi là nói dối người dùng. */
export function contentState(input: {
  failed: boolean;
  isEmpty: boolean;
}): 'error' | 'empty' | 'content' {
  if (input.failed) return 'error';
  return input.isEmpty ? 'empty' : 'content';
}
