'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronDownIcon, CreditCardIcon, RotateCcwIcon, UsersIcon } from 'lucide-react';
import { type CSSProperties, useId, useState } from 'react';
import { RevealItem } from '@/components/motion/reveal-item';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import { FactCard } from '@/components/tours/fact-card';
import { PANEL_BTN_SM } from '@/components/tours/panel-button';
import type { DepartureVM, TourDetailVM } from '@/lib/api/tours';
import { STAGGER } from '@/lib/motion';
import {
  DEPARTURE_ROWS_PER_MONTH,
  defaultOpenMonth,
  departureMonths,
  monthDateSpan,
  monthLabel,
  monthNotice,
  monthSeason,
  orderPolicies,
} from '@/lib/tour-detail';
import { departureStatus, formatChipDate, formatDialogDate, formatMoney } from '@/lib/tours';

/**
 * Thanh ghế chia đốt — MỘT ĐỐT LÀ MỘT GHẾ, và luôn đúng `maxGroupSize` đốt.
 *
 * Port từ ReUI `stats-13` (đo tận DOM: 12×16px, gap 4, bo 6, viền 1px). Hai
 * chỗ cố tình khác bản gốc:
 *
 * 1. **Số đốt cố định theo sức chứa**, không phải 30 đốt co giãn. Bản gốc để
 *    `flex grow` nên 30 đốt bị bóp còn 9.67px và bề rộng mỗi đốt vô nghĩa. Ở
 *    đây đếm được: 10 đốt = 10 ghế, khớp đúng con số in ngay bên dưới.
 * 2. **Đảo cực**: tô đầy = ghế CÒN cho khách, không phải ghế đã bán. `stats-13`
 *    là card quản trị ("67% assigned") nên tô đầy = đã dùng hết; bê nguyên cực
 *    đó ra trang bán hàng thì đợt chưa ai đặt hiện thanh trắng trơn, đọc ra như
 *    tour ế hoặc như widget hỏng. Đảo lại thì đầy = "thoải mái chỗ", vơi + vàng
 *    = "sắp hết", xám hết = "không còn gì cho bạn". Đúng cảm xúc ở cả hai đầu.
 */
function SeatMeter({ seatsLeft, capacity }: { seatsLeft: number; capacity: number }) {
  const tone = departureStatus(seatsLeft);
  return (
    // `flex` (không `inline-flex`): container ôm đúng bề rộng ô, đốt là flex
    // item nên khi cột hẹp hơn 16×capacity thì chúng CO ĐỀU thay vì thanh tràn
    // sang cột Status (bug user báo 19/08 với tour 16 chỗ; dữ liệu có tới 22).
    // Bình thường cột đã rộng đúng theo `capacity` (xem <colgroup>) nên đốt
    // giữ nguyên 12px — co chỉ là lưới an toàn ở viewport hẹp. `min-w-1` chặn
    // co về 0.
    <span aria-hidden="true" className="flex gap-1">
      {Array.from({ length: capacity }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: dãy ghế tĩnh đúng `capacity` đốt, vị trí LÀ danh tính — không reorder, không chèn giữa
          key={i}
          className={cn(
            'block h-4 w-3 min-w-1 rounded-[6px] border',
            i < seatsLeft
              ? tone === 'limited'
                ? 'border-warning bg-warning'
                : 'border-primary bg-primary'
              : 'border-muted bg-muted',
          )}
        />
      ))}
    </span>
  );
}

/**
 * Bề rộng cột ghế theo sức chứa: 16·n (đốt 12 + khe 4) + 32 (pr-3 12px + 20px
 * thở trước cột Status — user 19/08: sát quá; cột Month/Date đang dư nên nhường).
 * Kẹp trần 400 (~23 chỗ đủ cỡ đốt): contract chỉ ép `positive()`, admin có thể
 * đặt 40 chỗ, không kẹp thì cột ghế nuốt hết cột ngày — quá trần thì đốt tự co
 * đều trong `SeatMeter`, vẫn giữ "một đốt = một ghế".
 */
export function seatsColumnWidth(capacity: number): number {
  return Math.min(capacity * 16 + 32, 400);
}

