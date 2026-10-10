import { VIETNAM_TIME_ZONE } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { DocFooter } from '@tourism/ui/components/print-doc/doc-footer';
import { DocPage } from '@tourism/ui/components/print-doc/doc-page';
import { PrintedAt } from '@tourism/ui/components/print-doc/printed-at';
import { PRINT_SECTION } from '@tourism/ui/lib/print-styles';
import { cn } from '@tourism/ui/lib/utils';
import type { VoucherPrintView } from '@/lib/print/voucher-print';
import { EMAIL } from '@/lib/site';
import { PhotoCover } from './photo-cover';
import { PrintBand } from './print-band';
import { PrintLists } from './print-lists';
import { PrintTear } from './print-tear';
import { PrintTicket } from './print-ticket';

/**
 * Voucher in — phương án 5b (G40, spec §3.1): bìa ảnh 62 mm → vé có cuống → dòng xé → lịch trình hai
 * cột → Included / Not included → dải ba cột → chân trang. Chỉ hiện khi in (`DocPage`).
 */
export function VoucherPrint({ view }: { view: VoucherPrintView }) {
  const t = messages.printDoc.voucher;
  const stops = view.day?.stops ?? [];
  // Danh sách ngày của chuyến nhiều ngày không có giờ: bỏ hẳn cột giờ thay vì chừa 12 mm trống.
  const timed = stops.some((stop) => stop.time !== null);
  return (
    <DocPage className="pt-[11mm]">
      <PhotoCover
        photo={view.photo}
        heightClass="h-[62mm]"
        titleClass={view.longTitle ? 'text-[22pt]' : 'text-[27pt]'}
        docType={t.docType}
        meta={view.issued}
        kicker={view.kicker}
        title={view.title}
      />
      <div className="mt-[7mm]">
        <PrintTicket view={view.ticket} />
      </div>
      {/* Không mã vạch thì không dòng xé; giữ khoảng để phần dưới không dính vào vé. */}
      {view.tear ? <PrintTear text={view.tear} /> : <div aria-hidden="true" className="h-[6mm]" />}
      {view.day ? (
        <section data-slot="print-day" className="mt-[1mm]">
          <h3 className={`mb-[2.5mm] ${PRINT_SECTION}`}>{view.day.heading}</h3>
          {/* Hai cột đổ theo CỘT (hết cột trái mới sang phải) như bản thảo 5b, mà DOM vẫn đúng thứ
              tự thời gian: số hàng của lưới tính theo số mục — bố cục theo dữ liệu, không phải màu. */}
          <ol
            className="grid grid-flow-col grid-cols-2 gap-x-[8mm]"
            style={{ gridTemplateRows: `repeat(${Math.ceil(stops.length / 2)}, auto)` }}
          >
            {stops.map((stop, row) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: danh sách tĩnh theo đúng thứ tự lịch trình, không bao giờ sắp lại; một ngày có thể có hai dòng cùng chữ nên chữ không làm khoá được.
                key={row}
                className={cn(
                  'grid items-start gap-[1.5mm] py-[0.8mm]',
                  timed ? 'grid-cols-[3mm_12mm_1fr]' : 'grid-cols-[3mm_1fr]',
                )}
              >
                <span
                  aria-hidden="true"
                  className="mt-[1.4mm] size-[1.8mm] rounded-full bg-primary"
                />
                {timed ? (
                  stop.time ? (
                    <time className="font-mono text-[8.3pt] font-medium text-primary-emphasis">
                      {stop.time}
                    </time>
                  ) : (
                    <span />
                  )
                ) : null}
                <span className="line-clamp-2">{stop.text}</span>
              </li>
            ))}
          </ol>
          {view.day.more ? (
            <p className="mt-[1mm] text-[8pt] text-muted-foreground">{view.day.more}</p>
          ) : null}
        </section>
      ) : null}
      <PrintLists included={view.included} excluded={view.excluded} />
      <PrintBand columns={view.band} wideFirst className="mt-[5mm]" />
      <DocFooter
        start={
          <>
            {messages.voucher.needHelp} {messages.printDoc.replyOrWriteTo}{' '}
            <b className="font-semibold text-foreground">{EMAIL}</b>
          </>
        }
        end={<PrintedAt prefix={messages.printDoc.printedPrefix} timeZone={VIETNAM_TIME_ZONE} />}
      />
    </DocPage>
  );
}
