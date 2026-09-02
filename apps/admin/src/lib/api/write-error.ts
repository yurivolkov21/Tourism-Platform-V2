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
 * Codec trọn gói cho MỘT hành vi ghi (review F3 31/08 — refund và decide từng
 * chép nguyên bộ ba derive-codes/classify/copy từng biểu thức; F4 sẽ là bản
 * thứ ba nếu không nâng lên đây): đưa vào khối i18n `errors` của endpoint
 * (CHỈ mã contract) là có đủ tập mã + phân loại + tra câu, một nguồn duy nhất.
 */
export function createWriteErrorCodec<T extends Record<string, string>>(
  errors: T,
  options: {
    /**
     * Mã TRẠNG-THÁI-CŨ của vùng — thế giới đã đổi dưới chân dialog (hàng
     * biến mất, đã có người quyết trước, đã rời trạng thái cho phép). UI đóng
     * dialog + toast + refresh thay vì mời bấm lại. Khai ở đây cùng chỗ với
     * tập mã (vòng vá review F7: ba vùng từng tự viết `isStaleStateCode`
     * bằng tay — thêm mã thứ ba vào i18n thì codec cập nhật mà predicate
     * tay thì không, dialog đứng im không refresh).
     */
    stale?: ReadonlyArray<keyof T & string>;
    /**
     * Câu RIÊNG cho mã transport của vùng — mặc định là giọng ghi chung
     * `errors.write` ("có thể đã đi qua"). Một đường ĐỌC (drawer payment
     * events, vòng vá review F8) không có gì để lỡ đi qua nên khai giọng đọc
     * ở đây thay vì chép lại bộ ba classify/copy bằng tay bên ngoài codec.
     * Mã không khai rơi về câu chung.
     */
    transportCopy?: Partial<Record<TransportFailureCode, string>>;
  } = {},
) {
  type ContractCode = keyof T & string;
  const codes = new Set(Object.keys(errors) as ContractCode[]) as ReadonlySet<ContractCode>;
  const stale = new Set<string>(options.stale ?? []);
  const transport = options.transportCopy ?? {};
  return {
    /** Tập mã contract — test đối chiếu với `errorMap` thật của contract. */
    codes,
    /** Mã có phải trạng-thái-cũ (đóng dialog + refresh) — theo `options.stale`. */
    isStale: (code: ContractCode | TransportFailureCode): boolean => stale.has(code),
    /** Lỗi ném từ client oRPC → mã UI. Chạy phía SERVER (trong server action). */
    classify: (error: unknown): ContractCode | TransportFailureCode =>
      classifyWriteError(error, codes),
    /** Mã → câu cho admin. Mỗi mã một câu, không nhánh gộp (bất biến §2.4). */
    copy: (code: ContractCode | TransportFailureCode): string =>
      codes.has(code as ContractCode)
        ? errors[code as ContractCode]
        : (transport[code as TransportFailureCode] ??
          transportErrorCopy(code as TransportFailureCode)),
  };
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
