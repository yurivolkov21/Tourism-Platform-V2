'use client';

import { Button } from '@tourism/ui/components/button';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useId } from 'react';

/**
 * Mảnh dùng chung của hai nhánh form đặt chỗ (Scheduled và Private).
 *
 * Tách ra vì cả hai đều cần đúng ba thứ này và chúng có luật riêng đáng giữ ở
 * một chỗ — nhất là `Field` (quan hệ nhãn ↔ ô nhập) và `FieldError` (lý do
 * không dùng `text-destructive` trần).
 */

/**
 * Bộ đếm số người.
 *
 * Ghép `button-group` + `input` — KHÔNG phải primitive `stepper`: cái đó là
 * luồng nhiều bước (Stepperize), không phải ô tăng giảm số.
 */
export function Stepper({
  label,
  value,
  onStep,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  value: number;
  onStep: (delta: number) => void;
  minusDisabled: boolean;
  plusDisabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="inline-flex items-center overflow-hidden rounded-lg border">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${label} −`}
          disabled={minusDisabled}
          onClick={() => onStep(-1)}
        >
          <MinusIcon />
        </Button>
        <span className="min-w-8 border-x px-2 py-1 text-center text-sm font-medium tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${label} +`}
          disabled={plusDisabled}
          onClick={() => onStep(1)}
        >
          <PlusIcon />
        </Button>
      </span>
    </div>
  );
}

/**
 * Nhãn + control + lỗi, đúng một khối (khuôn primitive `field`).
 *
 * `children` là RENDER PROP nhận id đã sinh, buộc caller gắn vào control. Bản
 * đầu bọc control trong `<label>` qua children trần, và cả Biome lẫn trình đọc
 * màn hình đều phải đoán rằng control thật sự nằm trong đó.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

/**
 * Lỗi field: dải nền pha destructive + chữ ink.
 *
 * KHÔNG dùng `text-destructive` trần như `field.tsx` của `@tourism/ui` đang
 * làm — đo được 2,83:1 trên card ở dark theme, dưới ngưỡng AA 4,5 mà chính
 * design brief §6 đặt ra. Nền pha giữ chữ ở trên 8:1 ở cả hai theme.
 */
export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-sm text-foreground">
      {children}
    </p>
  );
}