const BADGE_BASE =
  'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-[9px] text-[11px] leading-none font-medium';

/** Bốn mức ghế trên hàng đợt. Ngưỡng đi qua `departureStatus` để bảng, ô ngày
    và modal dùng chung đúng một con số. */
function SeatBadge({ seatsLeft, capacity }: { seatsLeft: number; capacity: number }) {
  const t = messages.tourDetail.departuresTab;
  if (seatsLeft <= 0) {
    return (
      <span className={cn(BADGE_BASE, 'border-border bg-muted text-muted-foreground')}>
        {t.statusSoldOut}
      </span>
    );
  }
  if (departureStatus(seatsLeft) === 'limited') {
    return (
      <span className={cn(BADGE_BASE, 'border-warning/60 bg-warning/20 text-accent-foreground')}>
        {t.statusAlmostFull}
      </span>
    );
  }
  // "Filling up" ở nửa dưới sức chứa: nó là mức DUY NHẤT nói được "còn chỗ
  // nhưng đừng thong thả", mà `departureStatus` không phân biệt vì ba mức của
  // nó phục vụ chấm màu chứ không phục vụ chữ.
  if (seatsLeft * 2 <= capacity) {
    return (
      <span className={cn(BADGE_BASE, 'border-input text-foreground')}>{t.statusFilling}</span>
    );
  }
  return (
    <span className={cn(BADGE_BASE, 'border-success/50 bg-success/15 text-success')}>
      {t.statusOpen}
    </span>
  );
}

/** Huy hiệu cấp tháng — im lặng khi `monthNotice` trả null (xem lý do ở đó). */
function MonthBadge({ items }: { items: readonly DepartureVM[] }) {
  const t = messages.tourDetail.departuresTab;
  const notice = monthNotice(items);
  if (!notice) return null;
  if (notice.kind === 'sold-out') {
    return (
      <span className={cn(BADGE_BASE, 'border-border bg-muted text-muted-foreground')}>
        {t.statusSoldOut}
      </span>
    );
  }
  return (
    <span className={cn(BADGE_BASE, 'border-warning/60 bg-warning/20 text-accent-foreground')}>
      {notice.kind === 'some-sold-out' ? t.noticeSomeSoldOut(notice.count) : t.statusAlmostFull}
    </span>
  );
}

/**
 * Tab 3 — bảng đợt khởi hành, nhóm theo tháng, mũi xổ ở cột đầu.
 *
 * ⚠️ CỐ Ý KHÁC BẢN WIREFRAME ĐÃ DUYỆT — đây là chỗ duy nhất trong đợt trùng tu
 * 13/08 không dựng y bản duyệt, và lý do là kết quả thử người dùng: bản duyệt vẽ
 * mỗi tháng thành một dải khối ngang (`.mseats i { flex:1 }`), nhóm của user thử
 * mà KHÔNG đọc ra khối đó là gì. Nguyên nhân đo được: mỗi khối đáng lẽ là một
 * đợt nhưng `flex:1` khiến nó giãn kín cột, mà dữ liệu thật là 1–2 đợt/tháng nên
 * hầu hết dòng ra MỘT thanh đặc kín — trông hệt thanh tiến độ 100%. Nó hỏng ở cả
 * hai đầu: 1 đợt ra thanh đầy, 30 đợt ra 30 lát 21px không đọc nổi.
 *
 * Luật thay thế: **mọi thứ trên dòng cha phải có chi phí O(1)**, không được dài
 * ra theo số đợt. Nên dòng tháng chỉ chứa số tổng hợp; thanh ghế tụt xuống dòng
 * đợt, nơi nó luôn đúng `maxGroupSize` đốt. Danh sách xổ chặn ở
 * `DEPARTURE_ROWS_PER_MONTH`, phần dư nhường cho modal "All dates".
 *
 * Bảng là `<table>` THẬT (không phải grid div): đây là dữ liệu dạng bảng —
 * ngày, ghế, giá theo hàng — nên thẻ semantic cho trình đọc màn hình đúng cấu
 * trúc miễn phí. Mỗi tháng một `<tbody>`, hàng đợt nằm cùng `<tbody>` đó; đây
 * đúng cơ chế hàng expand của Data Grid, chỉ là không kéo `@tanstack/react-table`
 * vào cho 4–6 dòng trên một trang SSG.
 */
