'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { useRef } from 'react';
import { departureStatus, formatDateRange, formatMoney } from '@/lib/tours';
import type { MockTourDeparture } from '@/mocks/types';

/**
 * Dải chip chọn đợt khởi hành — xương sống của trang chi tiết.
 *
 * VÌ SAO NÓ Ở ĐẦU TRANG, ngược với cả 8 sản phẩm đã khảo sát (họ đều giấu lịch
 * sau một cú click "See all dates"): `departures[]` là dữ liệu giàu nhất và độc
 * quyền của v2 — Nexora hardcode `departures: []` nên khối chọn ngày của họ luôn
 * ẩn. Đưa nó lên là trung thực với dữ liệu, không phải trang trí.
 *
 * Ghế + giá in THẲNG trên chip, không giấu sau một cú bấm: Baymard ghi nhận khi
 * bộ chọn ngày không nói rõ tình trạng chỗ thì người dùng phải tự đi xác minh và
 * đó là điểm rời trang. Đây là lý do nghiên cứu, không phải sở thích.
 */
export function DepartureStrip({
  departures,
  currency,
  selectedId,
  onSelect,
  className,
}: {
  departures: MockTourDeparture[];
  currency: string;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const t = messages.tourDetail;
  const scroller = useRef<HTMLDivElement>(null);

  // departures[] rỗng → dòng trạng thái, KHÔNG phải dải rỗng. Một khung cuộn
  // trống rỗng là lỗi render dưới mắt người dùng.
  if (departures.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{t.departures.none}</p>;
  }

  /**
   * Điều hướng bàn phím giữa các chip CÒN CHỖ. Query lại DOM mỗi lần nhấn thay
   * vì giữ mảng ref: chip hết chỗ là `disabled` nên không nhận focus được, và
   * `:not([disabled])` cho danh sách luôn khớp thực tế — mảng ref tự quản lý sẽ
   * lệch ngay khi dữ liệu đổi.
   *
   * KHÔNG cuộn vòng ở hai đầu: dải này là một dãy ngày có đầu có cuối, nhảy từ
   * đợt cuối về đợt đầu làm người dùng tưởng mình đã đi hết cả lịch.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const chips = Array.from(
      scroller.current?.querySelectorAll<HTMLButtonElement>(
        '[data-departure-chip]:not([disabled])',
      ) ?? [],
    );
    if (chips.length === 0) return;

    const current = chips.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === 'ArrowRight') next = Math.min(chips.length - 1, current + 1);
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = chips.length - 1;

    const target = chips[next];
    if (!target || next === current) return;
    event.preventDefault();
    target.focus();
  }

  return (
    // data-lenis-prevent: Lenis chặn wheel trên cả tài liệu nên lăn chuột trong
    // vùng cuộn lồng lại cuộn TRANG CHÍNH. Thuộc tính này trả wheel về cho đây.
    //
    // KHÔNG đặt `role="group"` + aria-label ở đây: <section> bọc dải trong
    // page.tsx đã có `aria-labelledby` trỏ vào tiêu đề "Next departures", nên
    // thêm nhóm nữa là công bố hai lần. (Biome cũng chặn `role="group"` và đòi
    // <fieldset> — mà fieldset có `min-inline-size: min-content` làm vùng cuộn
    // ngang không co lại được.)
    <div
      ref={scroller}
      data-lenis-prevent
      className={cn(
        'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2',
        // scroll-padding để chip đầu không dính sát mép khi snap về đầu dải.
        'scroll-px-1',
        className,
      )}
    >
      {departures.map((departure) => {
        const status = departureStatus(departure.seatsLeft);
        const soldOut = status === 'sold-out';
        const selected = departure.id === selectedId;

        return (
          <button
            key={departure.id}
            type="button"
            data-departure-chip
            disabled={soldOut}
            aria-pressed={selected}
            onClick={() => onSelect(departure.id)}
            // Xử lý mũi tên gắn trên CHÍNH chip, không trên div bọc: div là phần
            // tử tĩnh, đặt handler ở đó vừa bị Biome chặn vừa là mùi thật (không
            // có gì bảo đảm div nhận được focus). Chip là <button> nên nó là chỗ
            // đúng, và keydown ở đây thấy đủ mọi phím người dùng bấm trong dải.
            onKeyDown={handleKeyDown}
            className={cn(
              'flex shrink-0 snap-start flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors',
              // Đợt hết chỗ: KHÔNG bấm được, mờ đi, con trỏ nói thẳng điều đó.
              soldOut && 'cursor-not-allowed opacity-60',
              !soldOut && 'cursor-pointer hover:border-primary/60',
              // Đợt đang chọn: viền + nền đặc để nó là chip DUY NHẤT nổi lên,
              // đồng bộ với hàng được highlight trong bảng đợt bên dưới.
              selected && !soldOut && 'border-primary bg-primary/10',
            )}
          >
            <span className="font-mono text-xs tracking-wide whitespace-nowrap text-muted-foreground uppercase">
              {formatDateRange(departure.startDate, departure.endDate)}
            </span>

            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span
                className={cn(
                  'font-heading text-lg font-semibold tabular-nums',
                  soldOut ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
              >
                {formatMoney(departure.effectivePrice, currency)}
              </span>
              {departure.compareAtPrice ? (
                <>
                  <span className="sr-only">
                    {t.wasPrice(formatMoney(departure.compareAtPrice, currency))}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-xs text-price-compare tabular-nums line-through"
                  >
                    {formatMoney(departure.compareAtPrice, currency)}
                  </span>
                </>
              ) : null}
            </span>

            {/* Ba nhãn ghế là suy diễn tầng UI từ seatsLeft (ngưỡng trong
                departureStatus), KHÔNG phải field contract. `limited` mới dùng
                token cảnh báo — nếu nhãn nào cũng nổi thì không nhãn nào nổi. */}
            <span
              className={cn(
                'text-xs whitespace-nowrap',
                status === 'limited' ? 'font-medium text-warning' : 'text-muted-foreground',
              )}
            >
              {soldOut
                ? t.departures.soldOut
                : status === 'limited'
                  ? t.departures.seatsLimited(departure.seatsLeft)
                  : t.departures.seatsAvailable(departure.seatsLeft)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
