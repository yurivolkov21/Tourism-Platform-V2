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
 * `from-primary/5`, container query `@[250px]/card` cho cỡ chữ, `CardFooter`
 * override `border-t-0` vì Card nova có gạch) — cùng lý do đã ghi ở
 * `DataTableFrame`: ba vùng phải nhìn là MỘT hệ. Từ P4d (ADR-0036 §1) chính
 * component này chạy ở trang `/`; bản demo `section-cards.tsx` đã xoá, đây
 * là nguồn duy nhất của kiểu dáng ấy.
 *
 * Card KHÔNG tính gì. Chiều mũi tên, độ lớn %, hướng tốt/xấu và caption đều do
 * `stats-view.ts` (thuần, có test) nấu sẵn từ HAI con số server trả.
 */

const t = messages.admin.stats;

/** Số card → số cột ở màn rộng. Class phải TĨNH để Tailwind quét thấy. */
const GRID_COLUMNS: Record<number, string> = {
  1: '@5xl/main:grid-cols-1',
  2: '@5xl/main:grid-cols-2',
  3: '@5xl/main:grid-cols-3',
  4: '@5xl/main:grid-cols-4',
};

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
        'grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2',
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

/** Props = VM trừ `key` — `key` là của React, không phải dữ liệu của card. */
export type StatCardProps = Omit<StatCardVM, 'key'>;

export function StatCard({ label, value, caption, delta, deltaGood, callout }: StatCardProps) {
  const tone = deltaGood === undefined ? 'neutral' : deltaGood ? 'good' : 'bad';

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
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
