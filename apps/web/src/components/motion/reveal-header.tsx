'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { AMPLITUDE, HEADER_DELAY, SPRING, SPRING_HEADING } from '@/lib/motion';

/**
 * Cascade header của một khu: tiêu đề trượt lên trước, đoạn dẫn theo sau, CTA đóng
 * nhịp. `SectionEyebrow` (đã có sẵn, y:-20 delay 0.2) là phần tử thứ tư của cùng
 * cascade — nó nằm trên tiêu đề nên observer của nó bắn sớm hơn theo vị trí cuộn.
 *
 * Ba lý do file này tồn tại thay vì gõ `motion.h2` inline như 19 component cũ:
 *
 *  1. **Giữ khu ở phía SERVER.** 7 trong 9 khu của trang vùng là Server Component.
 *     `motion.*` inline buộc chúng thêm `'use client'`; tách phần động ra đây thì
 *     chỉ file này là client, còn khu vẫn render trên server.
 *  2. **Một chỗ để đổi biên độ.** `RISE` là con số duy nhất, không phải chín bản.
 *  3. **Không có con số nào ở chỗ gọi.** Nhịp gọi bằng TÊN (`beat="lede"`), nên
 *     không ai gõ được `delay: 0.15` cho riêng một khu.
 *
 * ⚠️ **CHỈ animate transform, KHÔNG animate opacity.** Đây là ràng buộc kỹ thuật,
 * không phải khẩu vị: motion render `initial` thành `style` inline ngay trong HTML
 * của server, nên `initial={{ opacity: 0 }}` cộng `whileInView` là chữ không bao giờ
 * hiện nếu JS chết — mà trang vùng là SSG. Đo trên `/destinations/northern-vietnam`
 * trước Task 5m: 20 phần tử mang `opacity:0` trong HTML server, 5 trong đó là
 * `Reveal` bọc TRỌN từng khu giữa, tức tắt JS là cả trang dưới hero trắng trơn.
 * Chỉ trượt `y` thì tắt JS chữ nằm lệch 24px nhưng ĐỌC ĐƯỢC.
 *
 * Guard giảm chuyển động: **không cần gì thêm.** `y` là transform của một motion
 * component, và `MotionConfig reducedMotion="user"` ở root layout tước transform đi
 * — đúng loại 4 trong bốn cách guard. (Loại 2, `motion-safe:`/`motion-reduce:`, là
 * cho CSS transition/keyframes; loại 3, `useReducedMotion()`, là cho transform ghi
 * tay qua `style`.)
 *
 * Biên độ nay đọc từ `AMPLITUDE.rise` (Task 5n) chứ không khai `const RISE = 24` tại
 * chỗ nữa: nhịp thân khu ở `reveal-item.tsx` dùng CÙNG bậc đó cho chữ ký miền Bắc,
 * và hai bản 24 ở hai file là đúng thứ mà lý do #2 bên trên đi tránh.
 */
const RISE = AMPLITUDE.rise;

/** `once: true` và **KHÔNG margin** — khớp đúng `SectionEyebrow`, để cascade không
    lệch pha với chính eyebrow của nó. Đây là lỗi mà `Reveal` (margin `-80px`) gây ra
    khi bọc ngoài khu: hai observer bắn ở hai vị trí cuộn khác nhau. */
const VIEWPORT = { once: true } as const;

/** Nhịp gọi bằng tên, không bằng số. */
export type HeaderBeat = keyof typeof HEADER_DELAY;

/**
 * `h2` của khu — mở màn cascade, chạy `SPRING_HEADING` (spring 240, chậm hơn một
 * bậc vì đây là khối chữ lớn nhất của khu).
 */
export function RevealHeading({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.h2
      className={className}
      initial={{ y: RISE }}
      whileInView={{ y: 0 }}
      viewport={VIEWPORT}
      transition={{ ...SPRING_HEADING, delay: HEADER_DELAY.heading }}
    >
      {children}
    </motion.h2>
  );
}

/**
 * Một đoạn văn của header. `beat` mặc định là `lede` (đoạn dẫn ngay dưới tiêu đề);
 * truyền `cta` cho đoạn đứng sau nó nữa — ví dụ ghi chú thời tiết ở khu mùa, thứ đọc
 * SAU câu trả lời chính.
 */
export function RevealLede({
  className,
  beat = 'lede',
  children,
}: {
  className?: string;
  beat?: HeaderBeat;
  children: ReactNode;
}) {
  return (
    <motion.p
      className={className}
      initial={{ y: RISE }}
      whileInView={{ y: 0 }}
      viewport={VIEWPORT}
      transition={{ ...SPRING, delay: HEADER_DELAY[beat] }}
    >
      {children}
    </motion.p>
  );
}

/**
 * Nhịp cho một KHỐI của header không phải chữ chạy: hàng chip "Best for", nút CTA,
 * cặp nhãn + câu trả lời của khu mùa. Render `div` nên nó thay được đúng chỗ một
 * `div` đang có — không ai phải bọc thêm một lớp hộp mới vào bố cục đã duyệt.
 */
export function RevealBlock({
  className,
  beat,
  children,
}: {
  className?: string;
  beat: HeaderBeat;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={className}
      initial={{ y: RISE }}
      whileInView={{ y: 0 }}
      viewport={VIEWPORT}
      transition={{ ...SPRING, delay: HEADER_DELAY[beat] }}
    >
      {children}
    </motion.div>
  );
}
