import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { cn } from '@tourism/ui/lib/utils';
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import type { StatCardVM } from '@/lib/stats-view';

/**
 * Stat card của kit admin (spec P4b §3-F5 — mẫu user chốt 31/08: nhãn · số
 * lớn · pill delta ↑/↓ · caption "vs X prior 28 days").
 *
 * Kiểu dáng bê nguyên khối `section-cards` của block dashboard-01 (gradient
 * `from-primary/5`, `CardFooter` override `border-t-0` vì Card nova có gạch) —
 * cùng lý do đã ghi ở `DataTableFrame`: ba vùng phải nhìn là MỘT hệ. Riêng phần
 * đầu thẻ (nhãn · số · pill) bố cục theo nội dung thay cho các ngưỡng bề rộng
 * của block — xem `HEADER_LAYOUT` và `VALUE_TEXT`. Từ P4d (ADR-0036 §1) chính
 * component này chạy ở trang `/`; bản demo `section-cards.tsx` đã xoá, đây
 * là nguồn duy nhất của kiểu dáng ấy.
 *
 * Card KHÔNG tính gì. Chiều mũi tên, độ lớn %, hướng tốt/xấu và caption đều do
 * `stats-view.ts` (thuần, có test) nấu sẵn từ HAI con số server trả.
 */

const t = messages.admin.stats;

/** Số card → số cột ở màn rộng (khung `main` từ 64rem). Class phải TĨNH để Tailwind quét thấy. */
const GRID_COLUMNS: Record<number, string> = {
  1: '@5xl/main:grid-cols-1',
  2: '@5xl/main:grid-cols-2',
  3: '@5xl/main:grid-cols-3',
  4: '@5xl/main:grid-cols-4',
};

/**
 * Số cột DƯỚI `@5xl/main` theo số card (review A2-5). Class phải TĨNH để Tailwind quét thấy.
 *
 * - 4 card (Dashboard, Bookings, Reviews, Reports): 2 cột từ màn hẹp nhất — bốn card xếp dọc
 *   từng chiếm hết màn đầu tiên trên điện thoại (spec 2026-10-05 §4 #12).
 * - 1 card: 1 cột — nửa bề rộng trơ trọi.
 * - Số card khác (hàng 3 card của Outbox, Payment events, Enquiries, Subscribers): như trước đợt
 *   sửa sạn — 1 cột trên điện thoại, 2 cột từ `@xl/main`. Lưới 2 cột từ màn hẹp nhất từng để
 *   card thứ ba mồ côi ở 375px.
 */
function narrowGridColumns(count: number): string {
  if (count === 4) return 'grid-cols-2';
  if (count === 1) return 'grid-cols-1';
  return 'grid-cols-1 @xl/main:grid-cols-2';
}

/**
 * Hàng card đứng TRÊN bảng của một trang vùng. `<section>` có tên (không phải
 * div trần): trang có hai khối số liệu (hàng card + bảng) nên trình đọc màn
 * hình cần nhảy giữa chúng được.
 */
export function StatCardRow({
  cards,
  period,
}: {
  cards: StatCardVM[];
  /**
   * Khoảng ngày mà CẢ hàng card tính trên đó ("Showing Sep 1 – Sep 30, 2026")
   * — chỉ có khi kỳ do admin chọn (ADR-0028). Đứng ở đây thay vì lặp trong
   * bốn caption: một khoảng thì nói một lần.
   *
   * `undefined` với cửa sổ TRƯỢT, và với sáu vùng chưa có bộ lọc ngày — lúc
   * đó không render node nào, bố cục giữ nguyên như trước.
   */
  period?: string;
}) {
  const grid = (
    <div
      className={cn(
        'grid gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs',
        narrowGridColumns(cards.length),
        GRID_COLUMNS[cards.length] ?? GRID_COLUMNS[4],
        'dark:*:data-[slot=card]:bg-card',
      )}
    >
      {cards.map(({ key, ...card }) => (
        <StatCard key={key} {...card} />
      ))}
    </div>
  );

  // Không có khoảng: section chỉ bọc lưới, không có dòng kỳ — bốn vùng không
  // lọc ngày nhìn y như trước khi có `period` (lưới nằm trong `div` riêng ở
  // cả hai nhánh, section không còn là lưới).
  return period ? (
    <section aria-label={t.regionLabel} className="grid gap-2 px-4 lg:px-6">
      <p data-testid="stat-period" className="text-sm text-muted-foreground">
        {period}
      </p>
      {grid}
    </section>
  ) : (
    <section aria-label={t.regionLabel} className="px-4 lg:px-6">
      {grid}
    </section>
  );
}

/** Tông màu của pill — hệ quả của `deltaGood`, không phải một prop thứ ba. */
const TONE_CLASS = {
  good: 'text-success',
  bad: 'text-destructive-emphasis',
  neutral: 'text-muted-foreground',
} as const;

