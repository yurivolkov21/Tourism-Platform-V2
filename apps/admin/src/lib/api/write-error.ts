import { isDefinedError, ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';

/**
 * Phân loại lỗi DÙNG CHUNG cho mọi hành vi GHI của admin (refund F2, decide
 * F3, moderate F4…) — sinh ra ở vòng review F2 31/08 để ba vùng không chép
 * riêng ba bản classify + ba câu "hết phiên".
 *
 * Hai tầng mã tách bạch (bất biến spec P4b §2.4):
 * - Mã CONTRACT của từng endpoint: caller đưa tập mã của mình vào
 *   (`contractCodes`) — nhận diện bằng `isDefinedError` CỦA oRPC cộng phép
 *   thử thành viên, không so `code` trần (một ORPCError từ tầng khác trùng
 *   tên không được phép giả làm phán quyết contract).
 * - Mã TRANSPORT dùng chung: hết phiên (401) / mất quyền (403) / còn lại là
 *   GENERIC — "không biết đã đi tới đâu". Copy ở `messages.admin.errors.write`.
 *
 * Chạy phía SERVER (trong server action): `ORPCError` không sống sót qua ranh
 * giới action, nên action phân loại xong mới trả mã trần xuống client.
 */

export type TransportFailureCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'GENERIC';

export function classifyWriteError<Code extends string>(
  error: unknown,
  contractCodes: ReadonlySet<Code>,
): Code | TransportFailureCode {
  if (error instanceof ORPCError) {
    // `isDefinedError` là con dấu của oRPC: lỗi này do CONTRACT khai, không
    // phải một ORPCError trùng tên từ tầng khác — điều kiện CẦN trước khi so
    // thành viên (một mã giả mạo không được phép thành phán quyết contract).
    if (isDefinedError(error) && contractCodes.has(error.code as Code)) {
      return error.code as Code;
    }
    if (error.status === 401) return 'UNAUTHORIZED';
    if (error.status === 403) return 'FORBIDDEN';
  }
  return 'GENERIC';
}

/** Câu cho mã transport — một giọng cho cả admin. */
export function transportErrorCopy(code: TransportFailureCode): string {
  return messages.admin.errors.write[code];
}

/**
 * Mã "kết cục không rõ" — request có thể ĐÃ tới provider/API rồi mới đứt.
 * UI phải đối xử khác với mã contract (đóng dialog + refresh cho nhìn dữ
 * liệu tươi trước khi thử lại, thay vì mời bấm lại tại chỗ): bấm lại mù sau
 * một kết cục không rõ là công thức refund đúp.
 */
export function isUncertainOutcome(code: string): boolean {
  return code === 'GENERIC';
}
