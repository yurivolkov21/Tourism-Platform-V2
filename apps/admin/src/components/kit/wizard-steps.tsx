'use client';

import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useRef } from 'react';

/**
 * Thanh bước cho dialog nhiều bước — dựng theo `@shadcn-space/stepper-03`
 * (user chọn 04/09), tokens-only và có cổng chặn nhảy cóc.
 *
 * ## Vì sao KHÔNG dùng `Stepper` của `@tourism/ui`
 *
 * Bộ ấy chia đường nối thành TỪNG ĐOẠN nằm giữa hai vòng tròn (`StepperSeparator`
 * là flex child). Dáng của stepper-03 là một ĐƯỜNG RAY LIỀN chạy suốt sau mọi
 * vòng tròn, có vệt primary tô dần và một chấm chạy dọc theo nó — không có một
 * đường liền nào thì không có gì cho chấm ấy chạy trên. Ép hai thứ vào nhau là
 * absolute-position đè lên chính component đang dùng, tức vừa mất bảo trì vừa
 * không được cái nào tử tế.
 *
 * ## Vì sao KHÔNG chép nguyên stepper-03
 *
 * Bản gốc là một DEMO, không phải component: mảng `steps` ghim cứng trong file,
 * không nhận props, export default. Ngoài ra ba thứ phải sửa:
 *
 * - `text-teal-400` cho dấu tích — phạm luật tokens-only (CLAUDE.md #6). Dấu
 *   tích nằm TRÊN vòng tròn `bg-primary` nên token đúng của nó là
 *   `text-primary-foreground`; teal chỉ hợp với đúng bảng màu của bản demo.
 * - Hình học ghim `12.5%`/`75%`, tức đúng bốn bước. Ở đây suy từ `steps.length`
 *   nên thêm/bớt bước không lệch đường ray.
 * - Vòng tròn nào cũng bấm được để nhảy tới. Ở một lệnh tiền thì đó chính là
 *   thứ stepper sinh ra để chặn, nên `reached` là trần cứng.
 *
 * ## Chuyển động
 *
 * Đường ray tô dần và chấm chạy là TÍN HIỆU tiến độ, không phải trang trí —
 * chúng nói "bạn đang ở đâu trong bao nhiêu". Vòng nhấp nháy ở bước hiện tại
 * thì thuần thẩm mỹ, giữ lại vì đó là dáng user chọn. Cả ba đều tắt khi hệ
 * điều hành xin giảm chuyển động (`useReducedMotion`) — bản gốc chỉ tắt mỗi
 * vòng nhấp nháy.
 */

export interface WizardStep {
  id: string;
  title: string;
  icon: ReactNode;
}

/** `id` của nút tab một bước — thanh và panel cùng gọi để trỏ vào nhau. */
function wizardTabId(panelId: string, stepId: string): string {
  return `${panelId}-tab-${stepId}`;
}

