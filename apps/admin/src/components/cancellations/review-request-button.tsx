import { ButtonLink } from '@tourism/ui/components/button-link';
import { ChevronRightIcon } from 'lucide-react';

/**
 * Nút "Review request" của hàng đợi `/cancellations` — khuôn
 * `@shadcn-space/button-06` ("Animated Border", user chốt 04/09): một vòng
 * gradient hình nón chạy quanh viền, ruột là nút outline nằm trên nền.
 *
 * BA chỗ bản registry không dùng thẳng được, vá ở đây:
 *
 * 1. **Bản gốc hardcode `#2b7fff`.** Luật 6 của repo là tokens-only, không
 *    hex. Đổi sang `--primary` nên nút tự đi theo theme và theo chế độ tối
 *    (bản gốc chỉ có một màu xanh cho cả hai chế độ).
 * 2. **Animation VÔ HẠN không có guard.** `motion-reduce:animate-none` là bắt
 *    buộc chứ không phải cẩn tắc: một vòng xoay không bao giờ dừng là đúng thứ
 *    `prefers-reduced-motion` sinh ra để tắt. Tắt rồi vẫn còn viền gradient
 *    tĩnh, nên nút không mất diện mạo.
 * 3. **Bản gốc là `<Button>`; đây là ĐIỀU HƯỚNG.** Dùng `ButtonLink` để giữ
 *    role `link` — lý do đầy đủ ở JSDoc của nó.
 *
 * Vì sao dùng khuôn nổi bật này ở đây: mỗi hàng đang mở là một việc CHƯA làm,
 * và cột Decision từ 04/09 chỉ còn đúng một lối đi. Nút phải mời bấm.
 */
export function ReviewRequestButton({
  href,
  label,
  ariaLabel,
}: {
  href: string;
  label: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative inline-flex h-fit w-fit overflow-hidden rounded-md">
      {/* Vòng gradient: một hình nón quét 60° trên nền trong suốt, quay quanh
          tâm. `-inset-full` để hình vuông xoay luôn phủ kín góc nút. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
      >
        <span className="absolute -inset-full animate-spin bg-[conic-gradient(from_0deg,var(--primary)_0deg,var(--primary)_40deg,transparent_60deg)] [animation-duration:4s] motion-reduce:animate-none" />
      </span>

      {/* `m-[1px]` chính là bề dày viền — ruột nút che phần giữa, chỉ chừa
          một vành gradient. Nền phải ĐẶC ở mọi trạng thái, kể cả hover, kẻo
          gradient lộ qua ruột. */}
      <ButtonLink
        variant="outline"
        size="sm"
        href={href}
        aria-label={ariaLabel}
        className="relative z-10 m-[1px] bg-background shadow-none hover:bg-background dark:bg-background dark:hover:bg-background"
      >
        {label}
        <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
      </ButtonLink>
    </div>
  );
}
