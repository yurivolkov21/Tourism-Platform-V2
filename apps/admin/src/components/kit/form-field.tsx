'use client';

import { Label } from '@tourism/ui/components/label';
import type * as React from 'react';

/**
 * Một ô của form dialog: nhãn · control · (gợi ý) · (câu lỗi).
 *
 * Ra đời ở `departure-form-dialog.tsx` (vòng hai F12), rồi bị chép NGUYÊN VĂN
 * sang `category-form-dialog.tsx` (F14). Vòng review F14 bắt được bản chép và
 * đưa nó về kit trước khi màn `/destinations` của F15 chép lần thứ ba.
 *
 * `children` là RENDER-PROP nhận `describedBy` chứ không phải node thường: gợi
 * ý và câu lỗi chỉ hữu ích nếu trình đọc màn hình đọc chúng CÙNG ô nhập, nên
 * control phải trỏ `aria-describedby` tới đúng id đang tồn tại. Để mỗi chỗ gọi
 * tự ghép chuỗi id là mỗi nơi phải nhớ hai luật (có hint không, có lỗi không)
 * — và một `aria-describedby` trỏ vào id không tồn tại còn tệ hơn không có.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => React.ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter((value): value is string => value !== null)
    .join(' ');
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(describedBy === '' ? undefined : describedBy)}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive-emphasis">
          {error}
        </p>
      ) : null}
    </div>
  );
}
