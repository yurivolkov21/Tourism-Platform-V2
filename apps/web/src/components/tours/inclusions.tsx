import { messages } from '@tourism/i18n';
import { CheckIcon, XIcon } from 'lucide-react';

/**
 * Included / Not included, hai cột.
 *
 * Render NGUYÊN VĂN từng chuỗi trong `included[]`/`excluded[]`. Không regex-parse
 * để rút ra meals/transport/accommodation — đó là hack của Nexora
 * (`tour-detail-derive.ts`): không field nào bảo đảm định dạng chuỗi, nên parse
 * là đoán, và đoán sai thì hiện sai thông tin bán hàng.
 */
export function Inclusions({ included, excluded }: { included: string[]; excluded: string[] }) {
  const t = messages.tourDetail;

  return (
    // Một bên rỗng vẫn GIỮ lưới 2 cột: bỏ cột đi làm hai tour cạnh nhau có bố cục
    // khác nhau, và người đọc mất mốc so sánh "cái gì không có trong giá".
    <div className="mt-6 grid gap-8 sm:grid-cols-2">
      <Column
        heading={t.inclusions.included}
        items={included}
        tone="included"
        emptyLabel={t.inclusions.empty}
      />
      <Column
        heading={t.inclusions.excluded}
        items={excluded}
        tone="excluded"
        emptyLabel={t.inclusions.empty}
      />
    </div>
  );
}

function Column({
  heading,
  items,
  tone,
  emptyLabel,
}: {
  heading: string;
  items: string[];
  tone: 'included' | 'excluded';
  emptyLabel: string;
}) {
  const Icon = tone === 'included' ? CheckIcon : XIcon;

  return (
    <div>
      <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        {heading}
      </h3>

      {items.length === 0 ? (
        <p className="mt-3 text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm text-pretty">
              <Icon
                aria-hidden="true"
                className={
                  // Chỉ cột "included" dùng token success. Cột loại trừ để trầm:
                  // tô đỏ danh sách "không bao gồm" biến một thông tin bình thường
                  // thành lời cảnh báo.
                  tone === 'included'
                    ? 'mt-0.5 size-4 shrink-0 text-success'
                    : 'mt-0.5 size-4 shrink-0 text-muted-foreground'
                }
              />
              <span className={tone === 'included' ? 'text-foreground' : 'text-muted-foreground'}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
