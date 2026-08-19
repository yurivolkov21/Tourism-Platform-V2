import type { ReactNode } from 'react';

/**
 * Lỗi inline DƯỚI MỘT Ô NHẬP của cụm auth/account (sweep bắt lỗi form
 * 19/08). Cùng khuôn `role="alert"` + `text-xs text-destructive-emphasis` mà
 * khối lỗi cấp form của login-form đã dùng — chỉ thêm `id` để ô nhập trỏ tới
 * qua `aria-describedby`, cho trình đọc màn hình đọc lỗi ngay khi focus ô.
 *
 * Trả `null` khi không có lỗi để JSX caller viết một dòng, không phải bọc
 * ternary ở từng ô.
 */
export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive-emphasis">
      {children}
    </p>
  );
}

/** Cặp prop a11y cho ô nhập có lỗi — gắn `aria-invalid` + `aria-describedby`
 *  trỏ tới `<FieldError id>` cùng cặp; không lỗi thì cả hai vắng mặt. */
export function invalidProps(errorId: string, error: string | undefined) {
  return error ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {};
}
