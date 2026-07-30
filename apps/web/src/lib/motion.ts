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
 *
 * Task 5n vẫn KHÔNG thêm khoá nào: cả chín khu trang vùng đều stagger một LƯỚI
 * (ba cột `peaks`, ba chặng `heritage`, lưới thẻ `days`/`dayTrips`/`reviews`, hàng
 * highlight của `intro`), nên `grid` phủ đúng mọi chỗ. Một bước thứ hai ở đây chỉ
 * có nghĩa khi có một loại nhịp thật sự khác, không phải khi có thêm consumer.
 */
export const STAGGER = { grid: 0.08 } as const;

/**
 * Biên độ chuyển động vào — MỘT bộ cho cả cascade header (Task 5m) lẫn nhịp nội bộ
 * của khu (Task 5n). Ba khoá là ba TRỤC, và ba trục đó chính là chữ ký ba miền:
 * Bắc trồi lên (`rise`), Trung trượt ngang (`slide`), Nam nở ra (`bloom`).
 *
 * ⚠️ **`slide: 16` là con số ĐO ĐƯỢC, không phải khẩu vị — đừng nâng lên.** Trục x
 * có một rủi ro mà trục y không có: `translateY` khi JS chết chỉ đẩy chữ xuống, còn
 * `translateX` đẩy nội dung ra khỏi mép ngang — sang phải là sinh **thanh cuộn
 * ngang** cho cả body (repo KHÔNG có `overflow-x: hidden` ở đâu, đã grep), sang
 * trái là **cắt mất chữ**. Đo 30/07 trên cả ba trang vùng, ở 1440px và 390px, cho
 * mọi phần tử ứng viên (`ol > li`, `ul > li`, `[data-gallery-tile]`, `figure`,
 * `[data-intro-items] > div`, khối chữ `max-w-2xl`): ở **390px khe trái = khe phải
 * = 16px** ở TẤT CẢ — đúng bằng gutter `px-4` của khu. Nên 16 là biên độ lớn nhất
 * mà JS-tắt không mất một glyph nào và `scrollWidth` không nhích lên; 24 mất 8px,
 * 32 mất 16px. Kế hoạch gốc đề 60 rồi hạ trần xuống 32 — cả hai đều quá lớn, và
 * chỉ phép đo mới nói được điều đó.
 *
 * `rise: 24` là bậc nhà có từ trước (`motion/reveal.tsx` và 21 bản copy của nó).
 * `bloom: 0.96` không dịch chỗ nên nó là trục AN TOÀN NHẤT khi JS chết: nội dung
 * chỉ nhỏ đi 4%, không lệch một pixel nào và không thể tràn.
 */
export const AMPLITUDE = { rise: 24, slide: 16, bloom: 0.96 } as const;

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
