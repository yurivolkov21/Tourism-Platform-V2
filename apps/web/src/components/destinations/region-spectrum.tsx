import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import Link from 'next/link';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';
import type { MockTourCard, MockTourDifficulty } from '@/mocks/types';

/** Bậc độ khó ĐỂ VẼ. Thêm `UNGRADED` vì `difficulty` của contract là nullable —
    một chuyến chưa xếp bậc vẫn có số ngày thật, nên nó phải có điểm trên trục;
    thứ chưa biết là bậc, không phải chuyến. */
type GradeKey = MockTourDifficulty | 'UNGRADED';

/**
 * Bậc → hình dạng thanh. **KHÔNG ba màu riêng cho ba bậc** (bài học ADR-0015:
 * lớp màu theo vùng bị rút đúng vì màu mang thông tin mà không cắm vào sự thật
 * nào — và người mù màu không đọc được). Tín hiệu là **ĐỘ DÀY** trên cùng một
 * sắc `--primary`: 6px → 10px → 16px, một thang đọc được cả khi in trắng đen.
 * Nó vẫn không phải tín hiệu duy nhất — mỗi điểm còn mang nhãn CHỮ, đúng cách
 * `region-seasons.tsx` xử dải 12 tháng.
 *
 * ⚠️ Bản đầu ghép độ dày VỚI một thang alpha (`primary/45` · `/70` · `primary`).
 * Đo được 29/07: trên nền băng, `primary/45` chỉ đạt **1.91:1 light / 1.64:1
 * dark** và `primary/70` đạt **2.91 / 2.18** — cả hai dưới ngưỡng 3.0 của
 * WCAG 1.4.11 cho đồ hoạ. Thang alpha bị RÚT: nó làm chính hai bậc nhẹ gần như
 * biến mất khỏi khu vốn tồn tại để cho thấy dải. Nay cả ba thanh đặc
 * `--primary` (đo lại **5.09 / 3.03**) và chỉ khác nhau ở độ dày.
 *
 * `UNGRADED` cố tình RỜI khỏi thang, và rời bằng HÌNH chứ không chỉ bằng sắc:
 * một nét ĐỨT `muted-foreground`. Nếu chỉ đổi màu mà giữ nguyên độ dày của
 * `EASY` thì hai bậc chỉ phân biệt được bằng màu — đúng thứ khu này đi tránh.
 *
 * Thứ tự KHAI BÁO ở đây chính là thứ tự chú giải (xem `GRADE_ORDER`) — một
 * nguồn, không phải hai danh sách rồi trôi khỏi nhau.
 */
const GRADE_BAR = {
  EASY: 'h-1.5 bg-primary',
  MODERATE: 'h-2.5 bg-primary',
  CHALLENGING: 'h-4 bg-primary',
  UNGRADED: 'h-0 border-t-2 border-dashed border-muted-foreground',
} satisfies Record<GradeKey, string>;

/** Thứ tự chú giải SUY TỪ chính bảng trên (khoá chuỗi giữ thứ tự khai báo), nên
    thêm một bậc vào contract là `satisfies` bắt lỗi ngay chứ không âm thầm rơi
    khỏi chú giải. Cùng ý với `DIFFICULTY_ORDER` của `lib/regions.ts`. */
const GRADE_ORDER = Object.keys(GRADE_BAR) as GradeKey[];

/** Bề rộng cột tên chuyến và cột số liệu — HẰNG dùng chung cho hàng dữ liệu và
    hàng thước, để hai thứ thẳng cột nhau. Hai lưới rời nhau thì cột tự tính độ
    rộng riêng và thước sẽ lệch khỏi thanh mà không có gì báo. */
const COL_TITLE = 'sm:w-52 lg:w-64';
const COL_META = 'sm:w-36';

function gradeKeyOf(tour: MockTourCard): GradeKey {
  return tour.difficulty ?? 'UNGRADED';
}

function gradeLabelOf(key: GradeKey): string {
  return key === 'UNGRADED'
    ? messages.regionPage.spectrum.ungraded
    : messages.toursPage.difficultyLabels[key];
}

