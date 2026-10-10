import { messages } from '@tourism/i18n';
import { DocStamp } from '@tourism/ui/components/print-doc/doc-stamp';
import { PRINT_LABEL } from '@tourism/ui/lib/print-styles';
import { cn } from '@tourism/ui/lib/utils';
import { TicketBarcode } from '@/components/checkout/ticket-barcode';
import type {
  PrintTicketDate,
  PrintTicketStub,
  PrintTicketTone,
  PrintTicketView,
} from '@/lib/print/print-ticket';

/** Cuống gạch chéo của vé chờ, vé hết hiệu lực (B1): hai tông nền sáng của token. */
const STRIPES =
  'bg-[repeating-linear-gradient(135deg,var(--card)_0_2.2mm,var(--paper)_2.2mm_4.4mm)]';

/**
 * Màu theo tông vé: `active` là vé teal của voucher (5b); `pending` (hoá đơn chờ) và `closed` (đơn
 * đã đóng, voucher đã huỷ) là vé "chưa, hay không còn, hiệu lực" của B1 — viền đứt xám, dải xám,
 * cuống gạch chéo.
 */
type TicketToneClasses = { frame: string; band: string; line: string; stub: string };

/** Vé "chưa, hay không còn, hiệu lực" — MỘT hình cho tông `pending` và `closed` (quyết định 15). */
const VOID_TONE: TicketToneClasses = {
  frame: 'border-dashed border-muted-foreground/60',
  band: 'bg-muted-foreground text-primary-foreground',
  line: 'border-muted-foreground/60',
  stub: STRIPES,
};

const TONE: Record<PrintTicketTone, TicketToneClasses> = {
  active: {
    frame: 'border-solid border-primary',
    band: 'bg-primary text-primary-foreground',
    line: 'border-primary',
    stub: '',
  },
  pending: VOID_TONE,
  closed: VOID_TONE,
};

const BAND = 'px-[5mm] py-[2.4mm] font-mono text-[7.5pt] font-medium tracking-[0.18em] uppercase';

/**
 * Tấm vé có cuống của tài liệu in (G40, spec §3.1 mục 2, §4.2 mục 2) — cùng hình tấm vé trang chi
 * tiết đơn. Cuống 52 mm; đường chấm cắt giữa thân và cuống; hai nửa lỗ đục ở hai đầu đường cắt
 * (`overflow-hidden` của vé cắt còn nửa).
 */