export function WizardSteps({
  steps,
  active,
  reached,
  disabled = false,
  onSelect,
  panelId,
}: {
  steps: readonly WizardStep[];
  /** `id` của bước đang mở. */
  active: string;
  /** Chỉ số bước XA NHẤT đã tới — bước sau nó không bấm được. */
  reached: number;
  /** Khoá toàn thanh (đang bắn lệnh chẳng hạn). */
  disabled?: boolean;
  onSelect: (id: string) => void;
  /** `id` của vùng nội dung, để mỗi tab trỏ `aria-controls` vào đó. */
  panelId: string;
}) {
  const reduced = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  // Kẹp về 0 khi `active` không thuộc `steps` (kiểu mở — chuỗi bất kỳ): -1 làm
  // `scaleX` âm và MỌI tab `tabIndex=-1`, tức cả thanh mất điểm vào bàn phím.
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === active),
  );
  const lastIndex = steps.length - 1;
  const progress = lastIndex > 0 ? activeIndex / lastIndex : 0;

  // Mỗi bước chiếm một ô `flex-1`, nên tâm vòng tròn thứ i nằm ở
  // `(i + 0.5) / n`. Đường ray chạy từ tâm đầu tới tâm cuối — suy ra chứ không
  // ghim, để thanh bốn bước và thanh ba bước đều thẳng hàng.
  const edge = 50 / steps.length;
  const span = 100 - 2 * edge;

  /** Mũi tên trái/phải chạy focus giữa các tab CÒN MỞ (khuôn tablist chuẩn). */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]:not([disabled])') ??
        [],
    );
    const current = tabs.findIndex((tab) => tab === document.activeElement);
    tabs[(current + delta + tabs.length) % tabs.length]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation="horizontal"
      className="relative"
      onKeyDown={onKeyDown}
    >
      {/* Đường ray nền: đặt ở đúng tâm vòng tròn (size-10 → 20px). */}
      <div
        className="absolute top-5 h-0.5 bg-border"
        style={{ left: `${edge}%`, right: `${edge}%` }}
      />
      <motion.div
        className="absolute top-5 h-0.5 origin-left bg-primary"
        style={{ left: `${edge}%`, right: `${edge}%` }}
        initial={false}
        animate={{ scaleX: progress }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
      />
      {/* Chấm chạy: vị trí tuyệt đối trên ray, không phải con của ô nào. */}
      <motion.span
        aria-hidden
        className="absolute size-2 rounded-full bg-primary"
        style={{ top: 20, x: '-50%', y: '-50%' }}
        initial={false}
        animate={{ left: `${edge + progress * span}%` }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 24 }}
      />

      <div className="relative flex items-start justify-between">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          const locked = disabled || index > reached;
          return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-2">
              <button
                type="button"
                role="tab"
                id={wizardTabId(panelId, step.id)}
                aria-selected={isActive}
                aria-controls={panelId}
                // Tên của tab LÀ cái nhãn đang hiện dưới vòng tròn. Nhãn nằm
                // ngoài nút (dáng stepper-03), nên không trỏ vào nó thì tab
                // hoàn toàn KHÔNG CÓ TÊN với trình đọc màn hình — bản gốc vá
                // bằng `aria-label` nhân đôi chuỗi, ở đây trỏ thẳng vào nhãn.
                aria-labelledby={`${panelId}-label-${step.id}`}
                // Roving tabindex: cả thanh chỉ có MỘT điểm dừng Tab, mũi tên
                // đi trong thanh — đúng khuôn tablist.
                tabIndex={isActive ? 0 : -1}
                disabled={locked}
                onClick={() => onSelect(step.id)}
                className="group relative z-10 flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    'absolute inset-0 rounded-full transition-colors duration-300',
                    isDone || isActive
                      ? 'bg-primary'
                      : 'bg-muted group-enabled:group-hover:bg-muted/80',
                  )}
                />
                {isActive && !reduced ? (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full ring-2 ring-primary/50"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: [1, 1.45, 1], opacity: [1, 0.2, 1] }}
                    transition={{
                      duration: 2.2,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatType: 'mirror',
                      ease: 'easeInOut',
                    }}
                  />
                ) : null}
                <motion.span
                  className="relative flex items-center justify-center"
                  initial={false}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={
                    reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 18 }
                  }
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isDone ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0, rotate: -90, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0, rotate: 90, opacity: 0 }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 400, damping: 22 }
                        }
                        // Dấu tích nằm TRÊN nền `bg-primary`, nên màu chữ của
                        // nó là `primary-foreground` — bản gốc dùng
                        // `text-teal-400`, một màu bảng thô hợp với đúng bảng
                        // màu của demo và phạm luật tokens-only ở đây.
                        className="flex items-center justify-center text-primary-foreground"
                      >
                        <CheckIcon className="size-5" strokeWidth={3} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="icon"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 400, damping: 22 }
                        }
                        className={cn(
                          'flex items-center justify-center [&_svg]:size-5',
                          isActive ? 'text-primary-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {step.icon}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
              </button>
              <span
                id={`${panelId}-label-${step.id}`}
                className={cn(
                  'text-center text-xs font-medium transition-colors duration-300',
                  isActive || isDone ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Vùng nội dung của bước đang mở — trượt lên/xuống khi đổi bước, đúng dáng
 * stepper-03.
 *
 * `key` là `id` của bước, nên `AnimatePresence` mới biết đây là NỘI DUNG KHÁC
 * chứ không phải cùng một khối vừa đổi chữ. Đặt ở kit cùng chỗ với thanh bước
 * vì hai thứ phải đổi cùng một nhịp mới đọc ra là "một bước".
 */
export function WizardPanel({
  stepId,
  panelId,
  children,
}: {
  stepId: string;
  panelId: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    // `aria-labelledby` trỏ ngược về tab đang mở — quan hệ tab ↔ panel phải
    // hai chiều, `aria-controls` một mình chỉ là nửa.
    <div id={panelId} role="tabpanel" aria-labelledby={wizardTabId(panelId, stepId)}>
      {/* KHÔNG bọc `AnimatePresence mode="wait"` như bản gốc: nó giữ khung RỖNG
          suốt thời gian exit của bước cũ, mà các bước ở đây cao thấp khác nhau
          nên dialog sập xuống rồi phình lại mỗi lần bấm Continue. Bản gốc
          không lộ vì nội dung demo có `min-h-20` cố định.

          `key` đổi theo bước là đủ để React tháo cũ lắp mới, và `initial` chạy
          lại — tức vẫn có cú trượt vào của bước mới, chỉ bỏ cú trượt ra của
          bước đang rời đi, thứ không ai nhìn. */}
      <motion.div
        key={stepId}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
