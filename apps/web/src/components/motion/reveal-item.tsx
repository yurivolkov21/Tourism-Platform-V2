'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { AMPLITUDE, SPRING } from '@/lib/motion';

/**
 * Nhịp vào của một PHẦN TỬ bên trong khu — bạn đồng hành của `reveal-header.tsx`
 * (nhịp của header khu, Task 5m). Đây là thứ Task 5n dùng cho cả chín khu trang
 * vùng, và nó cũng là **trục phân hoá ba miền**.
 *
 * Ba chữ ký, ba TRỤC khác nhau — không phải ba con số delay khác nhau:
 *
 *  · **`rise` (miền Bắc)** — trồi lên theo `y`. Khu của Bắc là ba cột `peaks` răng
 *    cưa, ba thẻ thời lượng, ba highlight xếp dọc: tất cả đều là thứ DỰNG LÊN, và
 *    dải ảnh của nó vẽ một đường chân trời núi. Đây cũng là nhịp NHÀ của cả site
 *    (`motion/reveal.tsx`), nên Bắc là miền đọc "bình thường" nhất.
 *  · **`slide` (miền Trung)** — trượt ngang từ TRÁI theo `x`. Trang Trung dẫn bằng
 *    con đường di sản (Huế → Hội An → Mỹ Sơn), gallery của nó là một dải đèn lồng
 *    CUỘN NGANG, và khu cuối là các chuyến trong ngày dọc theo dải đó. Cả trang là
 *    một trục có hướng, nên nhịp của nó đi theo đúng hướng ấy.
 *  · **`bloom` (miền Nam)** — nở ra từ `scale` 0.96. Trang Nam dẫn bằng ẢNH (bưu
 *    thiếp ngay sau hero, panorama ở giữa) và ba thế giới của nó RỜI NHAU, không
 *    xếp thành trục nào. Một nhịp không có hướng là nhịp đúng cho nó: mỗi tấm tự
 *    hiện ra tại chỗ của mình. Chữ ký "chạm" của Nam nằm ở phản hồi khi hover
 *    (bưu thiếp xoè ở `region-signature-postcards.tsx`), thứ này là nhịp VÀO.
 *
 * ⚠️ **CHỈ animate transform, KHÔNG animate opacity** — cùng ràng buộc và cùng lý
 * do như `reveal-header.tsx`: motion render `initial` thành `style` inline ngay
 * trong HTML của server, nên `initial={{ opacity: 0 }}` cộng `whileInView` là nội
 * dung không bao giờ hiện nếu JS chết, mà trang vùng là SSG. Đo trước Task 5m: 20
 * phần tử `opacity:0` trong HTML server, 5 trong đó bọc TRỌN từng khu giữa.
 *
 * Guard giảm chuyển động: **không cần gì thêm** — `y`/`x`/`scale` đều là transform
 * của một motion component, và `MotionConfig reducedMotion="user"` ở root layout
 * tước transform đi (loại 4 trong bốn cách guard). Loại 2 (`motion-safe:` /
 * `motion-reduce:`) là cho CSS transition/keyframes, và nó KHÔNG áp cho file này —
 * nhưng nó BẮT BUỘC cho hiệu ứng hover xoè của bưu thiếp, thứ làm bằng CSS thuần
 * và `MotionConfig` vô can. Loại 3 (`useReducedMotion()`) là cho transform ghi tay
 * qua `style`.
 *
 * Vì sao đây là component riêng chứ không phải prop `axis` thêm vào `Reveal`:
 * `Reveal` animate CẢ `opacity` và nó còn 3 consumer trên trang đã duyệt
 * (`/destinations` index, `article-body.tsx`, `journey-moments.tsx`). Thêm trục cho
 * nó thì hoặc phải kéo theo `opacity: 0` (vi phạm luật SSG ở trên), hoặc phải rẽ
 * nhánh hành vi theo prop — tức sửa một component đang chạy đúng ở ba chỗ khác để
 * phục vụ một chỗ mới. Thêm file thì `Reveal` không bị đụng một ký tự nào.
 */
const ENTER = {
  rise: { initial: { y: AMPLITUDE.rise }, settled: { y: 0 } },
  // ÂM, tức trượt vào từ bên trái. Hướng này là lựa chọn có lý do kép: nó là hướng
  // đọc (và hướng đi của con đường di sản), và nó là phía AN TOÀN — nội dung tràn
  // sang trái bị cắt bởi mép cửa sổ, còn tràn sang phải thì làm cả body cuộn ngang.
  slide: { initial: { x: -AMPLITUDE.slide }, settled: { x: 0 } },
  bloom: { initial: { scale: AMPLITUDE.bloom }, settled: { scale: 1 } },
} as const;

