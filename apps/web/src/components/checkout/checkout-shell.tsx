import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';
import { CopyCodeButton } from '@/components/checkout/copy-code-button';

/**
 * Khung dùng chung của hai màn quay-về (`/checkout/success`, `/checkout/cancel`)
 * — dựng thành MỘT tấm vé (boarding-pass), tinh thần Flighty: mượn quy ước ấn
 * phẩm sân bay (thân vé + cuống vé ngăn bằng đường xé), không trang trí rởm.
 *
 * Thân vé (title + body + `children` — facts, "what happens next", nút hành
 * động) đứng TRÊN đường xé. Cuống vé (mã đặt chỗ + nút chép + dòng hint) đứng
 * DƯỚI, và CHỈ tồn tại khi có `code` — trang cancel không có mã (booking
 * PENDING không phát mã như một voucher) nên không có cuống, card render như
 * một card thường, KHÔNG đường xé lửng lơ.
 *
 * `tone` tô một dải mảnh trên đầu vé (không tô cả thẻ): tông màu mã hoá "có
 * cần để mắt tới không", và ở đây thông tin thật nằm ở mã đặt chỗ chứ không ở
 * màu nền — cùng nguyên tắc đã chốt ở vòng thiết kế trước, chỉ đổi CHỖ tô từ
 * một chấm cạnh tiêu đề sang một dải ở đỉnh vé.
 */
export function CheckoutShell({
  tone,
  title,
  body,
  code,
  codeLabel,
  children,
}: {
  tone: 'success' | 'warning' | 'muted';
  title: string;
  body?: string;
  code?: string;
  codeLabel?: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col px-4 py-16 md:py-24">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div
          aria-hidden="true"
          className={cn(
            'h-1.5 w-full',
            tone === 'success' && 'bg-success/70',
            tone === 'warning' && 'bg-warning/70',
            tone === 'muted' && 'bg-muted',
          )}
        />

        <div className="flex flex-col items-center gap-6 px-6 py-10 text-center md:px-10 md:py-12">
          <h1 className="font-heading text-2xl font-semibold text-balance md:text-3xl">{title}</h1>
          {body ? <p className="max-w-lg text-pretty text-muted-foreground">{body}</p> : null}
          {children}
        </div>

        {code ? (
          <>
            <TicketTear />
            {/* Cuống vé: mã to, mono, giãn cách rộng — cùng vai trò voucher
                như bản cũ, chỉ đổi chỗ đứng xuống dưới đường xé. */}
            <div className="flex flex-col items-center gap-2 px-6 pt-1 pb-8 text-center md:px-10">
              {codeLabel ? (
                <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  {codeLabel}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <p className="font-mono text-2xl font-medium tracking-[0.2em] md:text-3xl">
                  {code}
                </p>
                <CopyCodeButton code={code} />
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.booking.success.stubShowCode}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Đường xé giữa thân vé và cuống vé: viền chấm ngang + hai khuyết tròn hai
 * đầu. Khuyết là `bg-background` (màu nền TRANG, không phải `bg-card`) — thẻ
 * cha có `overflow-hidden` nên nửa khuyết tràn ra ngoài bị cắt đúng ở mép thẻ,
 * cho hiệu ứng "cắn" bán nguyệt sạch ở cả hai theme mà không cần vẽ tay.
 */
function TicketTear() {
  return (
    <div data-slot="ticket-tear" aria-hidden="true" className="relative">
      <div className="border-t-2 border-dashed border-border" />
      <span className="-left-3 absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-background" />
      <span className="-right-3 absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-background" />
    </div>
  );
}
