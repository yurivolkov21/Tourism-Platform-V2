import { ORPCError } from '@orpc/server';

/**
 * Mô tả MỘT DÒNG cho lỗi rơi vào onError của oRPC (W2 mục 6): code + status +
 * message, KHÔNG bao giờ serialize object — `cause` của
 * OUTPUT_VALIDATION_FAILED mang nguyên dữ liệu response bị từ chối (PII của
 * khách), dump nó là chép PII ra stdout của platform.
 */
export function describeOrpcError(error: unknown): string {
  if (error instanceof ORPCError) {
    return `${error.code} (${error.status}): ${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Lỗi có đáng đẩy Sentry không: ORPCError 4xx là nghiệp vụ bình thường
 * (NOT_FOUND, CONFLICT…) — đẩy hết là chôn tín hiệu thật dưới rác; 5xx và
 * mọi lỗi không phải ORPCError là thứ không ai chủ đích ném.
 */
/**
 * Stack cho lỗi KHÔNG phải ORPCError (500 thật) — bản đầu chỉ log một dòng
 * name/message nên TypeError trong handler prod không có file/line (vòng vá
 * review W2). ORPCError nghiệp vụ không cần stack.
 */
export function orpcErrorStack(error: unknown): string | undefined {
  if (error instanceof ORPCError) return undefined;
  return error instanceof Error ? error.stack : undefined;
}

export function isUnexpectedOrpcError(error: unknown): boolean {
  if (error instanceof ORPCError) return error.status >= 500;
  return true;
}
