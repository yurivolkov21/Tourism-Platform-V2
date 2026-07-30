'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { REVEAL_EASE } from '@/lib/motion';

// `REVEAL_EASE` (ease điện ảnh của lối forged) từng khai ở ĐÂY và `lib/motion.ts`
// chép lại — file này là nơi nó sinh ra. Bản cục bộ xoá 30/07 khi dedup: giữ hai
// khai báo cùng giá trị nghĩa là một ngày nào đó sửa một bên, và hero /about với
// hero trang vùng lặng lẽ chạy hai đường cong hơi khác nhau. Nguồn duy nhất giờ ở
// `lib/motion.ts`, và `motion.spec.ts` canh giá trị đó.

/**
 * Một DÒNG heading trượt lên từ dưới khuôn cắt: khuôn `overflow-hidden` đứng yên,
 * chữ bên trong đi từ `y:120` về 0. Khác `Reveal` (bọc cả khu, chạy khi cuộn tới):
 * cái này chạy LÚC MOUNT vì nó dành cho màn hình đầu tiên, và nó cắt chữ ở mép
 * khuôn nên chuyển động đọc ra là "chữ hiện lên từ sau tấm màn".
 *
 * `y` là transform nên `MotionConfig reducedMotion="user"` ở root layout tự tắt
 * nó khi người dùng bật giảm chuyển động — không cần guard riêng ở đây.
 */
export function RevealLine({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <motion.span
        className="block"
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay, ease: REVEAL_EASE }}
      >
        {children}
      </motion.span>
    </div>
  );
}
