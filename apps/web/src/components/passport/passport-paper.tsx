import type { ReactNode } from 'react';

/**
 * Ruột giấy của khu hộ chiếu — texture kẻ ngang mờ (ink + mask, tokens-only)
 * phủ phần nội dung DƯỚI hero. Tách thành component vì texture không thể nằm
 * ở layout: mỗi trang mở bằng `ContentHero` (tối, có vân topo riêng) —
 * overlay giấy đè lên hero sẽ thành kẻ sọc trên nền tối. Nền `bg-paper` vẫn
 * ở layout (phủ trọn khu, trung hoà margin footer).
 *
 * Gói tu sửa 11/08 — hai chi tiết "sổ thật" (toàn CSS, không transform 3D):
 * - GÁY SỔ mép trái (md+): dải gradient lõm + đường khâu chỉ nét đứt — trang
 *   giấy được ĐÓNG vào sổ chứ không trôi tự do.
 * - MÉP TRANG LỆCH TẦNG ở đáy: ba lá giấy hẹp dần thò ra dưới trang hiện
 *   tại — còn nhiều trang nữa xếp bên dưới.
 */
export function PassportPaper({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex-1">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-ink/[0.04] [mask-image:repeating-linear-gradient(0deg,transparent_0_3px,black_3px_4px)]"
      />
      {/* Gáy sổ: gradient lõm + đường khâu chỉ. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 bg-gradient-to-r from-ink/10 to-transparent md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-5 hidden border-l border-dashed border-ink/20 md:block"
      />
      <div className="relative">{children}</div>
      {/* Mép trang lệch tầng — mỗi lá hẹp hơn lá trên một nấc, mờ dần. */}
      <div aria-hidden="true" className="relative">
        <div className="mx-3 h-1 rounded-b-md border-x border-b border-ink/15 bg-paper" />
        <div className="mx-7 h-1 rounded-b-md border-x border-b border-ink/10 bg-paper" />
        <div className="mx-12 h-[3px] rounded-b-md border-x border-b border-ink/[0.07] bg-paper" />
      </div>
    </div>
  );
}
