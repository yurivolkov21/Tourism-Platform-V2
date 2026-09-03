'use client';

import { cn } from '@tourism/ui/lib/utils';
import { DownloadIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';

/**
 * Nút Export CSV của back-office (kit từ vòng vá review F10 — consumer thứ
 * hai là `/subscribers`), dựng theo `button-27` ("Encrypt") của Shadcn
 * Space — user chốt 01/09. Registry khai ở `components.json`
 * (`@shadcn-space`), kéo lại bản gốc bằng
 * `pnpm dlx shadcn@latest view @shadcn-space/button-27`.
 *
 * Giữ lại của bản gốc: ngoặc góc HUD, quầng nền, tia quét chéo, chữ mono in
 * hoa giãn ký tự, và hiệu ứng XÁO CHỮ khi hover.
 *
 * Bốn chỗ buộc phải khác, mỗi chỗ một lý do cứng:
 *
 * 1. **`<a>` chứ không phải `<button>`.** Bản gốc là `motion.button`. Đích của
 *    nút này là route handler trả `Content-Disposition: attachment`; một cú
 *    tải file qua button + điều hướng client sẽ thành một cú render trang
 *    hỏng. Dùng `motion.a` để giữ nguyên hiệu ứng mà vẫn là link thật.
 * 2. **Thấp và rộng.** Bản gốc `px-6 py-3` (~44px cao). Nút này sống trong Ô
 *    TIÊU ĐỀ của bảng, nên nó cao bao nhiêu thì cả hàng tiêu đề dày lên bấy
 *    nhiêu — user báo nó "chiếm quá nhiều không gian". Hạ còn `h-8`, bù lại
 *    ghim `min-w` để nhãn đổi từ "Export CSV" sang "Export 12 rows" không làm
 *    nút co giãn giật theo mỗi ô checkbox được tích.
 * 3. **Icon Download thay bộ Lock/Terminal/Unlock.** Ổ khoá nói về mã hoá;
 *    việc ở đây là tải file.
 * 4. **Tôn trọng `prefers-reduced-motion`.** Xáo chữ + tia quét là chuyển động
 *    liên tục, đúng thứ người bật cờ ấy muốn tránh — tắt cả hai, nhãn hiện
 *    thẳng.
 */

/** Số vòng xáo cho mỗi ký tự trước khi nó "giải mã" xong. */
const CYCLES_PER_CHAR = 4;
/** Nhịp xáo, ms. */
const SHUFFLE_SPEED = 30;
const SCRAMBLE_CHARS = '010101_!@#$%^&*()<>{}[]░▒▓█';

/**
 * Bề rộng tối thiểu, đo cho nhãn dài nhất thực tế ("Export 100 rows" ở `limit`
 * lớn nhất, chữ mono in hoa có giãn ký tự). Ghim ở đây thay vì để nút tự co:
 * nút nằm sát mép phải bảng, co giãn theo từng cú tích sẽ kéo cả ô tiêu đề
 * nhảy ngang — đúng thứ user muốn tránh khi bảo "tăng chiều dài nút ra".
 */
const MIN_WIDTH = 'min-w-48';

function useScramble(label: string, active: boolean) {
  const [display, setDisplay] = React.useState(label);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = React.useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setDisplay(label);
  }, [label]);

  const start = React.useCallback(() => {
    if (!active) return;
    stop();
    let step = 0;
    const total = label.length * CYCLES_PER_CHAR;

    timer.current = setInterval(() => {
      setDisplay(
        label
          .split('')
          .map((char, index) => {
            if (step / CYCLES_PER_CHAR > index) return char;
            if (char === ' ') return ' ';
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          })
          .join(''),
      );

      step += 1;
      if (step > total) stop();
    }, SHUFFLE_SPEED);
  }, [active, label, stop]);

  // Nhãn đổi giữa chừng (tích thêm một hàng) thì DỪNG vòng xáo đang chạy và
  // hiện ngay nhãn mới — kẻo con số cũ tiếp tục được "giải mã" ra sau khi nó
  // đã sai. `stop` (đã bọc theo `label`) vừa clearInterval vừa đặt nhãn; bản
  // đầu chỉ `setDisplay` nên interval cũ — closure ôm nhãn cũ — 30ms sau ghi
  // đè lại và kết thúc bằng đúng con số sai (vòng vá review 02/09).
  React.useEffect(() => {
    stop();
  }, [stop]);

  React.useEffect(() => () => stop(), [stop]);

  return { display, start, stop };
}

