import { VIETNAM_TIME_ZONE } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { DocFooter } from '@tourism/ui/components/print-doc/doc-footer';
import { DocPage } from '@tourism/ui/components/print-doc/doc-page';
import { PrintedAt } from '@tourism/ui/components/print-doc/printed-at';
import { PRINT_LABEL, PRINT_SECTION } from '@tourism/ui/lib/print-styles';
import { cn } from '@tourism/ui/lib/utils';
import type { ReceiptPrintView } from '@/lib/print/receipt-print';
import { EMAIL, PHONE } from '@/lib/site';
import { PhotoCover } from './photo-cover';
import { PrintBand } from './print-band';
import { PrintTear } from './print-tear';
import { PrintTicket } from './print-ticket';

const TH = cn(PRINT_LABEL, 'border-b-[0.8pt] border-foreground pb-[2mm] text-left');
const TD = 'border-b-[0.5pt] border-border py-[2.6mm] align-top';
const SUB = 'mt-[0.5mm] block text-[8pt] text-muted-foreground';

/**
 * Hoá đơn chờ in — B1 (G40, spec §4.2): bìa ảnh 46 mm → vé chờ → dòng xé → bảng tiền → dải ba cột →
 * chân trang có điện thoại. Chỉ hiện khi in (`DocPage`).
 */
export function ReceiptPrint({ view }: { view: ReceiptPrintView }) {
  const r = messages.printDoc.receipt;
  return (
    <DocPage className="pt-[11mm]">
      <PhotoCover
        photo={view.photo}
        heightClass="h-[46mm]"
        titleClass="text-[22pt]"
        docType={r.docType}
        meta={view.booked}
        kicker={view.kicker}
        title={view.title}
      />
      <div className="mt-[6mm]">
        <PrintTicket view={view.ticket} />
      </div>
      {/* Đơn quá hạn chót không có dòng xé; giữ khoảng để bảng tiền không dính vào vé. */}
      {view.tear ? <PrintTear text={view.tear} /> : <div aria-hidden="true" className="h-[6mm]" />}
      <section data-slot="print-summary" className="mt-[7mm]">
        <h3 className={cn('mb-[2mm]', PRINT_SECTION)}>{r.summary}</h3>
        <table className="w-full border-collapse text-[9pt]">
          <thead>
            <tr>
              <th className={TH}>{r.columns.item}</th>
              <th className={TH}>{messages.passportVisa.labels.travellers}</th>
              <th className={cn(TH, 'text-right')}>{r.columns.price}</th>
              <th className={cn(TH, 'text-right')}>{r.columns.amount}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>
                <b className="font-semibold">{view.line.item}</b>
                <span className={SUB}>{view.line.sub}</span>
              </td>
              <td className={TD}>{view.line.travellers}</td>
              <td className={cn(TD, 'text-right')}>
                {view.line.price}
                <span className={SUB}>{view.line.priceNote}</span>
              </td>
              <td className={cn(TD, 'text-right')}>{view.line.amount}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="text-[11pt] font-bold">
              <td colSpan={3} className="border-t-[0.8pt] border-foreground pt-[2.5mm] pb-[1.6mm]">
                {view.total.label}
              </td>
              <td className="border-t-[0.8pt] border-foreground pt-[2.5mm] pb-[1.6mm] text-right">
                {view.total.amount}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="pb-[1.6mm] text-right text-[7.8pt] text-muted-foreground">
                {view.total.note}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
      <PrintBand columns={view.band} className="mt-[7mm]" />
      <DocFooter
        start={
          <>
            {messages.booking.success.needHelp} {messages.printDoc.writeTo}{' '}
            <b className="font-semibold text-foreground">{EMAIL}</b> · {PHONE}
          </>
        }
        end={<PrintedAt prefix={messages.printDoc.printedPrefix} timeZone={VIETNAM_TIME_ZONE} />}
      />
    </DocPage>
  );
}
