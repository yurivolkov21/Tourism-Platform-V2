import { messages } from '@tourism/i18n';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';

const t = messages.admin.dashboard;

/**
 * 4 card số liệu — vòng gọt bước 4 (21/08): GIỮ nguyên kiểu dashboard-01
 * (gradient from-primary/5, grid container query, CardFooter override
 * border-t-0 vì Card nova có gạch — user chấm 20/08), số demo DỌN SẠCH theo
 * lệnh user. Label theo 4 metric THẬT sẽ nối ở P4d (map từ admin-stats
 * Nexora cũ: doanh thu PAID · bookings PAID · reviews chờ duyệt · enquiries
 * NEW); giá trị "—" + chú thích chờ — KHÔNG bịa số, badge trend demo bỏ.
 */
const CARDS = [
  t.cards.revenue,
  t.cards.paidBookings,
  t.cards.pendingReviews,
  t.cards.newEnquiries,
] as const;

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {CARDS.map((label) => (
        <Card key={label} className="@container/card">
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              —
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 border-t-0 bg-transparent text-sm">
            <div className="text-muted-foreground">{t.awaiting}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
