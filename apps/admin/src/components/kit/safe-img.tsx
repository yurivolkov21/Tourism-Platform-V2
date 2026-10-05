'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ImageOffIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Ô ảnh thu nhỏ của admin (spec 2026-10-05 §4 #13). Ảnh hỏng — Cloudinary đã xoá, hay một
 * tham chiếu treo như review của nợ G22 — hiện icon kèm tên "Photo unavailable" thay cho ô
 * xám trống không nói gì.
 *
 * `<img>` thường chứ không `next/image`: URL Cloudinary đã mang sẵn `f_auto,q_auto`
 * (ADR-0005), và `next/image` ném khi host nằm ngoài `remotePatterns`.
 *
 * Ngoài `onError`, đo lại một lần sau mount: ảnh hỏng TRƯỚC khi React hydrate thì sự kiện
 * `error` đã trôi qua. `complete && naturalWidth === 0` là "tải xong mà không có ảnh".
 */
export function SafeImg({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Cỡ ô (vd `size-10`) — áp cho cả ảnh lẫn ô thay thế để bố cục không giật. */
  className?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: src đổi là ảnh mới — xoá dấu hỏng cũ, đo lại
  useEffect(() => {
    setBroken(false);
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setBroken(true);
  }, [src]);

  if (broken) {
    return (
      <span
        role="img"
        aria-label={messages.admin.table.photoUnavailable}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border border-dashed bg-muted text-muted-foreground',
          className,
        )}
      >
        <ImageOffIcon aria-hidden="true" className="size-4" />
      </span>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: thumbnail cỡ cố định, URL Cloudinary đã tối ưu (ADR-0005)
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={cn('shrink-0 rounded-md object-cover', className)}
    />
  );
}