/**
 * Phần đầu thẻ bố cục THEO NỘI DUNG (review AL3): một hàng `flex-wrap` gồm hai mục — khối nhãn +
 * con số, và pill. Đủ chỗ thì pill đứng góc phải ngang hàng nhãn (chỗ của `CardAction` trong
 * block dashboard-01); hết chỗ thì tự xuống dòng dưới con số, căn trái. Các lớp đặt chỗ theo
 * lưới của `CardAction` không còn tác dụng trong hàng flex.
 *
 * Thay cho ngưỡng `@[220px]/card` cũ — ngưỡng ấy hiệu chỉnh theo MỘT mẫu ("$40,849.38" kèm
 * "13.5%" cần thẻ 216,8px): doanh thu 6 chữ số bị cắt 11–16px, 7 chữ số 44px (mất chữ %), pill
 * "1942.5%"/"20324.7%" cắt 10–28px. Badge `whitespace-nowrap` và Card `overflow-hidden` nên phần
 * bị cắt không ai thấy, trang cũng không tràn.
 */
const HEADER_LAYOUT = 'flex flex-wrap items-start justify-between';

/**
 * Cỡ chữ con số co giãn theo bề ngang PHẦN ĐẦU THẺ (`100cqi` = khung `@container/card-header`
 * của `CardHeader`, tức bề ngang thẻ trừ lề trong) — không theo bậc ngưỡng px:
 * - `100cqi/8.5`, trần 30px (`text-3xl` cũ): thẻ cỡ trung (4 card một hàng ở màn 1320–1440px,
 *   thẻ 232–262px) giữ chỗ cho pill đứng cạnh "$40,849.38".
 * - Sàn `min(20px, 100cqi/7.2)`: thẻ hẹp (điện thoại, pill đã xuống dòng) được chữ to hơn
 *   công thức trên — tới 20px như `text-xl` cũ — nhưng không bao giờ vượt bề ngang: chuỗi 14 ký
 *   tự ("-$1,234,567.89") vừa khít ở thẻ 150px.
 * - `wrap-anywhere` là lưới cuối: con số dài hơn nữa xuống dòng chứ không bị Card cắt, không
 *   thành "…" (đo Edge: "$12,345,678.90" ở thẻ 150–179px thành hai dòng).
 * - `leading-tight` khai tường minh: cỡ chữ tuỳ biến không mang sẵn line-height như `text-*`.
 */
const VALUE_TEXT =
  'text-[length:clamp(min(1.25rem,100cqi/7.2),100cqi/8.5,1.875rem)] leading-tight font-semibold tabular-nums wrap-anywhere';

/** Props = VM trừ `key` — `key` là của React, không phải dữ liệu của card. */
export type StatCardProps = Omit<StatCardVM, 'key'>;

export function StatCard({ label, value, caption, delta, deltaGood, callout }: StatCardProps) {
  const tone = deltaGood === undefined ? 'neutral' : deltaGood ? 'good' : 'bad';

  return (
    <Card>
      <CardHeader className={HEADER_LAYOUT}>
        {/* `min-w-0`: khối được co theo bề ngang thẻ — nhãn dài xuống dòng trong khối. */}
        <div className="grid min-w-0 gap-1">
          <CardDescription>{label}</CardDescription>
          <CardTitle className={VALUE_TEXT}>{value}</CardTitle>
        </div>
        {delta ? (
          <CardAction>
            <Badge
              variant="outline"
              // `data-*` là nguồn: test soi chiều/tông ở đây, CSS chỉ ăn theo.
              data-testid="stat-delta"
              data-trend={delta.direction}
              data-tone={tone}
              className={TONE_CLASS[tone]}
            >
              {/* Đứng yên thì không có mũi tên nào đúng — chỉ còn con số. */}
              {delta.direction === 'up' ? <TrendingUpIcon aria-hidden="true" /> : null}
              {delta.direction === 'down' ? <TrendingDownIcon aria-hidden="true" /> : null}
              {/* Độ lớn + câu sr-only nói CÙNG một chuyện; để cả hai lộ ra
                  thì trình đọc màn hình đọc hai lần. Mắt lấy con số, tai lấy
                  câu. */}
              <span aria-hidden="true">{delta.amount}</span>
              <span className="sr-only">{delta.srLabel}</span>
            </Badge>
          </CardAction>
        ) : callout ? (
          <CardAction>
            {/* Pill TRẠNG THÁI cho card ảnh chụp (không có kỳ trước) — khác
                pill delta: không mũi tên, không "vs …", `data-testid` riêng
                để không ai đọc nhầm nó thành "xu hướng đứng yên" (vòng vá
                review F7: card Failed từng mượn `delta.direction='flat'`). */}
            <Badge
              variant="outline"
              data-testid="stat-callout"
              data-tone={callout.tone}
              className={TONE_CLASS[callout.tone]}
            >
              <span aria-hidden="true">{callout.label}</span>
              <span className="sr-only">{callout.srLabel ?? callout.label}</span>
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 border-t-0 bg-transparent text-sm">
        <div className="text-muted-foreground">{caption}</div>
      </CardFooter>
    </Card>
  );
}
