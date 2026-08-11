import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';
import { CopyCodeButton } from '@/components/checkout/copy-code-button';
import { ticketBarcodeWidths, ticketSerial } from '@/lib/checkout';

/**
 * Khung dùng chung của hai màn quay-về (`/checkout/success`, `/checkout/cancel`)
 * — dựng thành MỘT tấm vé (boarding-pass) theo giải phẫu vé thật (IATA/Apple
 * Wallet/EasyJet): thân vé ngang, cuống bên PHẢI ~30% ngăn bằng đường xé DỌC
 * (mobile: cuống tụt xuống dưới, đường xé ngang). Không còn dashed-border +
 * notch bán nguyệt — cliché "card giả vờ làm vé" của bản trước.
 *
 * Thân vé (header voucher + serial + title/body/`children` + fine print)
 * đứng bên TRÁI/TRÊN đường xé. Cuống vé (nhãn xoay dọc, mã + nút chép, tóm tắt
 * khách, hint, barcode) đứng bên PHẢI/DƯỚI, và CHỈ tồn tại khi có `code` —
 * trang cancel không có mã (booking PENDING không phát mã như một voucher)
 * nên không có cuống, card render như một card thường, KHÔNG đường xé lửng lơ.
 *
 * `tone` tô dải mảnh trong dải header (không tô cả thẻ): tông màu mã hoá "có
 * cần để mắt tới không" — thông tin thật nằm ở mã đặt chỗ, không ở màu nền.
 * Ngọc bích (`primary`) chỉ xuất hiện ở ĐÚNG BA chỗ: dải header (wordmark +
 * nhãn TOUR VOUCHER), một highlight cạnh nhãn quan trọng nhất trong cuống
 * (booking reference), và nền cuống nhạt hơn thân.
 */
