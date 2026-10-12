import { VIETNAM_TIME_ZONE } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { DocFooter } from '@tourism/ui/components/print-doc/doc-footer';
import { DocLetterhead } from '@tourism/ui/components/print-doc/doc-letterhead';
import { DocPage } from '@tourism/ui/components/print-doc/doc-page';
import { PrintedAt } from '@tourism/ui/components/print-doc/printed-at';
import { PRINT_LABEL, PRINT_SECTION } from '@tourism/ui/lib/print-styles';
import { cn } from '@tourism/ui/lib/utils';
import type { ReportPrintPnlRow, ReportPrintView } from '@/lib/report-print';
import { ReportPrintBrand } from './report-print-brand';
import { StatusBar } from './status-bar';
import { Waterfall } from './waterfall';

const t = messages.admin.reports;

/** Tên khối: chữ tiêu đề in chung, khoảng trên dưới của bản thảo C2. */
const SECTION = cn(PRINT_SECTION, 'mt-[5mm] mb-[1.6mm]');

/** Một dòng của bảng lãi lỗ kế toán (bản thảo `.stmt.mini`). */
function PnlRow({ row }: { row: ReportPrintPnlRow }) {
  const ruled = row.rule !== 'none' && 'border-t-[0.6pt] border-foreground';
  const net = row.rule === 'net' && 'border-b-[2.2pt] border-double border-foreground';
  return (
    <tr data-key={row.key} data-rule={row.rule}>
      <td
        className={cn(
          'py-[1.1mm]',
          ruled,
          net,
          row.indent && 'pl-[6mm] text-foreground/85',
          row.rule === 'sub' && 'font-semibold',
          row.rule === 'net' && 'text-[10pt] font-bold',
        )}
      >
        {row.label}
      </td>
      <td
        className={cn(
          'py-[1.1mm] text-right font-mono',
          ruled,
          net,
          row.rule !== 'none' && 'font-medium',
          row.rule === 'net' && 'text-[9.6pt]',
        )}
      >
        {row.value}
      </td>
    </tr>
  );
}

/**
 * Bản in báo cáo tháng C2 — "dashboard trên giấy" (G40 Phần 2, spec §5.1, bản thảo
 * `print-report.src.html`): đầu trang nội bộ → tiêu đề, dòng kỳ → bốn ô số → thác nước cạnh bảng lãi
 * lỗ → thanh trạng thái → lưới tám chỉ số → bảy chú giải → chân trang nội bộ. Chỉ hiện khi in
 * (`DocPage`); mọi chữ, số, hình đến từ `reportPrintView`.
 *
 * Tiêu đề tờ là `h2` (vỏ admin đã có `h1` ở thanh trên), tên khối `h3`.
 */
export function ReportPrint({ view }: { view: ReportPrintView }) {
  return (
    <DocPage data-slot="report-print">
      <DocLetterhead
        brand={<ReportPrintBrand />}
        docType={t.title}
        docNumber={view.docNumber}
        meta={view.meta}
        className="border-b-[0.8pt] border-foreground pb-[4mm]"
      />
      <h2 className="mt-[5mm] font-heading text-[21pt] leading-[1.15] font-semibold">
        {view.title}
      </h2>
      <p className="mt-[1.2mm] text-muted-foreground">{view.periodLine}</p>

      <div data-slot="report-tiles" className="mt-[6mm] grid grid-cols-4 gap-[3mm]">
        {view.tiles.map((tile) => (
          <div
            key={tile.key}
            data-hero={tile.hero ? '' : undefined}
            className={cn(
              'rounded-[2mm] border-[0.6pt] px-[3.5mm] py-[3mm]',
              tile.hero ? 'border-transparent bg-paper' : 'border-border',
            )}
          >
            <p className={PRINT_LABEL}>{tile.label}</p>
            <p
              className={cn(
                'mt-[1mm] leading-tight font-semibold tabular-nums',
                tile.long ? 'text-[12pt]' : 'text-[15pt]',
              )}
            >
              {tile.value}
            </p>
            <p className="mt-[0.5mm] text-[7.4pt] text-muted-foreground">{tile.caption}</p>
          </div>
        ))}
      </div>

      <section data-slot="report-waterfall">
        <h3 className={SECTION}>{t.waterfallHeading}</h3>
        <div className="grid grid-cols-[1fr_64mm] items-start gap-[7mm]">
          {view.waterfall ? (
            <Waterfall view={view.waterfall} />
          ) : (
            <p className="flex h-[40mm] items-center justify-center rounded-[2mm] border-[0.6pt] border-dashed border-border text-muted-foreground">
              {t.printDoc.noFigures}
            </p>
          )}
          <table data-slot="report-pnl" className="w-full border-collapse text-[8pt] tabular-nums">
            <tbody>
              {view.pnl.map((row) => (
                <PnlRow key={row.key} row={row} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-[2mm] text-[7.8pt] text-muted-foreground">
                  {view.departuresNote}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {view.costWarning ? (
          <p
            data-slot="report-cost-warning"
            className="mt-[2mm] text-[8pt] text-destructive-emphasis"
          >
            {view.costWarning}
          </p>
        ) : null}
      </section>

      <section data-slot="report-bookings">
        <h3 className={SECTION}>{t.bookingsTable.heading}</h3>
        {view.statusBar ? (
          <StatusBar view={view.statusBar} />
        ) : (
          <p className="text-muted-foreground">{t.bookingsTable.empty}</p>
        )}
      </section>

      <section data-slot="report-ops">
        <h3 className={SECTION}>{t.operationsTable.heading}</h3>
        <dl className="grid grid-cols-4 border-t-[0.6pt] border-border">
          {view.ops.map((row) => (
            <div
              key={row.key}
              className="border-b-[0.6pt] border-border pt-[2.6mm] pr-[3mm] pb-[2.8mm]"
            >
              <dt className={PRINT_LABEL}>{row.label}</dt>
              <dd className="mt-[0.6mm] text-[11pt] font-semibold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section data-slot="report-definitions">
        <h3 className={SECTION}>{t.definitions.heading}</h3>
        <ol className="columns-2 gap-[8mm] text-[7.2pt] leading-[1.38] text-foreground/85">
          {view.definitions.map((text, i) => (
            <li key={text} className="relative mb-[1.6mm] break-inside-avoid pl-[4mm]">
              <span
                aria-hidden="true"
                className="absolute left-0 font-mono text-[6.8pt] font-medium text-primary-emphasis"
              >
                {i + 1}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </section>

      <DocFooter
        start={
          <>
            <b className="font-semibold text-foreground">{messages.admin.exportFile.backOffice}</b>{' '}
            · {view.footerRef} · {messages.admin.exportFile.internal}
          </>
        }
        end={<PrintedAt prefix={messages.printDoc.printedPrefix} timeZone={VIETNAM_TIME_ZONE} />}
      />
    </DocPage>
  );
}