export interface ExportButtonProps {
  /** Đích tải file. Bỏ trống nghĩa là nút ở trạng thái TẮT. */
  href?: string;
  label: string;
  /** Lý do bị tắt — hiện thành tooltip (ca tập vượt trần export). */
  disabledReason?: string;
}

export function ExportButton({ href, label, disabledReason }: ExportButtonProps) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = React.useState(false);
  const { display, start, stop } = useScramble(label, !reduced);

  const shell = cn(
    'group relative inline-flex h-8 items-center justify-center gap-2 overflow-hidden rounded-lg px-4',
    'font-mono text-[11px] font-semibold tracking-widest uppercase transition-all duration-300',
    'border border-border bg-background text-foreground select-none',
    MIN_WIDTH,
  );

  const chrome = (
    <>
      {/* Ngoặc góc HUD — chữ ký thị giác của bản gốc. Thu về `size-1` cho vừa
          nút cao 32px; ở `size-1.5` chúng chạm nhau giữa cạnh. */}
      <span className="absolute top-0.5 left-0.5 size-1 border-t border-l border-border transition-colors duration-300 group-hover:border-primary" />
      <span className="absolute top-0.5 right-0.5 size-1 border-t border-r border-border transition-colors duration-300 group-hover:border-primary" />
      <span className="absolute bottom-0.5 left-0.5 size-1 border-b border-l border-border transition-colors duration-300 group-hover:border-primary" />
      <span className="absolute bottom-0.5 right-0.5 size-1 border-b border-r border-border transition-colors duration-300 group-hover:border-primary" />
      <span className="absolute inset-0 bg-linear-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </>
  );

  const body = (
    <>
      {chrome}
      {/* Tia quét: chỉ chạy khi hover VÀ người dùng không tắt chuyển động. */}
      <AnimatePresence>
        {hovered && !reduced ? (
          <motion.span
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.4, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-primary/20 to-transparent"
          />
        ) : null}
      </AnimatePresence>
      <DownloadIcon
        aria-hidden="true"
        className="relative z-10 size-3.5 text-muted-foreground transition-colors group-hover:text-primary"
      />
      {/* Hai lớp chữ: lớp dưới TRONG SUỐT giữ chỗ theo nhãn thật, lớp trên vẽ
          chuỗi đang xáo. Không có lớp giữ chỗ thì mỗi ký tự bị thay sẽ làm nút
          rung ngang suốt vòng hiệu ứng (mẹo của bản gốc, giữ nguyên).

          Cây a11y đọc lớp NHÃN THẬT, còn lớp đang xáo là trang trí
          (`aria-hidden`) — bản đầu để ngược, nên tên khả truy cập của link
          đổi ~33 lần/giây thành "░▒#$%" suốt vòng hover (vòng vá review
          02/09). Lớp trong suốt vẫn là chữ thật trong DOM nên trình đọc màn
          hình vẫn đọc được. */}
      <span className="relative z-10 inline-flex items-center justify-center">
        <span className="opacity-0">{label}</span>
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap"
        >
          {display}
        </span>
      </span>
    </>
  );

  if (!href) {
    return (
      // Span BỌC NGOÀI để tooltip sống: nút `disabled` mang `pointer-events-none`
      // nên tự nó không bao giờ nhận hover. Bên trong phải là `<button>` thật
      // chứ không phải một span có class giống nút — một control không role là
      // control vô hình với trình đọc màn hình.
      <span title={disabledReason}>
        <button type="button" disabled className={cn(shell, 'cursor-not-allowed opacity-50')}>
          {body}
        </button>
      </span>
    );
  }

  return (
    <motion.a
      href={href}
      data-slot="button"
      onMouseEnter={() => {
        setHovered(true);
        start();
      }}
      onMouseLeave={() => {
        setHovered(false);
        stop();
      }}
      whileHover={reduced ? undefined : { scale: 1.02 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      className={cn(
        shell,
        'hover:border-primary/60 hover:text-primary hover:shadow-sm',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
      )}
    >
      {body}
    </motion.a>
  );
}