export function DeparturesPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.departuresTab;
  const { departures, selectedId, select, openAllDates } = useDepartureSelection();
  const months = departureMonths(departures);
  const basePrice = Number(tour.basePrice);
  const capacity = tour.maxGroupSize;

  // Lưu ĐÈ của người dùng, không lưu "danh sách tháng đang mở": tháng tự mở
  // theo đợt đang chọn mà không có chỗ ghi "đã bị đóng tay" thì bấm đóng không
  // ăn — nó rơi lại về mặc định ngay ở lần render kế. Cùng bẫy đã dính ở
  // `ItineraryPanel`.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const autoOpen = defaultOpenMonth(months, selectedId);
  const tableId = useId();

  if (departures.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-14 text-center">
        <p className="font-medium text-foreground">{t.empty}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.emptyBody}</p>
      </div>
    );
  }

  const openTotal = departures.filter((d) => d.seatsLeft > 0).length;
  const seatsTotal = departures.reduce((sum, d) => sum + d.seatsLeft, 0);
  const next = departures.find((d) => d.seatsLeft > 0) ?? departures[0];
  const prices = departures.map((d) => Number(d.effectivePrice));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);

  return (
    <div>
      {/* Bốn ô thống kê — mọi con số DẪN XUẤT từ chính mảng departures, không
          có chữ nào bịa thêm. Giữ nguyên `.dep-stats` của wireframe: 4 cột đều,
          gap 16 → ở bề ngang 1056 ra 252px mỗi ô. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          label={t.nextDeparture}
          // `formatChipDate` ("20 Aug") chứ không phải `formatDialogDate`
          // ("Thu, 20 Aug"): ô thống kê là con số liếc qua, mà thứ trong tuần
          // đã có đủ ở hàng đợt ngay dưới — in hai lần chỉ làm ô nặng thêm.
          value={next ? formatChipDate(next.startDate) : '—'}
          sub={next ? t.nextDepartureSub(next.seatsLeft, capacity) : ''}
        />
        <StatCard
          index={1}
          label={t.datesOpen}
          value={t.datesOpenValue(openTotal, departures.length)}
          sub={t.datesOpenSub(months.length)}
        />
        <StatCard
          index={2}
          label={t.priceRange}
          value={
            lo === hi
              ? formatMoney(String(lo), tour.currency)
              : `${formatMoney(String(lo), tour.currency)}–${formatMoney(String(hi), tour.currency)}`
          }
          sub={t.priceRangeSub}
        />
        <StatCard
          index={3}
          label={t.seatsLeftTotal}
          value={String(seatsTotal)}
          sub={t.seatsLeftSub}
        />
      </div>

      <div className="mt-7 mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] leading-4 tracking-[0.12em] text-muted-foreground uppercase">
            {t.availabilityByMonth}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t.openMonthHint}</p>
        </div>
        <Button type="button" variant="outline" className={PANEL_BTN_SM} onClick={openAllDates}>
          {t.seeAllDates} →
        </Button>
      </div>

      {/* `overflow-hidden` là BẮT BUỘC chứ không phải làm đẹp: nền hàng và vệt
          hover là hình chữ nhật đặc, không cắt theo bán kính thì bốn góc khung
          lòi ra bốn mẩu vuông — đúng lỗi "hai cái tai" đã dính ở modal All dates. */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full table-fixed border-collapse [--row-pad:20px]">
          {/* Phần dư dồn vào cột NGÀY vì đó là ô dài nhất ("Thu, 20 Aug →
              Sun, 23 Aug"); các cột còn lại ghim cứng. Để phần dư ở cột ghế
              (bản trước) thì thanh 10 đốt trôi lạc giữa 406px trống.

              Cột GHẾ rộng THEO SỨC CHỨA (sửa 19/08): bản 200px cứng chỉ chứa
              được 11 đốt (16×n−4 + pr-3), tour 16 chỗ tràn sang cột Status,
              22 chỗ tràn tới cột Price. Bề rộng theo `seatsColumnWidth` ở xl+;
              dưới xl kẹp 30% bảng (bằng ~200px cũ ở 820) và đốt tự co đều (xem
              `SeatMeter`). Cột Status 124 → 112: huy hiệu dài nhất "Almost
              full" ~90px, phần dư trả cho cột ngày. */}
          <colgroup>
            <col className="w-10" />
            <col />
            {/* Bề rộng cột ghế đặt trên <th> (bên dưới) qua biến CSS, không phải
                <col>: với `table-fixed`, ô hàng đầu quyết bề rộng cột, và
                Chromium coi `min(px, %)` trên ô bảng là `auto` (đo: 327px thay
                vì 264) — chỉ px trần, % trần hoặc var() được tôn trọng. */}
            <col />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-[120px]" />
          </colgroup>
          <thead>
            <tr className="[&>th:first-child]:pl-(--row-pad) [&>th:last-child]:pr-(--row-pad) [&>th]:border-b [&>th]:border-border [&>th]:bg-muted/45 [&>th]:py-3 [&>th]:pr-3 [&>th]:text-left [&>th]:font-mono [&>th]:text-[10px] [&>th]:leading-4 [&>th]:font-normal [&>th]:tracking-[0.12em] [&>th]:text-muted-foreground [&>th]:uppercase">
              <th />
              <th>{t.colMonthDate}</th>
              <th
                style={{ '--seats-w': `${seatsColumnWidth(capacity)}px` } as CSSProperties}
                className="w-(--seats-w) max-xl:w-[30%]"
              >
                {t.colSeats}
              </th>
              <th>{t.colStatus}</th>
              <th className="text-right!">{t.colPrice}</th>
              <th />
            </tr>
          </thead>

          {months.map((group) => {
            const open = overrides[group.month] ?? group.month === autoOpen;
            const label = monthLabel(group.month);
            const season = monthSeason(group.minPrice, group.maxPrice, basePrice);
            const shown = group.items.slice(0, DEPARTURE_ROWS_PER_MONTH);

            return (
              <tbody
                key={group.month}
                id={`${tableId}-${group.month}`}
                className="border-t border-border first:border-t-0"
              >
                {/* Cả hàng bấm được, nhưng `aria-expanded` nằm trên <button>
                    thật trong ô đầu — bấm nút nổi bọt lên hàng nên chỉ có MỘT
                    handler, mà bàn phím vẫn tới được. */}
                <tr
                  onClick={() => setOverrides((prev) => ({ ...prev, [group.month]: !open }))}
                  className="cursor-pointer [&>td:first-child]:pl-(--row-pad) [&>td:last-child]:pr-(--row-pad) [&>td]:py-3.5 [&>td]:pr-3 [&>td]:align-middle hover:[&>td]:bg-muted/40"
                >
                  <td className="text-muted-foreground">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`${tableId}-${group.month}`}
                      className="block cursor-pointer"
                    >
                      <ChevronDownIcon
                        aria-hidden="true"
                        className={cn('size-4 transition-transform', open && 'rotate-180')}
                      />
                      <span className="sr-only">{t.toggleMonth(label)}</span>
                    </button>
                  </td>
                  <td>
                    <span className="block text-sm leading-5 font-medium text-foreground">
                      {label}
                    </span>
                    <span className="block text-xs leading-4 text-muted-foreground tabular-nums">
                      {t.monthMeta(
                        t.monthDepartures(group.items.length),
                        monthDateSpan(group.items),
                      )}
                    </span>
                  </td>
                  <td className="text-[13px] text-muted-foreground tabular-nums">
                    {t.monthSeatsOf(group.seatsLeft, group.items.length * capacity)}
                  </td>
                  <td>
                    <MonthBadge items={group.items} />
                  </td>
                  <td className="text-right text-sm leading-5 font-medium tabular-nums">
                    {group.minPrice === group.maxPrice
                      ? formatMoney(String(group.minPrice), tour.currency)
                      : `${formatMoney(String(group.minPrice), tour.currency)}–${formatMoney(String(group.maxPrice), tour.currency)}`}
                    {season ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {season === 'low' ? t.lowSeason : t.peak}
                      </span>
                    ) : null}
                  </td>
                  <td />
                </tr>

                {/* Hàng con render SẴN rồi ẩn bằng CSS, không render có điều
                    kiện: cùng luật với năm panel của `TourTabs` (ADR-0022) — ngày
                    khởi hành nằm trong HTML tĩnh cho crawler, và xổ ra không tốn
                    một vòng render nào. `hidden` cũng cắt luôn tab order. */}
                {shown.map((departure, rowIndex) => (
                  <DepartureRow
                    key={departure.id}
                    rowIndex={rowIndex}
                    departure={departure}
                    capacity={capacity}
                    currency={tour.currency}
                    durationDays={tour.durationDays}
                    selected={departure.id === selectedId}
                    hidden={!open}
                    onSelect={() => select(departure.id)}
                  />
                ))}

                {group.items.length > shown.length ? (
                  <tr hidden={!open} className="bg-muted/25">
                    <td />
                    <td colSpan={5} className="pt-2 pb-3.5">
                      <button
                        type="button"
                        onClick={openAllDates}
                        className="cursor-pointer text-[13px] leading-5 font-medium text-primary-emphasis hover:underline"
                      >
                        {t.seeAllMonthDates(group.items.length, label.split(' ')[0] ?? label)} →
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            );
          })}
        </table>
      </div>

      <BookingPolicyCards tour={tour} />
    </div>
  );
}