/** Ba chữ ký, gọi bằng TÊN chứ không bằng con số — chỗ gọi không gõ được `y: 40`. */
export type EnterSignature = keyof typeof ENTER;

/** `once: true` và **KHÔNG margin** — khớp đúng `SectionEyebrow` và
    `reveal-header.tsx`, để nhịp thân khu không lệch pha với cascade header của
    chính khu đó. Đây là lỗi mà `Reveal` (margin `-80px`) gây ra khi bọc ngoài khu. */
const VIEWPORT = { once: true } as const;

/**
 * ⚠️ **KHÔNG bọc `RevealItem` quanh phần tử nằm trong một VÙNG CUỘN LỒNG.**
 *
 * Đo được 30/07, và nó là một cái bẫy im lặng: `IntersectionObserver` tính vùng giao
 * bằng cách cắt hình chữ nhật của target qua CẢ chuỗi tổ tiên có clip TRƯỚC khi so
 * với root, nên ô thứ 4–6 của một dải `overflow-x-auto` có vùng giao bằng 0 và
 * observer KHÔNG BAO GIỜ bắn cho tới khi người dùng cuộn chính cái dải. Observer
 * không bắn thì phần tử ở lại `initial` VĨNH VIỄN — kể cả ở `prefers-reduced-motion:
 * reduce`, vì `reducedMotion="user"` chỉ tước transform của phép ANIMATE, nó không
 * xoá `initial` đã render. Đo trên trang Trung ở chế độ reduce: đúng **2 ô** kẹt
 * `translateX(-16px)`.
 *
 * Nới `viewport.margin` KHÔNG chữa được — đã thử và đo lại: `rootMargin` nới bờ của
 * ROOT, còn phép cắt bởi tổ tiên có clip nằm ở bước TRƯỚC đó, nên hai ô vẫn kẹt y
 * nguyên. Đặt `viewport.root` thành chính dải thì observer bắn ngay lúc mount cho cả
 * sáu ô (mọi ô đều nằm trong hộp của dải), tức mất hẳn nhịp theo-cuộn.
 *
 * Bọc CẢ dải trong MỘT `RevealItem` là cách chữa 5n đã dùng, và nó đúng chừng nào dải
 * còn tự đứng yên. **Từ Task 5o trang vùng KHÔNG còn consumer nào của cách đó**: dải
 * đèn lồng miền Trung giờ chạy ngang theo tiến độ cuộn trang, nên một transform ghi
 * lên chính phần tử đang được lái sẽ tranh nhau — nó không bọc nhịp nào cả (xem
 * `LanternsSection` ở `region-gallery.tsx`). Cảnh báo này giữ lại vì nó vẫn đúng cho
 * mọi vùng cuộn lồng KHÁC của repo (`departure-strip.tsx`, `route-ribbon.tsx`),
 * và vì phép đo phía trên đắt hơn phép đọc lại nó.
 */

/** Chỉ hai thẻ, và cả hai đều có nhu cầu THẬT. `div` là mặc định; `h3` cho tiêu đề
    khối highlight của khu intro, thứ phải đi cùng nhịp với ba mục dưới nó.
    KHÔNG có `li`: mọi khu dùng `li` đều để `li` trơ mang `data-*` mà spec đang canh
    và đặt `RevealItem` BÊN TRONG nó, nên phần mang nhịp cũng là phần mang viền —
    một viền đứng im trên nội dung đang trượt thì đọc thành hai mảnh rời. */
const TAGS = { div: motion.div, h3: motion.h3 } as const;

/**
 * Một phần tử của thân khu, vào theo chữ ký của miền.
 *
 * `delay` là số vì lưới cần `index * STAGGER.grid` — khác `reveal-header.tsx`, chỗ
 * đó nhịp gọi bằng tên (`beat="lede"`) vì thang header là hằng ba bậc. Ở đây con số
 * DẪN XUẤT từ chỉ số phần tử nên không có tên nào đặt được.
 */
export function RevealItem({
  enter,
  delay = 0,
  as = 'div',
  className,
  children,
}: {
  enter: EnterSignature;
  delay?: number;
  as?: keyof typeof TAGS;
  className?: string;
  children: ReactNode;
}) {
  const Tag = TAGS[as];
  const { initial, settled } = ENTER[enter];

  return (
    <Tag
      className={className}
      initial={initial}
      whileInView={settled}
      viewport={VIEWPORT}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </Tag>
  );
}
