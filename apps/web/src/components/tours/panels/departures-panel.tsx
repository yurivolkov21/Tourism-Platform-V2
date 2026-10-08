'use client';

import { windowDaysForTripLength } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
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
} from '@/lib/tour-detail';
import {
  departureStatus,
  formatChipDate,
  formatDialogDate,
  formatMoney,
  isDepartureOpen,
} from '@/lib/tours';

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

/**
 * Nối cứng một cụm ngày ("13 Aug", "20–28 Aug") để thẻ hẹp xuống dòng TRƯỚC cả
 * cụm thay vì chẻ ngày khỏi tháng: khoảng trắng → NBSP, và chèn WORD JOINER
 * (U+2060) sau gạch "–", vì gạch nối khoảng là chỗ trình duyệt được phép ngắt
 * (ra "20–" / "28 Aug"). Không sửa thẳng `formatChipDate` hay `monthDateSpan`:
 * hai hàm ấy còn nuôi chỗ khác chưa ai đo, còn ở đây đã đo thấy chẻ ở 375px.
 */
function keepDateTogether(text: string): string {
  return text.replaceAll(' ', '\u00A0').replaceAll('–', '–\u2060');
}

const BADGE_BASE =
  'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-[9px] text-[11px] leading-none font-medium';

/** Bốn mức ghế trên hàng đợt. Ngưỡng đi qua `departureStatus` để bảng, ô ngày
    và modal dùng chung đúng một con số. */
