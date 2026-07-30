/**
 * Bộ số chuyển động của nhà — MỘT nguồn cho code MỚI.
 *
 * ⚠️ **File này KHÔNG phải nguồn duy nhất, và chưa thể là.** 21 component khai
 * `const SPRING` nguyên văn tại chỗ, 19 component gõ spring 240 inline vào
 * `transition` của `h2`. Chúng nằm trên những trang user đã duyệt bằng ảnh chụp, nên
 * refactor chúng là phải chụp và đo lại toàn bộ — đó là một task riêng, phải hỏi
 * trước. Trong lúc chờ, `motion.spec.ts` so SỐ với SỐ đọc từ chính các file đó, nên
 * hai bản không thể trôi khỏi nhau im lặng.
 *
 * Repo **không dùng** `variants`/`staggerChildren` ở bất kỳ đâu — luôn
 * `delay: index * step`. Đừng giới thiệu khái niệm thứ hai cho cùng một việc.
 */

/**
 * Spring chuẩn nhà — mọi thứ TRỪ tiêu đề khu.
 *
 * Nguồn: `components/motion/reveal.tsx`, khai lại nguyên văn ở 21 file.
 */
export const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

/**
 * Spring cho phần tử LỚN: `h1` hero và `h2` của khu. Chậm hơn `SPRING` một bậc —
 * cùng khoảng dịch chuyển nhưng khối chữ to hơn, nên nó cần thêm thời gian để
 * "nặng" đúng cỡ của mình.
 *
 * Nguồn: `components/home/gallery.tsx`, gõ inline ở 19 file.
 */
export const SPRING_HEADING = { type: 'spring', stiffness: 240, damping: 70, mass: 1 } as const;

/**
 * Ease điện ảnh — đường cong DUY NHẤT có tên trong repo, dành cho tween (không
 * spring). Nguồn: `components/motion/reveal-line.tsx`.
 */
export const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Bước stagger theo loại nội dung. Chỉ có `grid` vì đó là bước DUY NHẤT đã dùng
 * thật (`destinations/journey-moments.tsx`) — thêm khoá cho `list`/`row` lúc này là
 * bịa số cho một nhu cầu chưa có.
 */
export const STAGGER = { grid: 0.08 } as const;

/**
 * Thang delay của cascade header khu: tiêu đề → đoạn dẫn → CTA.
 *
 * `heading: 0` là CỐ Ý và nó khớp bản mẫu `home/gallery.tsx` (`h2` không delay, đoạn
 * dẫn 0.2). Eyebrow tự mang `delay: 0.2` trong `SectionEyebrow` nên nó KHÔNG mở
 * cascade — nhưng eyebrow nằm TRÊN tiêu đề nên observer của nó bắn sớm hơn theo
 * chính vị trí cuộn, và hai thứ đó bù nhau: cả header đọc thành MỘT khối tới, không
 * thành một hàng đợi.
 *
 * Vì vậy `cta` không được vượt 0.2 — `motion.spec.ts` canh ràng buộc pha đó bằng
 * cách đọc thẳng delay của `SectionEyebrow`.
 */
export const HEADER_DELAY = { heading: 0, lede: 0.1, cta: 0.2 } as const;
