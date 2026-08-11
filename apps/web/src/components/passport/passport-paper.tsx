import type { ReactNode } from 'react';

/**
 * Ruột giấy của khu hộ chiếu — texture kẻ ngang mờ (ink + mask, tokens-only)
 * phủ phần nội dung DƯỚI hero. Tách thành component vì texture không thể nằm
 * ở layout nữa: từ vòng góp ý 11/08 mỗi trang mở bằng `ContentHero` (tối,
 * có vân topo riêng) — overlay giấy đè lên hero sẽ thành kẻ sọc trên nền tối.
 * Nền `bg-paper` vẫn ở layout (phủ trọn khu, trung hoà margin footer).
 */
export function PassportPaper({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex-1">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-ink/[0.04] [mask-image:repeating-linear-gradient(0deg,transparent_0_3px,black_3px_4px)]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