/**
 * Khu MỞ ĐẦU của miền Bắc — phổ "số ngày × độ khó" của các chuyến RIÊNG vùng.
 *
 * Vì sao chỉ miền Bắc dựng: đo 29/07, Bắc là vùng DUY NHẤT trải hết 1→8 ngày và
 * chạm bậc `CHALLENGING`. Trung là 1,1,1,1,6 và Nam là 1,1,2,2,3 — vẽ lên trục
 * thì cả hai ra một cụm phẳng, tức là một biểu đồ không nói gì. Bản đồ
 * vùng→khu nằm ở `regionTheme().openWith`, không ở đây.
 *
 * ⚠️ `tours` phải là **chuyến RIÊNG của vùng** (`ownToursInRegion`), KHÔNG phải
 * `toursInRegion`. `north-to-south-classic` dài 12 ngày và chạm cả ba vùng: cho
 * nó vào là trục dài gấp rưỡi rồi cụm 1–8 bị bóp lại thành một vệt sát mép
 * trái — và trang miền Bắc lại đi quảng cáo một hành trình mà phần lớn thời
 * gian ở nơi khác. Component không tự lọc được (nó không thấy `DESTINATIONS`),
 * nên việc lọc thuộc tầng trang; `regions.spec.ts` canh hai chỗ dùng chung MỘT
 * định nghĩa.
 *
 * Mỗi chuyến là một HÀNG riêng chứ không phải một chấm trên trục dùng chung:
 * miền Bắc có hai chuyến cùng 2 ngày, và hai chấm cùng toạ độ thì đè nhau —
 * nhìn ra 4 điểm trong khi dữ liệu có 5.
 */
