import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';

/** Nhãn tháng viết tắt SINH ra, không gõ 12 chuỗi vào i18n — cùng tiền lệ
    `formatMoney`/`toLocaleString`: đây là format DỮ LIỆU, không phải copy.
    `timeZone: 'UTC'` bắt buộc: `Date.UTC(…, i, 1)` là nửa đêm UTC, máy ở múi giờ
    âm sẽ format ra tháng TRƯỚC nếu để múi giờ cục bộ. */
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** Mười hai tháng theo thứ tự lịch — hằng ở module scope, dựng một lần cho mọi
    vùng. Năm 2001 chỉ là mỏ neo bất kỳ; tên tháng không phụ thuộc năm. */
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  number: i + 1,
  label: MONTH_FORMAT.format(Date.UTC(2001, i, 1)),
}));

/**
 * Biến thể Signature "seasons" — dải 12 tháng, tháng đẹp tô `--primary`, hiện chỉ
 * miền Bắc dùng.
 *
 * Thay biến thể `itinerary` bị bác 29/07: khu đó kể hành trình theo NGÀY của MỘT
 * tour, tức là nội dung của `/tours/[slug]` (nơi `ItineraryTimeline` đã làm đúng
 * việc đó). Trang VÙNG phải nói về vùng — mùa đẹp là sự thật về nơi chốn, không
 * phải lời hứa về một sản phẩm cụ thể.
 *
 * `months` là mảng SỐ THÁNG rời (1–12), KHÔNG phải cặp đầu–cuối: miền Nam là
 * `[12, 1, 2, 3, 4]`, vắt qua năm. Đọc nó như một khoảng min→max là tô nhầm cả
 * tháng 5–11.
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

  // Kiểm tra THÀNH VIÊN, không phải khoảng min→max. Bản khoảng đã đo sai: với
  // miền Nam `[12, 1, 2, 3, 4]` nó tô luôn tháng 5–11, tức là đúng nửa năm mưa.
  const bestMonths = new Set(months);
  const isBestMonth = (n: number) => bestMonths.has(n);

  const bestNames = MONTHS.filter((m) => isBestMonth(m.number)).map((m) => m.label);
  const otherNames = MONTHS.filter((m) => !isBestMonth(m.number)).map((m) => m.label);

  return (
    <section
      style={{ background: SIGNATURE_BAND_BG }}
      className="w-full px-4 py-20 md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* `SectionEyebrow` (quy ước toàn site) — `text-foreground`, KHÔNG tô
              `--primary` lên chữ eyebrow: trên nền băng phớt này primary đo được
              3.03:1 ở dark, dưới ngưỡng 4.5 của chữ nhỏ. Accent của khu này đi
              vào NỀN ô tháng, nơi nó cặp với `primary-foreground`. */}
          <SectionEyebrow>{t.seasonsEyebrow}</SectionEyebrow>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.seasonsHeading(regionName)}
          </h2>
          <p className="mt-2 text-lg text-pretty text-muted-foreground">{note}</p>
        </div>

        {/* Điều kiện là "có ô nào được tô không", KHÔNG phải "mảng có phần tử
            nào không": mảng rỗng (nhánh có thật khi gắn API: vùng chưa có dữ
            liệu mùa) và mảng toàn số ngoài 1–12 (dữ liệu hỏng) cùng phải rơi vào
            đây. Cả hai bỏ HẲN dải lẫn chú giải, giữ mỗi ghi chú — một dải 12 ô
            xám trơn không nói gì, còn nhãn "Best months" đứng cạnh danh sách
            rỗng thì đọc thành một lời khuyên cụt. */}
        {bestNames.length > 0 ? (
          <>
            {/* Dải là ĐỒ HOẠ thuần: `aria-hidden` để trình đọc màn hình không
                phải nghe 12 mẩu "Jan Feb Mar…" rời rạc. Toàn bộ thông tin của nó
                nằm dưới dạng CHỮ trong `<dl>` ngay bên dưới — đó cũng là lý do
                không dùng `role="img"` + `aria-label`: nội dung phải tồn tại
                bằng chữ nhìn thấy được cho người mù màu, và nếu đã có chữ thì
                thêm `aria-label` là bắt trình đọc nói hai lần cùng một câu.
                Tín hiệu phân biệt KHÔNG chỉ là màu: ô đẹp khác ô thường ở nền,
                ở độ đậm chữ, và trên hết là ở danh sách tên tháng viết bằng chữ
                dưới đây — người mù màu đọc được mà không cần phân biệt sắc. */}
            <ol
              aria-hidden="true"
              className="mt-12 grid grid-cols-6 gap-1.5 sm:mt-14 sm:grid-cols-12 sm:gap-2"
            >
              {MONTHS.map((month) => {
                const isBest = isBestMonth(month.number);
                return (
                  <li
                    key={month.number}
                    data-month={month.number}
                    data-best={isBest}
                    className={cn(
                      'flex h-12 items-center justify-center rounded-lg font-mono text-xs tracking-wider uppercase',
                      isBest
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {month.label}
                  </li>
                );
              })}
            </ol>

            {/* `flex flex-wrap`, KHÔNG `grid-cols-2`: lưới hai cột kéo mục thứ
                hai ra tận mép phải của khung `max-w-7xl` (đo được ~700px trống ở
                giữa), đọc thành hai chú giải rời chứ không phải một cặp. */}
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
              <div className="flex items-baseline gap-2.5">
                {/* Chấm chú giải phải dùng ĐÚNG token của ô tháng đẹp
                    (`bg-primary`) — lệch một trong hai là chú giải nói dối. */}
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 translate-y-px rounded-[3px] bg-primary"
                />
                <dt className="font-medium text-foreground">{t.seasonsBestLabel}</dt>
                <dd className="text-muted-foreground">{bestNames.join(', ')}</dd>
              </div>
              {/* Vùng đẹp quanh năm (nhiệt đới, không mùa mưa rõ rệt) là dữ
                  liệu hợp lệ — khi đó bỏ hẳn mục này thay vì để nhãn đứng cạnh
                  danh sách rỗng, vốn đọc thành một lời khuyên cụt. */}
              {otherNames.length > 0 ? (
                <div className="flex items-baseline gap-2.5">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 translate-y-px rounded-[3px] bg-muted"
                  />
                  <dt className="font-medium text-foreground">{t.seasonsOtherLabel}</dt>
                  <dd className="text-muted-foreground">{otherNames.join(', ')}</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
      </div>
    </section>
  );
}
