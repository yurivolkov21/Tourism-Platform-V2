/**
 * Tri-state của mọi section dữ liệu API (ADR-0016 §4, kế thừa lib/resilience
 * Nexora): lỗi ≠ rỗng ≠ có nội dung. `settle` không bao giờ throw để page
 * SSG/ISR không sập lúc build khi API hắt hơi — lưới an toàn mà ADR-0016 §3
 * dựa vào cho quyết định "build với API sống".
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
