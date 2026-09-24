/**
 * Lỗi nghiệp vụ mang MÃ contract, và MỘT hàm đổi nó thành lỗi oRPC ở controller.
 *
 * Ra đời ở F15 (nợ G3, bài học 4 của vòng review F14): `mapError` của danh mục
 * và của chuyến khởi hành trùng chữ ký lẫn cấu trúc, và F15 sắp chép bản thứ
 * ba. Lời giải lấy từ bản của chuyến khởi hành: lỗi MANG `code`, nên N mã gập
 * lại thành một nhánh `errors[error.code]` thay vì N nhánh `instanceof`.
 *
 * Nhận diện bằng `instanceof ContractError`, KHÔNG so `error.name` hay đọc một
 * thuộc tính `code` bất kỳ — bài học vòng hai F12: repo có năm lớp cùng tên
 * `TourNotFoundError` ở năm module, và một lỗi Prisma cũng mang `code`
 * (`P2002`…). Chỉ lỗi dựng từ lớp này mới được quyền thành phán quyết contract.
 *
 * Luật cho module dùng nó: service chỉ để lọt ra NGOÀI những `ContractError`
 * của chính vùng mình. Hàm này đổi mọi `ContractError` có mã mà procedure khai,
 * nên một lỗi mượn từ vùng khác lọt tới đây sẽ mang câu của vùng này.
 */
export class ContractError<Code extends string = string> extends Error {
  constructor(
    readonly code: Code,
    message: string,
    /**
     * Có gửi `message` này cho client không. Tắt ở các lỗi "không tìm thấy":
     * câu mặc định khai trong contract đã đủ, còn câu của service mang id —
     * thứ để đọc log, không phải để trả về.
     */
    readonly exposeMessage: boolean = true,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Lỗi của service → lỗi contract của ĐÚNG procedure đang chạy.
 *
 * `errors` khai theo TỪNG procedure nên hẹp hơn tập mã chung; một mã lọt sang
 * procedure không khai nó thì trả NGUYÊN lỗi (500 nhìn thấy được trong log)
 * thay vì biến thành một lỗi im lặng sai loại.
 */
export function toContractError(
  error: unknown,
  errors: Record<string, (init?: { message: string }) => Error>,
): unknown {
  if (error instanceof ContractError) {
    const make = errors[error.code];
    if (make) return error.exposeMessage ? make({ message: error.message }) : make();
  }
  return error;
}
