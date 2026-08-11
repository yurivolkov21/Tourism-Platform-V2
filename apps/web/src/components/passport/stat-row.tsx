import { messages } from '@tourism/i18n';
import type { PassportStats } from '@/lib/passport';

/**
 * Hàng 4 chỉ số của hộ chiếu — con số serif lớn, nhãn nhỏ tracking rộng, ngăn
 * bằng kẻ dọc mảnh (không card). Số 0 hiển thị chính danh (hộ chiếu mới còn
 * thơm mùi giấy), KHÔNG giấu — spec M4.
 */
export function StatRow({ stats }: { stats: PassportStats }) {
  const t = messages.passportHome;
  // Caption đánh số nối tiếp data page (gói tu sửa 11/08): Zone I chiếm
  // (1)-(3), danh tính (4)-(5) ở `PassportHeader` — stats là field (6)-(9)
  // của cùng cuốn sổ. Đổi số ở đây thì đổi cả bên header cho khớp.
  const CELLS = [
    { n: 6, value: String(stats.trips), label: t.statTrips },
    { n: 7, value: String(stats.places), label: t.statPlaces },
    { n: 8, value: `${stats.exploredPct}%`, label: t.statExplored },
    { n: 9, value: String(stats.daysOnRoad), label: t.statDays },
  ];
  return (
    <dl className="grid grid-cols-2 border-b border-border/55 md:grid-cols-4">
      {CELLS.map((c) => (
        <div
          key={c.label}
          className="border-r border-border/55 px-5 py-5 last:border-r-0 md:px-6 [&:nth-child(2)]:border-r-0 md:[&:nth-child(2)]:border-r"
        >
          {/* dl hợp lệ (fix 11/08): DOM phải là dt TRƯỚC dd — đảo LẠI thứ tự
              hiển thị (số lớn trên, nhãn dưới) bằng `flex-col-reverse`, không
              đổi thứ tự DOM/tab. */}
          <div className="flex flex-col-reverse">
            <dt className="mt-0.5 text-[11.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              ({c.n}) {c.label}
            </dt>
            <dd className="font-heading text-3xl font-semibold tabular-nums">{c.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
