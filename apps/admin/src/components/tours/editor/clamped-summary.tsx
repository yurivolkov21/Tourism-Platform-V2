'use client';

import { messages } from '@tourism/i18n';
import { useEffect, useRef, useState } from 'react';

const a = messages.admin.tours.editor.aside;

/**
 * Summary của thẻ xem trước, kẹp hai dòng như card web (spec 2026-10-05 §4 #1). Không bung
 * hết chữ: card thật vẫn cắt, khung xem trước mà cho đọc đủ là nói dối. Thay vào đó đo tràn
 * (`scrollHeight > clientHeight` — đoạn cao cố định `2lh`) và tràn thì nói thẳng ra.
 *
 * Đo lại khi chữ đổi và khi bề rộng khung đổi (ResizeObserver); jsdom không có
 * ResizeObserver nên chỉ đo một lần.
 */
export function ClampedSummary({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: đo lại mỗi khi chữ đổi
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setCut(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <>
      {/* Giữ chỗ 2 dòng như card web: tóm tắt rỗng không làm thẻ co lại. */}
      <p ref={ref} className="line-clamp-2 h-[2lh] text-xs text-muted-foreground">
        {text}
      </p>
      {cut ? <p className="text-xs text-muted-foreground">{a.preview.summaryCut}</p> : null}
    </>
  );
}