export function RegionSpectrum({
  regionName,
  tours,
}: {
  regionName: string;
  tours: readonly MockTourCard[];
}) {
  const t = messages.regionPage.spectrum;

  // Không chuyến nào thì BỎ HẲN khu (nhánh có thật khi gắn API: vùng mới chỉ
  // được tour liên vùng ghé qua). Một trục trống kèm tiêu đề "from a day out to
  // a week" là hứa một dải chuyến không tồn tại.
  if (tours.length === 0) return null;

  // `sort` tại BẢN SAO — `tours` là prop, sắp tại chỗ là sửa mảng của nơi gọi.
  // `sort` của JS ổn định, nên hai chuyến bằng nhau giữ thứ tự catalogue, cùng
  // luật `longestTourInRegion` ("bằng nhau thì chuyến gặp trước thắng").
  const sorted = [...tours].sort((a, b) => a.durationDays - b.durationDays);
  const maxDays = Math.max(...tours.map((tour) => tour.durationDays));
  // Mốc 1..max — thang TUYẾN TÍNH theo ngày. Ô thứ d chiếm đúng đoạn
  // [(d−1)/max, d/max] nên số của nó nằm khít vạch d, không cần định vị tuyệt
  // đối và không có nhãn nào tràn khỏi mép phải.
  const ticks = Array.from({ length: maxDays }, (_, i) => i + 1);

  const present = GRADE_ORDER.map((key) => ({
    key,
    count: tours.filter((tour) => gradeKeyOf(tour) === key).length,
  })).filter((entry) => entry.count > 0);

  return (
    <section
      style={{ background: SIGNATURE_BAND_BG }}
      className="w-full px-4 py-20 md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* `SectionEyebrow` là `text-foreground`, KHÔNG tô `--primary` — trên
              băng phớt này primary đo 3.03:1 ở dark, dưới ngưỡng 4.5 của chữ
              nhỏ. Accent của khu đi vào THANH, nơi nó cặp với nền băng. */}
          <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.heading(regionName)}
          </h2>
          <p className="mt-2 text-lg text-pretty text-muted-foreground">{t.subtitle}</p>
        </div>

        <ol className="mt-12 sm:mt-14">
          {sorted.map((tour) => {
            const key = gradeKeyOf(tour);
            return (
              <li
                key={tour.slug}
                data-tour={tour.slug}
                data-days={tour.durationDays}
                data-grade={key}
                className="border-b border-border/60 last:border-b-0"
              >
                <Link
                  href={`/tours/${tour.slug}`}
                  className="group flex flex-col gap-2 rounded-lg py-3.5 transition-colors sm:flex-row sm:items-center sm:gap-5"
                >
                  <span className={cn('shrink-0', COL_TITLE)}>
                    <span className="block font-heading text-base font-medium text-pretty text-foreground group-hover:text-primary">
                      {tour.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                      {tour.category.name}
                    </span>
                  </span>

                  {/* Thanh là ĐỒ HOẠ thuần — `aria-hidden` để trình đọc màn hình
                      không phải nghe một phần tử rỗng. Mọi thứ nó nói (số ngày,
                      bậc) đều có mặt bằng CHỮ ở cột bên phải. */}
                  <span aria-hidden="true" className="relative flex h-6 flex-1 items-center sm:h-7">
                    <span className="absolute inset-x-0 h-px bg-border" />
                    <span
                      // Bề rộng là HÌNH HỌC dẫn xuất từ dữ liệu (ngày/max), không
                      // phải màu — inline style ở đây không phạm luật tokens-only.
                      style={{ width: `${(tour.durationDays / maxDays) * 100}%` }}
                      className={cn('relative rounded-full', GRADE_BAR[key])}
                    />
                  </span>

                  <span className={cn('shrink-0 text-sm sm:text-right', COL_META)}>
                    <span className="font-medium text-foreground">
                      {messages.toursPage.durationValue(tour.durationDays)}
                    </span>
                    <span aria-hidden="true" className="text-muted-foreground">
                      {' · '}
                    </span>
                    <span className="text-muted-foreground">{gradeLabelOf(key)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        {/* Thước — cùng ba bề rộng cột với hàng dữ liệu nên vạch thẳng hàng với
            đầu thanh. `aria-hidden`: nó là trục của một đồ hoạ, và mỗi chuyến đã
            tự khai số ngày bằng chữ. */}
        <div
          aria-hidden="true"
          className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-5"
        >
          <span
            className={cn(
              'shrink-0 font-mono text-[11px] tracking-widest text-muted-foreground uppercase sm:text-right',
              COL_TITLE,
            )}
          >
            {t.daysAxis}
          </span>
          <span className="flex flex-1">
            {ticks.map((day) => (
              <span
                key={day}
                data-tick={day}
                className="flex-1 border-r border-border/60 pr-1 text-right font-mono text-[10px] text-muted-foreground last:border-r-0 last:pr-0"
              >
                {day}
              </span>
            ))}
          </span>
          <span className={cn('hidden shrink-0 sm:block', COL_META)} />
        </div>

        {/* Chú giải CHỮ cho thang hình dạng — cùng vai trò với `<dl>` tên tháng
            của `region-seasons.tsx`: hình chỉ là lối tắt cho mắt, nghĩa của nó
            phải tồn tại bằng chữ nhìn thấy được. Chỉ liệt kê bậc CÓ MẶT: một
            nhãn "Challenging" đứng cạnh số 0 là hứa một chuyến vùng không bán. */}
        <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-3 text-sm">
          <p className="font-medium text-foreground">{t.gradeAxis}</p>
          <dl data-grade-legend className="flex flex-wrap gap-x-8 gap-y-3">
            {present.map((entry) => (
              <div
                key={entry.key}
                data-legend-grade={entry.key}
                className="flex items-baseline gap-2.5"
              >
                {/* Mẫu phải dùng ĐÚNG class của thanh — lệch một trong hai là
                    chú giải nói dối về thứ đang vẽ. */}
                <span
                  aria-hidden="true"
                  className={cn('w-6 shrink-0 rounded-full', GRADE_BAR[entry.key])}
                />
                <dt className="font-medium text-foreground">{gradeLabelOf(entry.key)}</dt>
                <dd className="text-muted-foreground">
                  {messages.destinationsPage.toursLabel(entry.count)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
