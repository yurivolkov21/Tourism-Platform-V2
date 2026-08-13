'use client';

import { messages } from '@tourism/i18n';
import { ArrowRightIcon, CalendarXIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import type { TourDetailVM } from '@/lib/api/tours';
import { departureMonths, monthLabel, monthSeason } from '@/lib/tour-detail';
import { departureStatus, formatDate, formatMoney } from '@/lib/tours';

/**
 * Tab 3 — TỔNG QUAN lịch khởi hành, cố ý KHÔNG lặp lại danh sách ngày: đó là
 * việc của modal "All dates", và hai bảng ngày trên cùng một trang là hai nguồn
 * sự thật cho cùng một câu hỏi (spec §4.3).
 *
 * Mọi con số ở đây dẫn xuất từ chính `tour.departures` — không có field tổng hợp
 * nào trong contract, và bịa ra một con số "khoảng 70 chỗ" là nói điều dữ liệu
 * không xác nhận được.
 */
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2.5 font-heading text-2xl leading-[30px] font-medium">{value}</p>
      <p className="mt-1.5 text-xs leading-[16px] text-muted-foreground">{sub}</p>
    </div>
  );
}

/** Khoảng cách 24 (`gap-6`) ở cả hai lưới card dưới đây là số học: bề ngang nội
    dung 1104 chỉ chia CHẴN cho cả 3 lẫn 4 cột khi gap là bội của 12. `gap-4` cho
    ra 357.328px ở bố cục 3 card và phần lẻ .328 làm mọi đường kẻ 1px bên dưới
    lệch nửa pixel — xem chú thích dài ở `overview-panel.tsx`. */

/**
 * Khối = một đợt. Đặc = còn chỗ, `--warning` = ≤3 ghế, rỗng = hết chỗ.
 *
 * Ba lựa chọn token, mỗi cái đo được trên trang thật (canvas readback, so với
 * nền trang ở CẢ hai chế độ):
 *  - `primary-emphasis` chứ không `primary` cho "còn chỗ": primary chỉ đạt
 *    2.9:1 ở chế độ tối, dưới ngưỡng 3:1 của WCAG 1.4.11. emphasis cho 5.55
 *    (sáng) / 7.09 (tối).
 *  - `border` chứ không `muted` cho "hết chỗ": muted chỉ hơn nền 1.2:1 nên hai
 *    mép thanh 6px bị khử răng cưa ăn mòn, mắt đọc thành sợi mảnh (bài học ở
 *    biểu đồ review).
 *  - `warning` cho "≤3 ghế" GIỮ NGUYÊN dù chỉ đạt 1.9:1 ở chế độ sáng: đó là
 *    token dành riêng cho nghĩa này và đang dùng ở booking-accordion/checkout,
 *    đổi ở đây là lệch chuẩn cả app. Thông tin không phụ thuộc mình màu — số
 *    ghế còn in bằng chữ ngay trên cùng hàng.
 */
const BLOCK_TONE: Record<ReturnType<typeof departureStatus>, string> = {
  available: 'bg-primary-emphasis',
  limited: 'bg-warning',
  'sold-out': 'bg-border',
};

