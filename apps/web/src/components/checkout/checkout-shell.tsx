import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';
import { CopyCodeButton } from '@/components/checkout/copy-code-button';

/**
 * Khung dùng chung của hai màn quay-về (`/checkout/success`, `/checkout/cancel`).
 *
 * Cố ý KHÔNG có hero tối: hai trang này là màn tiện ích ngắn, và một dải hero
 * cho một trang chỉ có sáu dòng chữ là trang trí chứ không phải cấu trúc. Thay
 * vào đó là một thẻ căn giữa trên nền trang — cùng họ với cụm auth.
 *
 * `tone` chỉ tô một chấm nhỏ cạnh tiêu đề, KHÔNG tô cả thẻ: theo nguyên tắc đã
 * chốt ở vòng thiết kế, tông màu mã hoá "có cần để mắt tới không", và ở đây
 * thông tin thật nằm ở mã đặt chỗ chứ không ở màu nền.
 */
export function CheckoutShell({
  tone,
  title,
  body,
  code,
  codeLabel,
  children,
}: {
  tone: 'success' | 'warning' | 'muted';
  title: string;
  body?: string;
  code?: string;
  codeLabel?: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center md:py-24">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 rounded-full',
            tone === 'success' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'muted' && 'bg-muted-foreground',
          )}
        />
        <h1 className="font-heading text-2xl font-semibold text-balance md:text-3xl">{title}</h1>
      </div>

      {body ? <p className="max-w-lg text-pretty text-muted-foreground">{body}</p> : null}

      {code ? (
        <div className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5">
          {codeLabel ? (
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              {codeLabel}
            </p>
          ) : null}
          {/* Khối mã đặt chỗ nâng thành "voucher": mã to hơn hẳn phần thân
              trang, mặt chữ mono (IBM Plex Mono — vai trò mã kỹ thuật/tham
              chiếu) giãn cách rộng để đọc/chép tay dễ, cùng nút chép cạnh bên. */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="font-mono text-2xl font-medium tracking-[0.2em] md:text-3xl">{code}</p>
            <CopyCodeButton code={code} />
          </div>
        </div>
      ) : null}

      {children}
    </section>
  );
}
