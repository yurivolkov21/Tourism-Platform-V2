import { messages } from '@tourism/i18n';
import type { PrintList } from '@/lib/print/print-ticket';
import { PRINT_SECTION } from './print-styles';

/** Hai cột Included / Not included của voucher 5b: ✓ teal và – xám. Hai cột trống thì không vẽ. */
export function PrintLists({
  included,
  excluded,
}: {
  included: PrintList | null;
  excluded: PrintList | null;
}) {
  if (included === null && excluded === null) return null;
  const t = messages.printDoc.voucher;
  return (
    <div data-slot="print-lists" className="mt-[5mm] grid grid-cols-2 gap-[8mm]">
      <ListColumn
        heading={t.included}
        list={included}
        mark="✓"
        markClass="font-bold text-primary"
      />
      <ListColumn
        heading={messages.tourDetail.itinerary.excluded}
        list={excluded}
        mark="–"
        markClass="text-muted-foreground"
      />
    </div>
  );
}

function ListColumn({
  heading,
  list,
  mark,
  markClass,
}: {
  heading: string;
  list: PrintList | null;
  mark: string;
  markClass: string;
}) {
  // Cột trống vẫn giữ ô lưới để cột kia không nhảy sang trái.
  if (list === null) return <div />;
  return (
    <section>
      <h3 className={`mb-[2.5mm] ${PRINT_SECTION}`}>{heading}</h3>
      <ul>
        {list.items.map((item) => (
          <li key={item} className="relative mt-[1mm] pl-[4.5mm]">
            <span aria-hidden="true" className={`absolute left-0 ${markClass}`}>
              {mark}
            </span>
            {item}
          </li>
        ))}
        {list.more ? (
          <li className="mt-[1mm] pl-[4.5mm] text-muted-foreground">{list.more}</li>
        ) : null}
      </ul>
    </section>
  );
}
