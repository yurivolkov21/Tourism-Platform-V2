import { messages } from '@tourism/i18n';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { RevealBlock, RevealHeading, RevealLede } from '@/components/motion/reveal-header';

/** Nhãn tháng viết tắt SINH ra, không gõ 12 chuỗi vào i18n — cùng tiền lệ
    `formatMoney`/`toLocaleString`: đây là format DỮ LIỆU, không phải copy.
    `timeZone: 'UTC'` bắt buộc: `Date.UTC(…, i, 1)` là nửa đêm UTC, máy ở múi giờ
    âm sẽ format ra tháng TRƯỚC nếu để múi giờ cục bộ. */
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** Tên 12 tháng theo chỉ số 1–12. Hằng ở module scope, dựng một lần cho mọi vùng;
    năm 2001 chỉ là mỏ neo bất kỳ vì tên tháng không phụ thuộc năm. */
const MONTH_NAMES: readonly string[] = Array.from({ length: 12 }, (_, i) =>
  MONTH_FORMAT.format(Date.UTC(2001, i, 1)),
);

/** Nối các khoảng thành một liệt kê tiếng Anh ("Jan, May–Jun, and Oct"). Cũng là
    format dữ liệu, không phải copy — copy là câu bọc quanh nó (`seasonsWindow`). */
const RANGE_LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

function monthName(month: number): string {
  // `?? ''` vì `noUncheckedIndexedAccess`; `monthRanges` đã lọc 1–12 nên không chạy.
  return MONTH_NAMES[month - 1] ?? '';
}

/**
 * Gom các số tháng rời thành những KHOẢNG LIỀN NHAU, đọc ra chữ: `[3,4,5,9,10,11]`
 * → `['Mar–May', 'Sep–Nov']`.
 *
 * Ba ca phải đúng, cả ba đều có trong mock:
 *  1. **Vắt qua năm.** Miền Nam là `[12,1,2,3,4]` — một mùa khô LIỀN năm tháng. Coi
 *     tháng 12 và tháng 1 là hai đầu rời nhau thì in ra 'Dec' và 'Jan–Apr', nói sai
 *     về chính mùa đó. Vì vậy phép tìm điểm bắt đầu quấn vòng: tháng `m` mở một
 *     khoảng khi tháng liền TRƯỚC nó (12 nếu `m` là 1) không nằm trong tập.
 *  2. **Đẹp quanh năm.** Cả 12 tháng trong tập thì KHÔNG tháng nào mở khoảng (tháng
 *     nào cũng có tháng trước nó trong tập) — vòng lặp trả rỗng, nên phải có nhánh
 *     riêng trả `Jan–Dec`.
 *  3. **Tháng đơn lẻ.** `from === to` thì in một tên, không in 'Jul–Jul'.
 *
 * Lọc `1..12` và số nguyên trước khi gom: số ngoài dải là dữ liệu hỏng có thật khi
 * gắn API, và để nó đi tiếp thì `monthName` trả rỗng và câu chữ có một dấu gạch
 * treo lơ lửng.
 */
export function monthRanges(months: readonly number[]): string[] {
  const set = new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12));
  if (set.size === 0) return [];
  if (set.size === 12) return [`${monthName(1)}–${monthName(12)}`];

  const ranges: string[] = [];
  // Quét 1→12 theo thứ tự lịch để thứ tự khoảng in ra không phụ thuộc thứ tự mảng
  // vào (mock không hứa mảng đã sắp).
  for (let start = 1; start <= 12; start++) {
    if (!set.has(start)) continue;
    const previous = start === 1 ? 12 : start - 1;
    if (set.has(previous)) continue;

    let end = start;
    // Đi tới hết chuỗi liền, quấn vòng qua 12→1. `set.size` chặn vòng lặp: một tập
    // đã loại ca "đủ 12 tháng" thì không thể quấn hết vòng.
    for (let step = 1; step < set.size; step++) {
      const next = ((end % 12) + 1) as number;
      if (!set.has(next)) break;
      end = next;
    }
    ranges.push(start === end ? monthName(start) : `${monthName(start)}–${monthName(end)}`);
  }
  return ranges;
}