export function DeparturesPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail;
  const { openAllDates } = useDepartureSelection();

  const departures = tour.departures;
  const open = departures.filter((d) => d.seatsLeft > 0);
  // "Đợt kế tiếp" = đợt CÒN CHỖ gần nhất, không phải phần tử [0]: đợt đầu có thể
  // đã hết, và trưng một ngày không đặt được là dẫn khách vào ngõ cụt.
  const next = open[0];
  const months = departureMonths(departures);
  const byPrice = [...departures].sort(
    (a, b) => Number(a.effectivePrice) - Number(b.effectivePrice),
  );
  const cheapest = byPrice[0];
  const dearest = byPrice[byPrice.length - 1];
  const seatsTotal = departures.reduce((sum, d) => sum + d.seatsLeft, 0);
  const basePrice = Number(tour.basePrice);

  function priceRange(min: string, max: string): string {
    const from = formatMoney(min, tour.currency);
    const to = formatMoney(max, tour.currency);
    return from === to ? from : `${from}–${to}`;
  }

  if (departures.length === 0) {
    return (
      <div className="flex max-w-3xl items-start gap-3 rounded-xl border border-dashed border-border px-4 py-5">
        <CalendarXIcon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm leading-[20px] font-medium">{t.departuresTab.empty}</p>
          <p className="mt-1 text-sm leading-[20px] text-muted-foreground">
            {t.departuresTab.emptyBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-6">
        {next ? (
          <StatCard
            label={t.departuresTab.nextDeparture}
            value={formatDate(next.startDate)}
            sub={t.departuresTab.nextDepartureSub(next.seatsLeft, tour.maxGroupSize)}
          />
        ) : null}
        <StatCard
          label={t.departuresTab.datesOpen}
          value={t.departuresTab.datesOpenValue(open.length, departures.length)}
          sub={t.departuresTab.datesOpenSub(months.length)}
        />
        {cheapest && dearest ? (
          <StatCard
            label={t.departuresTab.priceRange}
            value={priceRange(cheapest.effectivePrice, dearest.effectivePrice)}
            sub={t.departuresTab.priceRangeSub}
          />
        ) : null}
        <StatCard
          label={t.departuresTab.seatsLeftTotal}
          value={String(seatsTotal)}
          sub={t.departuresTab.seatsLeftSub}
        />
      </div>

      <div className="mt-9 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] leading-[16px] tracking-[0.12em] text-muted-foreground uppercase">
            {t.departuresTab.availabilityByMonth}
          </p>
          <p className="mt-2 text-[13px] leading-[20px] text-muted-foreground">
            {t.departuresTab.blockLegend}
          </p>
        </div>
        <button
          type="button"
          onClick={openAllDates}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-input px-3.5 text-sm leading-[20px] font-medium"
        >
          {t.departuresTab.seeAllDates}
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5">
        {months.map((group) => {
          const season = monthSeason(group.minPrice, group.maxPrice, basePrice);
          return (
            <div
              key={group.month}
              data-testid={`month-${group.month}`}
              className="grid grid-cols-[140px_minmax(0,1fr)_96px_120px] items-center gap-4 border-b border-border py-4 last:border-b-0"
            >
              <div>
                <p className="text-sm leading-[20px] font-medium">{monthLabel(group.month)}</p>
                <p className="mt-0.5 text-xs leading-[16px] text-muted-foreground">
                  {t.departuresTab.monthDepartures(group.items.length)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {group.items.map((d) => (
                  <span
                    key={d.id}
                    data-departure-block
                    className={`h-1.5 flex-1 rounded-full ${BLOCK_TONE[departureStatus(d.seatsLeft)]}`}
                  />
                ))}
              </div>
              <p className="text-[13px] leading-[20px] text-muted-foreground">
                {t.departuresTab.monthSeatsLeft(group.seatsLeft)}
              </p>
              <p className="text-right text-[13px] leading-[20px]">
                {priceRange(String(group.minPrice), String(group.maxPrice))}
                {season ? (
                  <span className="text-muted-foreground">
                    {' '}
                    {season === 'low' ? t.departuresTab.lowSeason : t.departuresTab.peak}
                  </span>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>

      {tour.policies.length > 0 ? (
        <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-6">
          {tour.policies.map((policy) => (
            <PolicyCard key={policy.kind} title={policy.title} body={policy.body} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Thẻ điều khoản: đủ chữ để trả lời tại chỗ, bấm vào thì sang tab đầy đủ.
    Sinh từ `policies[]` chứ không hardcode ba cái — tour có 1–2 policy vẫn cân
    hàng nhờ `auto-fit`. */
function PolicyCard({ title, body }: { title: string; body: string }): ReactNode {
  return (
    <a
      href="#good-to-know"
      className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-input"
    >
      <p className="text-sm leading-[20px] font-medium">{title}</p>
      <p className="mt-1.5 line-clamp-3 text-[13px] leading-[20px] text-muted-foreground">{body}</p>
    </a>
  );
}
