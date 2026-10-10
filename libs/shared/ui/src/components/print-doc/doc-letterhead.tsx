import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';

/**
 * Đầu trang chung (G40, spec §2.2): trái là `brand` của app (logo, wordmark, dòng liên hệ), phải là
 * loại tài liệu, số (tuỳ) và mốc.
 *
 * Tông `photo` cho đầu trang nằm trên ảnh bìa: gắn scope `dark` — cùng lối các mảng tối cố định của
 * web (hero trang About, hero bài viết) — để `primary-emphasis` ra teal nhạt như bản thảo ("viên sau
 * teal nhạt") mà không thêm token. Chữ còn lại là `on-media`.
 */
export function DocLetterhead({
  brand,
  docType,
  docNumber,
  meta,
  tone = 'paper',
  className,
}: {
  brand: ReactNode;
  docType: string;
  docNumber?: string;
  meta: string;
  tone?: 'paper' | 'photo';
  className?: string;
}) {
  const photo = tone === 'photo';
  return (
    <header
      data-slot="doc-letterhead"
      data-tone={tone}
      className={cn('flex items-start justify-between gap-[10mm]', photo && 'dark', className)}
    >
      {brand}
      <div className="text-right">
        <p className="font-mono text-[7.5pt] font-medium tracking-[0.18em] text-primary-emphasis uppercase">
          {docType}
        </p>
        {docNumber ? (
          <p
            data-slot="doc-number"
            className={cn(
              'mt-[1mm] font-mono text-[13pt] font-medium tracking-[0.04em]',
              photo ? 'text-on-media' : 'text-foreground',
            )}
          >
            {docNumber}
          </p>
        ) : null}
        <p
          className={cn(
            'mt-[0.5mm] text-[7.5pt]',
            photo ? 'text-on-media/80' : 'text-muted-foreground',
          )}
        >
          {meta}
        </p>
      </div>
    </header>
  );
}