/**
 * Khu "When to visit {region}" — CHỈ miền Bắc dựng, và nó là khu CUỐI trang đó.
 *
 * ⚠️ **Dải 12 ô đã BỎ (Task 5k).** Nó là một đồ thị thu nhỏ: 12 ô có mốc, tô màu
 * theo dữ liệu, kèm chú giải — đúng họ lỗi mà user bác thẳng ở khu phổ (*"ập vào
 * mặt là một cái đồ thị. Đây là trang giao diện web cho người dùng xem chứ đâu
 * phải dashboard báo cáo dành cho admin"*). Nay mùa đẹp nói bằng CHỮ ở cỡ display:
 * "Plan for Mar–May and Sep–Nov if you can choose your dates." Người đọc lấy được
 * câu trả lời trong một cái nhìn mà không phải giải mã một dải màu.
 *
 * Vì sao khu này là khu RIÊNG của miền Bắc: Bắc có HAI mùa đẹp RỜI NHAU. Trung là
 * một dải liền (Feb–Aug), Nam vắt qua năm (Dec–Apr) — cả hai đọc thành một khoảng,
 * tức một câu ba chữ, không đủ nuôi một khu.
 *
 * ⚠️ **Nền TRANG, không phải băng phớt.** Đây là khu cuối trang Bắc, và
 * `site-footer.tsx` mang `mt-32` sơn màu `--background`; khu cuối có nền riêng thì
 * 128px đó hiện ra thành một vạch sáng kẹp giữa khu này và footer. Cơ chế
 * `data-flush-footer` từng vá chuyện đó đã xoá (Task 5k).
 *
 * `months` là mảng SỐ THÁNG rời (1–12), KHÔNG phải cặp đầu–cuối — xem `monthRanges`.
 */
export function RegionSeasons({
  regionName,
  months,
  note,
}: {
  regionName: string;
  months: readonly number[];
  note: string;
}) {
  const t = messages.regionPage;
  const ranges = monthRanges(months);

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      {/* Hai cột: câu HỎI bên trái, câu TRẢ LỜI bên phải. Đây là khu đóng trang Bắc
          nên nó cố tình là khu thuần chữ — sáu khu trên đã có ảnh, tour card và
          danh sách; một khu chữ ở cuối là nhịp nghỉ trước footer.
          `lg:grid-cols-2` chứ không `items-center`: tiêu đề và câu trả lời cùng căn
          TRÊN, để hai cột đọc như hai đoạn ngang nhau chứ không như một chú thích
          treo giữa cột kia. */}
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-xl">
          {/* `SectionEyebrow` là `text-foreground`, KHÔNG tô `--primary`: primary
              trên nền trang đo 3.03:1 ở dark, dưới ngưỡng 4.5 của chữ nhỏ. */}
          <SectionEyebrow>{t.seasonsEyebrow}</SectionEyebrow>
          {/* Cascade header (Task 5m) — xem `motion/reveal-header.tsx`. Khu này là
              khu duy nhất mà cascade chạy NGANG qua hai cột: câu HỎI (cột trái) mở
              màn, câu TRẢ LỜI (cột phải) theo sau, ghi chú thời tiết đóng nhịp. Đó
              đúng thứ tự người đọc đi, và ở dưới `lg` thì hai cột xếp dọc nên nhịp
              vẫn là trên-xuống. */}
          <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.seasonsHeading(regionName)}
          </RevealHeading>
        </div>

        <div className="max-w-xl">
          {/* Mảng rỗng và mảng toàn số ngoài 1–12 cùng rơi vào đây: bỏ HẲN nhãn và
              câu tháng đẹp, giữ mỗi ghi chú thời tiết. Nhãn "Best months" đứng trên
              một khoảng trống đọc thành một lời khuyên cụt. */}
          {ranges.length > 0 ? (
            // Nhãn và câu trả lời đi CÙNG một nhịp: nhãn là 11px mono, để nó đứng im
            // trên một câu đang trượt thì nó đọc thành một mẩu sót lại.
            <RevealBlock beat="lede">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                {t.seasonsBestLabel}
              </span>
              {/* Cỡ display cho câu trả lời — đây là chỗ khu này đặt toàn bộ trọng
                  lượng thị giác của nó, thay cho dải màu đã bỏ. */}
              <p className="mt-3 font-heading text-2xl leading-snug font-medium text-balance text-foreground md:text-3xl">
                {t.seasonsWindow(RANGE_LIST.format(ranges))}
              </p>
            </RevealBlock>
          ) : null}
          <RevealLede beat="cta" className="mt-4 text-pretty text-muted-foreground">
            {note}
          </RevealLede>
        </div>
      </div>
    </section>
  );
}