/**
 * Ba thẻ chính sách cuối tab — bản duyệt có (`fcard ×3`), bản ship 13/08 BỎ SÓT.
 * Bộ so R9 không bắt được vì nó chỉ đối chiếu phần tử có mặt ở CẢ HAI bên; phần
 * tử app thiếu hẳn thì không có gì để so nên nó im lặng. Phép ĐẾM KHỐI theo pane
 * mới là thứ tìm ra.
 *
 * Cùng dữ liệu với tab Good to know, đóng khung lại cho khoảnh khắc chọn ngày:
 * lúc đang cân nhắc một đợt, câu hỏi là "đặt cọc bao nhiêu, huỷ được tới khi
 * nào", không phải "mặc gì trên xe". Nên nhãn thẻ nói VAI TRÒ chứ không lặp tên
 * nhóm policy, và thẻ giữa có link sang tab Good to know cho toàn văn.
 *
 * Thẻ thứ ba KHÔNG lấy từ `policies` — nó nói về sức chứa, nên giá trị suy từ
 * `maxGroupSize` và câu mô tả dùng lại `factGroupSizeNote` (ADR-0023), vốn viết
 * đúng về chuyện đó.
 */
function BookingPolicyCards({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.departuresTab;
  const byKind = Object.fromEntries(orderPolicies(tour.policies).map((p) => [p.kind, p]));
  const booking = byKind.BOOKING;
  const cancellation = byKind.CANCELLATION;

  // Không có policy nào thì bỏ hẳn hàng thẻ — một hàng thẻ rỗng tệ hơn không có.
  if (!booking && !cancellation) return null;

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {booking ? (
        <FactCard
          icon={<CreditCardIcon aria-hidden="true" />}
          label={t.cardSecuring}
          value={booking.title}
          note={booking.body}
        />
      ) : null}
      {cancellation ? (
        <FactCard
          icon={<RotateCcwIcon aria-hidden="true" />}
          label={t.cardChanging}
          // Con số thắng khi có: "Free until 10 days out" đọc nhanh hơn một câu.
          // Tour tính cửa sổ bằng GIỜ để `null` → rơi về tiêu đề policy.
          value={
            tour.freeCancellationDays === null
              ? cancellation.title
              : t.freeUntil(tour.freeCancellationDays)
          }
          note={cancellation.body}
          link={{ href: '#good-to-know', label: t.readFullPolicy }}
        />
      ) : null}
      <FactCard
        icon={<UsersIcon aria-hidden="true" />}
        label={t.cardGroup}
        value={t.groupCap(tour.maxGroupSize)}
        note={tour.factGroupSizeNote}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  index = 0,
}: {
  label: string;
  value: string;
  sub: string;
  /** Vị trí trong hàng 4 thẻ — quyết nhịp bậc thang (nhóm motion 1, 19/08). */
  index?: number;
}) {
  return (
    <RevealItem
      enter="rise"
      delay={index * STAGGER.grid}
      className="rounded-md border border-border bg-card p-4"
    >
      <p className="font-mono text-[10px] leading-4 tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-heading text-[22px] leading-7 font-medium text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{sub}</p>
    </RevealItem>
  );
}