export function CheckoutShell({
  tone,
  title,
  body,
  code,
  codeLabel,
  stubName,
  stubMeta,
  children,
}: {
  tone: 'success' | 'warning' | 'muted';
  title: string;
  body?: string;
  code?: string;
  codeLabel?: string;
  /** Tên khách hiện gọn trong cuống — chỉ trang success truyền (cancel không
      đủ ngữ cảnh để tóm tắt gọn một dòng). */
  stubName?: string;
  /** Dòng mô tả ngắn cạnh tên khách trong cuống, vd "24–26 Aug 2026 · 2 guests". */
  stubMeta?: string;
  children?: ReactNode;
}) {
  const t = messages.booking.success;

  if (!code) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col px-4 py-16 md:py-24">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div aria-hidden="true" className={cn('h-1.5 w-full', TONE_BAR[tone])} />
          <div className="flex flex-col items-center gap-6 px-6 py-10 text-center md:px-10 md:py-12">
            <h1 className="font-heading text-2xl font-semibold text-balance md:text-3xl">
              {title}
            </h1>
            {body ? <p className="max-w-lg text-pretty text-muted-foreground">{body}</p> : null}
            {children}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col px-4 py-16 md:py-24">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col md:flex-row">
          {/* THÂN VÉ */}
          <div className="relative flex flex-1 flex-col md:w-[70%]">
            {/* Guilloche mờ: sóng celadon opacity thấp, chỉ trong thân — không
                đè lên vùng cuống/barcode. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:repeating-radial-gradient(circle_at_15%_20%,var(--color-primary)_0px,transparent_2px,transparent_9px)]"
            />

            {/* Dải header mỏng: wordmark serif nhỏ + nhãn TOUR VOUCHER + dải tone theo mood */}
            <div className="relative border-b bg-primary/5">
              <div aria-hidden="true" className={cn('h-1 w-full', TONE_BAR[tone])} />
              <div className="flex items-center justify-between px-5 py-2 md:px-7">
                <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  tour<span className="text-primary">ism</span>
                </span>
                <span className="font-mono text-[9px] font-medium tracking-[0.28em] text-primary uppercase">
                  {t.voucherLabel}
                </span>
              </div>
            </div>

            {/* Serial, sát mép trên thân */}
            <p className="relative px-5 pt-2 text-right font-mono text-[9px] tracking-widest text-muted-foreground/70 md:px-7">
              NO. {ticketSerial(code)}
            </p>

            {/* Nội dung: title/body/children — mật độ nén, khối sát nhau */}
            <div className="relative flex flex-1 flex-col items-center gap-4 px-5 pt-2 pb-5 text-center md:px-7">
              <h1 className="font-heading text-2xl font-semibold text-balance md:text-3xl">
                {title}
              </h1>
              {body ? <p className="max-w-lg text-pretty text-muted-foreground">{body}</p> : null}
              {children}
            </div>

            {/* Fine print, sát mép dưới thân */}
            <p className="relative border-t px-5 py-2 text-center font-mono text-[9px] tracking-wide text-balance text-muted-foreground/70 md:px-7">
              {t.finePrint}
            </p>
          </div>

          <TicketTear />

          {/* CUỐNG VÉ */}
          <div className="relative flex flex-col items-center gap-3 bg-muted/40 px-5 py-6 text-center md:w-[30%] md:justify-center md:px-4 md:pl-6">
            {/* Nhãn TOUR VOUCHER lặp lại, xoay dọc, ÁP SÁT mép trái cuống —
                định vị tuyệt đối để không chiếm một cột riêng giữa thân vé và
                cuống (desktop only — mobile không còn mép dọc để bám theo). */}
            <span
              aria-hidden="true"
              className="hidden font-mono text-[8px] tracking-[0.2em] text-muted-foreground/70 uppercase md:absolute md:top-1/2 md:left-1.5 md:block md:-translate-y-1/2 md:[writing-mode:vertical-rl]"
            >
              {t.voucherLabel}
            </span>

            {codeLabel ? (
              <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                {/* Highlight ngọc bích cạnh nhãn quan trọng nhất của cuống — booking reference */}
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
                {codeLabel}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <p className="font-mono text-lg font-medium tracking-[0.06em] whitespace-nowrap tabular-nums md:text-xl">
                {code}
              </p>
              <CopyCodeButton code={code} />
            </div>

            {stubName || stubMeta ? (
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {stubName ? <p className="font-medium text-foreground">{stubName}</p> : null}
                {stubMeta ? <p className="tabular-nums">{stubMeta}</p> : null}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">{t.stubShowCode}</p>

            <TicketBarcode code={code} />
          </div>
        </div>
      </div>
    </section>
  );
}

const TONE_BAR = {
  success: 'bg-success/70',
  warning: 'bg-warning/70',
  muted: 'bg-muted',
} as const;

/**
 * Đường xé giữa thân vé và cuống vé: MỘT đường mảnh ~2px nằm sát ranh giới
 * thân/cuống, lỗ đục kim là chấm tròn nhỏ lặp tô bằng `--border` (opacity
 * đầy) — thấy được trên cả `bg-card` sáng lẫn tối, khác bản trước dùng màu
 * nền TRANG nên tàng hình trên thân vé trắng và bỏ lại một dải trống vô
 * nghĩa. Dọc trên desktop (thân bên trái, cuống bên phải), ngang trên mobile
 * (cuống tụt xuống dưới). KHÔNG dashed-border, KHÔNG notch bán nguyệt —
 * cliché của bản trước.
 */
function TicketTear() {
  return (
    <div
      data-slot="ticket-tear"
      aria-hidden="true"
      className="h-[2px] w-full shrink-0 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1.1px)] [background-size:8px_2px] md:h-auto md:w-[2px] md:[background-size:2px_8px]"
    />
  );
}

/**
 * Barcode giả: ~28 vạch dày-mỏng không đều, DETERMINISTIC theo mã đặt chỗ
 * (xem `ticketBarcodeWidths`) — KHÔNG random, để hình không đổi mỗi lần
 * render. Số vạch cố định (không còn = độ dài `code`) để barcode luôn trải
 * gần hết bề ngang cuống thay vì cụt ngủn với mã ngắn. Quiet zone dùng
 * `bg-card` (màu "giấy" của chính thân vé, không phải hex trắng cứng) để giữ
 * tokens-only mà vẫn tương phản cao với vạch `bg-foreground` ở cả hai theme.
 */
function TicketBarcode({ code }: { code: string }) {
  const widths = ticketBarcodeWidths(code);
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-1">
      <div className="flex h-9 items-stretch gap-px bg-card p-1">
        {widths.map((w, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: mảng deterministic từ `code`, không reorder/thêm bớt
            key={`${code}-${i}`}
            className={i % 2 === 0 ? 'bg-foreground' : 'bg-transparent'}
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      <p className="font-mono text-[9px] tracking-widest text-muted-foreground">{code}</p>
    </div>
  );
}
