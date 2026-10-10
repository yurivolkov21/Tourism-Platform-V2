import { PRINT_LABEL } from '@tourism/ui/lib/print-styles';
import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';
import type { PrintColumn } from '@/lib/print/print-ticket';

/** Lưới cột của dải: voucher 5b cho cột đầu (điểm hẹn) rộng hơn; hoá đơn B1 ba cột đều. */
function gridCols(count: number, wideFirst: boolean): string {
  if (count >= 3) return wideFirst ? 'grid-cols-[1.15fr_1fr_1fr]' : 'grid-cols-3';
  return count === 2 ? 'grid-cols-2' : 'grid-cols-1';
}

/**
 * Dòng phụ của cột mã đơn ("Booked by {email}"): cột ~53 mm chỉ chứa ~31 ký tự, email dài không có
 * chỗ ngắt thì tràn khỏi dải. Ngắt có chủ đích trước "@" (`<wbr>`); `overflow-wrap: anywhere` chỉ là lưới
 * cuối cho phần trước "@" vẫn quá dài.
 */
function breakBeforeAt(text: string): ReactNode {
  const at = text.lastIndexOf('@');
  if (at <= 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <wbr />
      {text.slice(at)}
    </>
  );
}

/** Dải cuối nền `paper` (5b, B1). Cột mã đơn in mã mono ở dòng riêng (`PrintColumn.reference`). */
export function PrintBand({
  columns,
  wideFirst = false,
  className,
}: {
  columns: PrintColumn[];
  wideFirst?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="print-band"
      className={cn(
        'grid gap-[6mm] rounded-[2.5mm] bg-paper px-[5mm] py-[4mm]',
        gridCols(columns.length, wideFirst),
        className,
      )}
    >
      {columns.map((column) => (
        <div key={column.heading}>
          <h3 className={cn(PRINT_LABEL, 'mb-[1mm] text-primary-emphasis')}>{column.heading}</h3>
          {column.reference ? (
            <>
              <p className="font-mono font-medium">{column.strong}</p>
              {column.text ? (
                <p className="text-muted-foreground [overflow-wrap:anywhere]">
                  {breakBeforeAt(column.text)}
                </p>
              ) : null}
            </>
          ) : (
            <p>
              {column.strong ? <b className="font-semibold">{column.strong}</b> : null}
              {column.strong && column.text ? ' · ' : null}
              {column.text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
