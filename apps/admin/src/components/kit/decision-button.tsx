'use client';

import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { ShieldCheckIcon, ShieldXIcon } from 'lucide-react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import type * as React from 'react';

/**
 * Nút quyết định của hàng đợi admin — approve · unapprove · deny. Dựng theo
 * `button-23` ("Permissions") của Shadcn Space, user chốt 01/09. Registry khai
 * ở `components.json` (`@shadcn-space`), kéo lại bản gốc bằng
 * `pnpm dlx shadcn@latest view @shadcn-space/button-23`.
 *
 * Ở KIT vì có hai vùng tiêu thụ ngay (`/cancellations` decide, `/reviews`
 * moderate) — đúng luật §2.1: kit mọc từ vùng thật, không dựng abstraction
 * trước.
 *
 * ## Bản gốc lệch chỗ nào
 *
 * Nó viết `bg-teal-400/10 text-teal-400` — màu bảng Tailwind thô, phạm luật
 * tokens-only (CLAUDE.md #6). Nhưng công thức thì đúng, và hoá ra repo đã có
 * sẵn: variant `destructive` của `@tourism/ui` CHÍNH LÀ
 * `bg-destructive/10 text-destructive-emphasis hover:bg-destructive/20`. Nên
 * nhánh deny dùng thẳng variant sẵn có, còn nhánh approve chỉ việc soi gương
 * nó bằng `--success`. Hai nút thành một cặp đối xứng thật, không phải một
 * bên đặc một bên nhạt như bản demo.
 *
 * Đo (ADR-0027 §Số đo mở rộng): approve 5.49 lúc nghỉ · 4.99 khi hover · deny
 * 5.52 / 5.05 — cả bốn trên ngưỡng 4.5 của chữ.
 */

// Khai kiểu `Variants` tường minh thay vì `as const`: `as const` biến mảng
// keyframe thành `readonly`, mà Motion đòi mảng mutable — đã đo, typecheck đỏ.
const BUTTON_MOTION: Variants = {
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

/** Lắc đầu — chữ ký của nhánh từ chối ở bản gốc. */
const DENY_ICON_MOTION: Variants = {
  initial: { rotate: 0, scale: 1 },
  hover: {
    rotate: [0, -10, 10, -10, 10, 0],
    scale: 1.1,
    transition: { duration: 0.45, ease: 'easeInOut' },
  },
};

/** Nảy lên — chữ ký của nhánh chấp thuận. */
const APPROVE_ICON_MOTION: Variants = {
  initial: { scale: 1, y: 0 },
  hover: {
    scale: 1.15,
    y: [0, -4, 2, -1, 0],
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

const MotionButton = motion.create(Button);
const MotionShieldCheck = motion.create(ShieldCheckIcon);
const MotionShieldX = motion.create(ShieldXIcon);

export interface DecisionButtonProps {
  /**
   * `approve` cho cú đi tới (duyệt yêu cầu, hiện review); `deny` cho cú chặn
   * lại (từ chối, gỡ review đã hiện). Quyết cả màu lẫn kiểu chuyển động của
   * icon — hai thứ phải nói cùng một điều.
   */
  tone: 'approve' | 'deny';
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export function DecisionButton({ tone, children, disabled, onClick }: DecisionButtonProps) {
  const reduced = useReducedMotion();
  const approve = tone === 'approve';

  return (
    <MotionButton
      type="button"
      size="sm"
      // Nhánh deny mượn nguyên variant sẵn có; nhánh approve soi gương nó bằng
      // `--success` (variant `success` chưa tồn tại trong `@tourism/ui`, và
      // thêm nó là đụng gói dùng chung với web — chưa đáng cho một ca).
      variant={approve ? 'ghost' : 'destructive'}
      className={cn(
        approve &&
          'bg-success/10 text-success hover:bg-success/20 hover:text-success focus-visible:border-success/40 focus-visible:ring-success/20',
      )}
      disabled={disabled}
      onClick={onClick}
      initial="initial"
      // Tôn trọng `prefers-reduced-motion`: bỏ cả phóng nút lẫn cựa icon.
      whileHover={reduced ? undefined : 'hover'}
      whileTap={reduced ? undefined : 'tap'}
      variants={reduced ? undefined : BUTTON_MOTION}
    >
      {children}
      {approve ? (
        <MotionShieldCheck
          aria-hidden="true"
          data-icon="inline-end"
          variants={reduced ? undefined : APPROVE_ICON_MOTION}
        />
      ) : (
        <MotionShieldX
          aria-hidden="true"
          data-icon="inline-end"
          variants={reduced ? undefined : DENY_ICON_MOTION}
        />
      )}
    </MotionButton>
  );
}
