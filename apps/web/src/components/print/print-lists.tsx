import { messages } from '@tourism/i18n';
import { PRINT_SECTION } from '@tourism/ui/lib/print-styles';
import type { PrintList } from '@/lib/print/print-ticket';

/**
 * Hai cột Included / Not included của voucher 5b: ✓ teal và – xám. Hai cột trống thì không vẽ.
 * `oneLine`: mỗi mục kẹp một dòng thay vì hai — ca cực hạn mà bìa thấp nhất vẫn không đủ chỗ.
 */
export function PrintLists({
  included,
  excluded,
  oneLine = false,
}: {
  included: PrintList | null;
  excluded: PrintList | null;
  oneLine?: boolean;
}) {
  if (included === null && excluded === null) return null;
  const t = messages.printDoc.voucher;
  return (
    <div data-slot="print-lists" className="mt-[4mm] grid grid-cols-2 gap-[8mm]">
      <ListColumn
        heading={t.included}
        list={included}
        mark="✓"
        markClass="font-bold text-primary"
        oneLine={oneLine}
      />
      <ListColumn
        heading={messages.tourDetail.itinerary.excluded}
        list={excluded}
        mark="–"
        markClass="text-muted-foreground"
        oneLine={oneLine}
      />
    </div>
  );
}

function ListColumn({
  heading,
  list,
  mark,
  markClass,
  oneLine,
}: {
  heading: string;
  list: PrintList | null;
  mark: string;
  markClass: string;
  oneLine: boolean;
}) {
  // Cột trống vẫn giữ ô lưới để cột kia không nhảy sang trái.
  if (list === null) return <div />;
  return (
    <section>
      <h3 className={`mb-[2.5mm] ${PRINT_SECTION}`}>{heading}</h3>
      <ul>
        {list.items.map((item) => (
          <li key={item} className="relative mt-[0.7mm] pl-[4.5mm]">
            <span aria-hidden="true" className={`absolute left-0 ${markClass}`}>
              {mark}
            </span>
            {/* Mục admin nhập dài tới 200 ký tự: kẹp hai dòng (ca cực hạn một dòng) để tờ giữ một trang (spec §3.4). */}
            <span className={oneLine ? 'line-clamp-1' : 'line-clamp-2'}>{item}</span>
          </li>
        ))}
        {list.more ? (
          <li className="mt-[0.7mm] pl-[4.5mm] text-muted-foreground">{list.more}</li>
        ) : null}
      </ul>
    </section>
  );
}