function SeatBadge({
  seatsLeft,
  capacity,
  bookable,
}: {
  seatsLeft: number;
  capacity: number;
  bookable: boolean;
}) {
  const t = messages.tourDetail.departuresTab;
  // Hạn đặt xét TRƯỚC ghế: đợt đã đóng thì còn bao nhiêu ghế cũng không mua
  // được, in "Almost full" ở đó là mời khách bấm vào chỗ không có gì.
  if (!bookable) {
    return (
      <span className={cn(BADGE_BASE, 'border-border bg-muted text-muted-foreground')}>
        {messages.tourDetail.departures.closed}
      </span>
    );
  }
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
  if (notice.kind === 'closed' || notice.kind === 'sold-out') {
    return (
      <span className={cn(BADGE_BASE, 'border-border bg-muted text-muted-foreground')}>
        {notice.kind === 'closed' ? messages.tourDetail.departures.closed : t.statusSoldOut}
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
 *
 * **Dưới `lg`, mỗi hàng thành một thẻ** (sửa 08/10) — vẫn CHÍNH bảng đó, chỉ đổi
 * `display` bằng CSS. Không dựng bản sao DOM cho mobile: bản sao in mỗi ngày khởi
 * hành hai lần vào HTML tĩnh và nhân đôi mọi nút Select. Đo prod 07/10 ở viewport
 * 375: khung còn 277px mà bốn cột ghim cứng đã 400px, nên cột ngày và cột ghế bị
 * bóp về 0, chữ đè nhau và nút Select bị `overflow-hidden` cắt mất. Ở 768 cột ngày
 * cũng chỉ còn ~70px — bảng chỉ đọc ổn từ ~820px — nên mốc chuyển là `lg`, trùng
 * mốc thanh đặt chỗ dính đáy và lưới bốn ô thống kê.
 *
 * Mọi lớp CHỈ dành cho bảng (đệm ô, viền ô, hover theo ô) mang tiền tố `lg:` thay
 * vì để trần rồi đè bằng `max-lg:`: `[&>td:first-child]:pl-…` nặng độ ưu tiên hơn
 * mọi lớp `max-lg:[&>td]:…`, nên đè là thua và thẻ lệch đệm. Từ `lg` trở lên,
 * style tính ra y như trước bản sửa (đã đo lại ở 1024 và 1280).
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

  // "Dates open" và "Next departure" đếm theo ĐẶT ĐƯỢC, cùng vị từ với mọi nơi
  // chọn đợt khác — nếu không, ô thống kê hứa 5 ngày còn bảng chỉ cho bấm 3.
  const openTotal = departures.filter(isDepartureOpen).length;
  // Đợt đã qua hạn đặt vẫn là một HÀNG trong bảng, nhưng không vào "Seats left"
  // hay "Price range": đó là ghế và giá không ai mua được nữa — cùng luật với giá
  // "from" (ADR-0041 §3). Hết đợt nhận đặt thì giá lùi về `basePrice`, trùng
  // đường lùi của `heroPrice` để hero và ô thống kê không nói hai giá.
  const bookable = departures.filter((d) => d.bookable);
  const seatsTotal = bookable.reduce((sum, d) => sum + d.seatsLeft, 0);
  const next = departures.find(isDepartureOpen) ?? departures[0];
  // `next` chỉ rơi vào đợt đã đóng khi không còn đợt nào đặt được — in số ghế
  // ở đó là hứa những ghế không mua được.
  const nextSub = next
    ? next.bookable
      ? t.nextDepartureSub(next.seatsLeft, capacity)
      : messages.tourDetail.departures.closed
    : '';
  const prices = bookable.length > 0 ? bookable.map((d) => Number(d.effectivePrice)) : [basePrice];
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
          sub={nextSub}
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
        {/* `max-lg:block` cùng `tbody` block: thẻ (`tr` flex) phải nằm trong
            khối thường — để `tbody` là row-group thì trình duyệt bọc thêm hộp bảng
            ẩn danh quanh mỗi hàng. `table-fixed` và `border-collapse` tự hết tác
            dụng khi bảng không còn `display: table`. */}
        <table className="w-full table-fixed border-collapse [--row-pad:20px] max-lg:block">
          {/* Phần dư dồn vào cột NGÀY vì đó là ô dài nhất ("Thu, 20 Aug →
              Sun, 23 Aug"); các cột còn lại ghim cứng. Để phần dư ở cột ghế
              (bản trước) thì thanh 10 đốt trôi lạc giữa 406px trống.

              Cột GHẾ rộng THEO SỨC CHỨA (sửa 19/08): bản 200px cứng chỉ chứa
              được 11 đốt (16×n−4 + pr-3), tour 16 chỗ tràn sang cột Status,
              22 chỗ tràn tới cột Price. Bề rộng theo `seatsColumnWidth` ở xl+;
              dưới xl kẹp 30% bảng (bằng ~200px cũ ở 820) và đốt tự co đều (xem
              `SeatMeter`). Cột Status 124 → 112: huy hiệu dài nhất "Almost
              full" ~90px, phần dư trả cho cột ngày. */}
          <colgroup className="max-lg:hidden">
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
          {/* Thẻ không có cột để canh nên nhãn cột rời bố cục — mỗi ô trong thẻ
              tự nói nghĩa ("7 of 16 seats left", "Open", "$59"). */}
          <thead className="max-lg:hidden">
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
                className="border-t border-border first:border-t-0 max-lg:block"
              >
                {/* Cả hàng bấm được, nhưng `aria-expanded` nằm trên <button>
                    thật trong ô đầu — bấm nút nổi bọt lên hàng nên chỉ có MỘT
                    handler, mà bàn phím vẫn tới được.

                    Trong thẻ (dưới lg): dòng đầu là mũi xổ · tên tháng · giá —
                    `order` kéo ô giá lên cạnh tên tháng; số ghế và huy hiệu mỗi
                    thứ một dòng riêng (`basis-full`), thụt `pl-7` = mũi xổ 16 +
                    khe 12 để thẳng chữ với tên tháng. Tên tháng giữ sàn 96px:
                    ở 320px khoảng giá "$1,531–$1,890" từng bóp nó còn 56px
                    ("November" cần 66), nay thiếu chỗ thì giá xuống dòng, sát
                    phải nhờ `ml-auto`. */}
                <tr
                  onClick={() => setOverrides((prev) => ({ ...prev, [group.month]: !open }))}
                  className="cursor-pointer [&>td]:align-middle lg:[&>td:first-child]:pl-(--row-pad) lg:[&>td:last-child]:pr-(--row-pad) lg:[&>td]:py-3.5 lg:[&>td]:pr-3 lg:hover:[&>td]:bg-muted/40 max-lg:flex max-lg:flex-wrap max-lg:items-start max-lg:gap-x-3 max-lg:gap-y-1 max-lg:px-4 max-lg:py-3.5 max-lg:hover:bg-muted/40"
                >
                  <td className="text-muted-foreground max-lg:order-1">
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
                  <td className="max-lg:order-2 max-lg:min-w-24 max-lg:flex-1">
                    <span className="block text-sm leading-5 font-medium text-foreground">
                      {label}
                    </span>
                    <span className="block text-xs leading-4 text-muted-foreground tabular-nums">
                      {t.monthMeta(
                        t.monthDepartures(group.items.length),
                        keepDateTogether(monthDateSpan(group.items)),
                      )}
                    </span>
                  </td>
                  <td className="text-[13px] text-muted-foreground tabular-nums max-lg:order-4 max-lg:basis-full max-lg:pl-7">
                    {t.monthSeatsOf(group.seatsLeft, group.items.length * capacity)}
                  </td>
                  {/* `empty:hidden`: tháng không có chuyện đáng nói thì huy hiệu
                      im lặng (xem `monthNotice`), và ô rỗng không được để lại một
                      dòng trống cộng khe trong thẻ. */}
                  <td className="max-lg:order-5 max-lg:basis-full max-lg:pl-7 max-lg:empty:hidden">
                    <MonthBadge items={group.items} />
                  </td>
                  <td className="text-right text-sm leading-5 font-medium tabular-nums max-lg:order-3 max-lg:ml-auto max-lg:shrink-0">
                    {group.minPrice === group.maxPrice
                      ? formatMoney(String(group.minPrice), tour.currency)
                      : `${formatMoney(String(group.minPrice), tour.currency)}–${formatMoney(String(group.maxPrice), tour.currency)}`}
                    {season ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {season === 'low' ? t.lowSeason : t.peak}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-lg:hidden" />
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
                    slug={tour.slug}
                    capacity={capacity}
                    currency={tour.currency}
                    durationDays={tour.durationDays}
                    selected={departure.id === selectedId}
                    hidden={!open}
                    onSelect={() => select(departure.id)}
                  />
                ))}

                {group.items.length > shown.length ? (
                  <tr hidden={!open} className="bg-muted/25 max-lg:flex max-lg:px-4">
                    <td className="max-lg:hidden" />
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
 * nhóm policy.
 *
 * Từ ADR-0041 chỉ còn THẺ ĐẦU đọc `policies` (nhóm BOOKING). Thẻ huỷ sinh từ
 * luật — `windowDaysForTripLength(durationDays)` — nên nó đúng cho mọi tour và
 * không bao giờ vắng mặt; policy loại CANCELLATION không còn được đọc ở đâu
 * trên trang tour (spec §5.1). Thẻ thứ ba vẫn suy từ `maxGroupSize` và
 * `factGroupSizeNote` (ADR-0023).
 */
function BookingPolicyCards({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.departuresTab;
  const td = messages.cancellationDeadline;
  // `find` chứ không `orderPolicies`: chỉ lấy đúng MỘT nhóm nên thứ tự API
  // không ảnh hưởng gì.
  const booking = tour.policies.find((p) => p.kind === 'BOOKING');

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
      {/* Vế SAU của lời hứa nói ngay trong `note`: luật mới KHÔNG có bậc nào
          sau hạn chót, nên câu "our standard refund schedule applies" cũ giờ
          trỏ vào một bảng không còn tồn tại. */}
      <FactCard
        icon={<RotateCcwIcon aria-hidden="true" />}
        label={t.cardChanging}
        value={td.rule(windowDaysForTripLength(tour.durationDays))}
        note={td.ruleAfter}
        link={{ href: '/cancellation-policy', label: td.policyLink }}
      />
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
 *
 * Trong thẻ (dưới lg) có ba dòng: khối ngày cạnh giá (`order` kéo ô giá lên) ·
 * thanh ghế trải ngang (`basis-full`) · huy hiệu cùng nút, nút sát phải nhờ
 * `ml-auto`. Thẻ dùng flex-wrap chứ không dùng lưới: lưới hai cột thì giá và nút
 * "Ask about this trip" (~135px) chung cột phải, cột ấy nở theo nút và bóp khối
 * ngày; flex-wrap để mỗi dòng tự co, thiếu chỗ thì nút xuống dòng riêng. `order`
 * chỉ đổi thứ tự NHÌN — trình đọc màn hình vẫn đọc theo cột bảng (ngày → ghế →
 * trạng thái → giá → nút), cũng là một thứ tự có nghĩa.
 *
 * Khối ngày giữ sàn 112px, vừa cụm `nowrap` rộng nhất (đo 08/10: "Wed, 30 May →"
 * 97.6px trong 84 tổ hợp thứ × tháng):
 * ở 320px cạnh giá gạch nó từng bị bóp còn 92px và cụm ngày tràn ô. Nay thiếu
 * chỗ thì giá xuống dòng riêng, `ml-auto` giữ nó sát phải.
 */
function DepartureRow({
  departure,
  slug,
  capacity,
  currency,
  durationDays,
  selected,
  hidden,
  rowIndex = 0,
  onSelect,
}: {
  departure: DepartureVM;
  /** Slug tour — dựng href `/tours/{slug}/enquire` cho hàng đã đóng. */
  slug: string;
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
  // Đợt đã qua hạn đặt VẪN HIỆN (spec §5.1) — biến mất thì khách tưởng mình
  // nhớ nhầm ngày. Chỉ bỏ cách chọn, và thay bằng một lối đi tiếp.
  const closed = !departure.bookable;
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
        'animate-tour-card-in bg-muted/25 data-selected:bg-primary/10 [&>td]:align-middle lg:[&>td:first-child]:pl-(--row-pad) lg:[&>td:last-child]:pr-(--row-pad) lg:[&>td]:border-t lg:[&>td]:border-border/55 lg:[&>td]:py-2.5 lg:[&>td]:pr-3 max-lg:flex max-lg:flex-wrap max-lg:items-start max-lg:gap-x-3 max-lg:gap-y-2.5 max-lg:border-t max-lg:border-border/55 max-lg:px-4 max-lg:py-3',
        !selected && 'hover:bg-muted/45',
      )}
    >
      <td className="max-lg:hidden" />
      <td className="max-lg:order-1 max-lg:min-w-28 max-lg:flex-1">
        <span
          className={cn(
            'block text-sm leading-5 font-medium tabular-nums',
            soldOut || closed ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {/* Hai cụm `nowrap`, mũi tên dính cụm đầu: thẻ hẹp chỉ được xuống dòng
              GIỮA hai ngày ("Thu, 20 Aug →" / "Sun, 23 Aug", đúng cách modal All
              dates tách dòng). Để trình duyệt tự ngắt thì ở ~130px ra
              "… → Sun," / "23 Aug". Ở bảng desktop cột ngày ≥245px nên vẫn một dòng. */}
          <span className="whitespace-nowrap">
            {formatDialogDate(departure.startDate)} <span className="text-muted-foreground">→</span>
          </span>{' '}
          <span className="whitespace-nowrap">{formatDialogDate(departure.endDate)}</span>
        </span>
        <span className="block text-xs leading-4 text-muted-foreground">
          {t.departureMeta(durationDays)}
        </span>
        {/* Ngày chót của CHÍNH đợt này, từ `bookingDeadline` server trả — web
            không tự trừ N ngày bằng giờ trình duyệt (spec §2 Q7). */}
        {departure.bookable ? (
          <span className="block text-xs leading-4 text-muted-foreground">
            {messages.cancellationDeadline.short(
              keepDateTogether(formatChipDate(departure.bookingDeadline)),
            )}
          </span>
        ) : null}
      </td>
      {/* `min-w-0`: ô flex mặc định `min-width: auto` = bề rộng nội dung, mà
          thanh 16 đốt đã 252px (22 đốt 348px) — không có nó thì thanh lấn lề
          thẻ ở 375px và tràn khỏi khung ở 320px thay vì để đốt co đều. */}
      <td className="max-lg:order-3 max-lg:min-w-0 max-lg:basis-full">
        <SeatMeter seatsLeft={departure.seatsLeft} capacity={capacity} />
        <span className="mt-1.5 block text-xs leading-4 text-muted-foreground tabular-nums">
          {soldOut ? t.noSeatsLeft : t.seatsOfCapacity(departure.seatsLeft, capacity)}
        </span>
      </td>
      <td className="max-lg:order-4 max-lg:self-center">
        <SeatBadge
          seatsLeft={departure.seatsLeft}
          capacity={capacity}
          bookable={departure.bookable}
        />
      </td>
      <td className="text-right tabular-nums max-lg:order-2 max-lg:ml-auto max-lg:shrink-0">
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
      <td className="text-right max-lg:order-5 max-lg:ml-auto max-lg:self-center">
        {closed ? (
          // Nhãn dài trong cột ghim 120px: cho XUỐNG DÒNG thay vì nới cột —
          // nới cột thì cột ngày ("Thu, 20 Aug → Sun, 23 Aug") bị bóp ở bề
          // ngang ~820px, mà đó mới là ô khách đọc. `text-center` vì chữ xuống
          // dòng kế thừa `text-right` của ô, hai dòng canh phải (user góp ý 18/09).
          <ButtonLink
            variant="outline"
            className={cn(PANEL_BTN_SM, 'h-auto py-1.5 text-center leading-4 whitespace-normal')}
            href={`/tours/${slug}/enquire`}
          >
            {messages.tourDetail.booking.ask}
          </ButtonLink>
        ) : (
          <Button
            type="button"
            className={PANEL_BTN_SM}
            variant={selected ? 'outline' : 'default'}
            disabled={soldOut}
            onClick={onSelect}
          >
            {soldOut ? t.statusSoldOut : selected ? t.selected : t.select}
          </Button>
        )}
      </td>
    </tr>
  );
}