/**
 * Một hàng đợt. Nền chìm hơn hàng tháng một tầng (`bg-muted/25`) — không phải
 * trang trí: khi xổ sáu dòng ra, cha và con chỉ khác nhau một sợi kẻ tóc thì
 * mắt đọc thành một khối phẳng và ranh giới nhóm biến mất.
 */
function DepartureRow({
  departure,
  capacity,
  currency,
  durationDays,
  selected,
  hidden,
  rowIndex = 0,
  onSelect,
}: {
  departure: DepartureVM;
  capacity: number;
  currency: string;
  durationDays: number;
  selected: boolean;
  hidden: boolean;
  /** Thứ tự trong tháng — bậc thang `--card-index` khi tháng xổ ra (nhóm motion 1). */
  rowIndex?: number;
  onSelect: () => void;
}) {
  const t = messages.tourDetail.departuresTab;
  const soldOut = departure.seatsLeft <= 0;
  const saving =
    departure.compareAtPrice !== null
      ? Number(departure.compareAtPrice) - Number(departure.effectivePrice)
      : 0;

  return (
    <tr
      hidden={hidden}
      data-selected={selected || undefined}
      // `animate-tour-card-in` khởi động lại mỗi lần `hidden` tắt (display:none →
      // table-row) — hàng đợt "vào" bậc thang khi mở tháng; `backwards` giữ hàng
      // vô hình cho tới lượt mình (nhóm motion 1, 19/08).
      style={{ '--card-index': rowIndex } as CSSProperties}
      className={cn(
        'animate-tour-card-in bg-muted/25 data-selected:bg-primary/10 [&>td:first-child]:pl-(--row-pad) [&>td:last-child]:pr-(--row-pad) [&>td]:border-t [&>td]:border-border/55 [&>td]:py-2.5 [&>td]:pr-3 [&>td]:align-middle',
        !selected && 'hover:bg-muted/45',
      )}
    >
      <td />
      <td>
        <span
          className={cn(
            'block text-sm leading-5 font-medium tabular-nums',
            soldOut ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {formatDialogDate(departure.startDate)} <span className="text-muted-foreground">→</span>{' '}
          {formatDialogDate(departure.endDate)}
        </span>
        <span className="block text-xs leading-4 text-muted-foreground">
          {t.departureMeta(durationDays)}
        </span>
      </td>
      <td>
        <SeatMeter seatsLeft={departure.seatsLeft} capacity={capacity} />
        <span className="mt-1.5 block text-xs leading-4 text-muted-foreground tabular-nums">
          {soldOut ? t.noSeatsLeft : t.seatsOfCapacity(departure.seatsLeft, capacity)}
        </span>
      </td>
      <td>
        <SeatBadge seatsLeft={departure.seatsLeft} capacity={capacity} />
      </td>
      <td className="text-right tabular-nums">
        <span className="text-sm leading-5 font-medium text-foreground">
          {formatMoney(departure.effectivePrice, currency)}
        </span>
        {departure.compareAtPrice !== null ? (
          <s className="ml-1.5 text-xs text-price-compare">
            {formatMoney(departure.compareAtPrice, currency)}
          </s>
        ) : null}
        {saving > 0 ? (
          <span className="block text-[11px] leading-4 font-medium text-success">
            {t.save(formatMoney(String(saving), currency))}
          </span>
        ) : null}
      </td>
      <td className="text-right">
        <Button
          type="button"
          className={PANEL_BTN_SM}
          variant={selected ? 'outline' : 'default'}
          disabled={soldOut}
          onClick={onSelect}
        >
          {soldOut ? t.statusSoldOut : selected ? t.selected : t.select}
        </Button>
      </td>
    </tr>
  );
}
