/**
 * Ô sai ĐẦU TIÊN theo thứ tự hiển thị — màn gọi `focus()` trên ref của ô này sau
 * khi kiểm ở máy (spec P5b-1 §5).
 *
 * Tách khỏi component để test thẳng: dò focus trong cây render vừa chậm vừa phụ
 * thuộc chi tiết dựng cây, còn thứ cần canh ở đây chỉ là "ô nào đứng trước".
 */
export function firstInvalidField<F extends string>(
  errors: Partial<Record<F, string>>,
  order: readonly F[],
): F | null {
  return order.find((field) => errors[field] !== undefined) ?? null;
}