export function PrintTicket({ view }: { view: PrintTicketView }) {
  const tone = TONE[view.tone];
  return (
    <div
      data-slot="print-ticket"
      data-tone={view.tone}
      className={cn(
        'relative grid grid-cols-[1fr_52mm] overflow-hidden rounded-[3.5mm] border-[0.9pt] bg-card',
        tone.frame,
      )}
    >
      <div className={cn('relative border-r-[0.9pt] border-dashed', tone.line)}>
        <p className={cn('flex items-center justify-between', BAND, tone.band)}>
          <span>{view.bandStart}</span>
          <span>{view.bandEnd}</span>
        </p>
        <div className="px-[6mm] pt-[3.5mm]">
          {/* Tên và mộc đứng ở mọi tông — vé đã huỷ vẫn đóng mộc CANCELLED / REFUNDED (spec §3.3);
              chỉ thân vé (ngày, đường nối, bốn ô) thay bằng dải hết hiệu lực. */}
          <div className="flex items-start justify-between gap-[5mm]">
            <p className="font-heading text-[14pt] leading-[1.2] font-semibold">{view.title}</p>
            <DocStamp label={view.stamp.label} tone={view.stamp.tone} />
          </div>
          {view.notice !== null ? (
            <p className="my-[4mm] rounded-[2mm] border-[0.8pt] border-dashed border-muted-foreground px-[4mm] py-[3mm] font-medium">
              {view.notice}
            </p>
          ) : (
            <>
              <div className="my-[3mm] grid grid-cols-[auto_1fr_auto] items-center gap-[4mm]">
                <TicketDate label={messages.bookingDetail.ticket.departs} date={view.departs} />
                <p className="relative text-center text-[7.8pt] font-semibold text-primary-emphasis before:absolute before:inset-x-0 before:top-1/2 before:border-t-[0.8pt] before:border-dashed before:border-primary/40">
                  <span className="relative bg-card px-[2.5mm]">{view.routeLine}</span>
                </p>
                <TicketDate label={messages.bookingDetail.ticket.returns} date={view.returns} end />
              </div>
              <dl className="-mx-[6mm] grid grid-cols-4 border-t-[0.6pt] border-border">
                {view.cells.map((cell, index) => (
                  <div
                    key={cell.label}
                    className={cn(
                      'pt-[2.6mm] pb-[3mm]',
                      index === 0 ? 'pl-[6mm]' : 'border-l-[0.6pt] border-border pl-[3.5mm]',
                    )}
                  >
                    <dt className={PRINT_LABEL}>{cell.label}</dt>
                    <dd className="mt-[0.8mm] font-semibold">{cell.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'absolute -top-[2.6mm] -right-[2.6mm] z-10 size-[4.6mm] rounded-full border-[0.9pt] bg-card',
            tone.line,
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute -right-[2.6mm] -bottom-[2.6mm] z-10 size-[4.6mm] rounded-full border-[0.9pt] bg-card',
            tone.line,
          )}
        />
      </div>
      <Stub stub={view.stub} band={tone.band} background={tone.stub} />
    </div>
  );
}

function TicketDate({
  label,
  date,
  end = false,
}: {
  label: string;
  date: PrintTicketDate;
  end?: boolean;
}) {
  return (
    <div className={end ? 'text-right' : undefined}>
      <p className={PRINT_LABEL}>{label}</p>
      <p className="mt-[1mm] font-mono text-[20pt] leading-none font-medium tracking-[0.02em]">
        {date.big}
      </p>
      <p className="mt-[1mm] text-[7.5pt] text-muted-foreground">{date.sub}</p>
    </div>
  );
}

function Stub({
  stub,
  band,
  background,
}: {
  stub: PrintTicketStub;
  band: string;
  background: string;
}) {
  return (
    <div data-slot="print-ticket-stub" className={cn('flex flex-col', background)}>
      <p className={cn('text-center', BAND, band)}>{stub.band}</p>
      <div className="flex flex-1 flex-col px-[5mm] py-[4mm]">
        {stub.tag ? (
          <span className="self-start rounded-[1mm] border-[0.7pt] border-pending bg-card px-[1.8mm] py-[0.6mm] font-mono text-[7.5pt] font-medium tracking-[0.16em] text-pending uppercase">
            {stub.tag}
          </span>
        ) : null}
        {stub.amountLabel ? <p className={PRINT_LABEL}>{stub.amountLabel}</p> : null}
        <p
          className={cn(
            'text-[20pt] leading-tight font-semibold',
            stub.tag ? 'mt-[2.5mm]' : 'mt-[0.5mm]',
          )}
        >
          {stub.amount}
        </p>
        <p className="bg-card text-[7.3pt] text-muted-foreground">{stub.note}</p>
        {stub.barcode ? (
          <>
            <TicketBarcode code={stub.barcode} className="mt-auto h-[12mm] w-full justify-center" />
            <p className="mt-[1.5mm] text-center font-mono text-[8.5pt] font-medium tracking-[0.12em]">
              {stub.barcode}
            </p>
          </>
        ) : null}
        {stub.footer ? (
          <p className="mt-auto rounded-[1mm] bg-card px-[2mm] py-[1.5mm] text-[7.8pt]">
            {stub.footer.label}
            {stub.footer.value ? (
              <b className="block font-mono text-[9pt] font-medium">{stub.footer.value}</b>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
