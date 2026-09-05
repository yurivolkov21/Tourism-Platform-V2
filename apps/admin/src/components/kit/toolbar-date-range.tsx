'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Calendar } from '@tourism/ui/components/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@tourism/ui/components/popover';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import * as React from 'react';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';
import { formatDateRangeLabel, parseIsoDate, toIsoDate } from '@/lib/date-field';

/**
 * Bộ lọc KHOẢNG NGÀY của hàng điều khiển bảng admin — MỘT nút mở lịch hai
 * tháng, chọn cả khoảng trong một lần.
 *
 * Khuôn `@shadcn-space/date-picker-02` (user chốt 05/09 qua bản demo
 * `docs/design/mockups/admin-toolbar-sizing.src.html`). Kéo lại bản gốc bằng
 * `pnpm dlx shadcn@latest view @shadcn-space/date-picker-02 -c .`. Không thêm
 * dependency nào: `Calendar`, `Popover`, `react-day-picker` và `date-fns` đều
 * đã có sẵn trong `@tourism/ui`.
 *
 * Ở KIT từ 04/09 khi có consumer thứ hai (`/cancellations`, ADR-0028 §AMEND);
 * `/bookings` là consumer đầu (spec P4b §3-F6), `/reviews` là thứ ba.
 *
 * ## Cái gì thay đổi so với bản hai ô, và cái giá của nó
 *
 * Bản cũ là hai `DatePickerField` — hai ô CHỮ gõ tay được, mỗi ô một lịch một
 * tháng. Đổi sang range picker được một lần chọn cho cả khoảng, nhưng mất hai
 * thứ, và cả hai đã được cân trước khi chốt:
 *
 * 1. **Không gõ ngày bằng bàn phím nữa.** Bù bằng `captionLayout="dropdown"` —
 *    nhảy về một tháng bất kỳ là hai cú chọn dropdown, không phải bấm lùi từng
 *    tháng. Không có nó thì lọc từ 2024 là hơn chục cú bấm và đổi này là một
 *    bước lùi.
 * 2. **Không chọn được "đến ngày X" mà không có ngày bắt đầu.** `mode="range"`
 *    biểu diễn được `{from, to: undefined}` nhưng không biểu diễn được chiều
 *    ngược lại. URL vẫn nhận `?to=` một mình (mọi `parseDateRange` giữ nguyên)
 *    và nút vẫn ĐỌC ĐÚNG nó ra chữ "Until …" — chỉ là không bấm ra được.
 *
 * ## Bản registry lệch chỗ nào
 *
 * Nó là một DEMO: giữ ngày trong `useState` riêng, mặc định `addDays(now, 7)`,
 * và in một dòng "Stay duration: N nights". Ở đây nguồn sự thật là URL
 * (`from`/`to` truyền vào), không có mặc định nào, và không có dòng đếm đêm.
 * Thứ giữ lại là hình dạng: nút outline có icon lịch bên trái, chevron bên
 * phải, popover chứa `Calendar` hai tháng.
 *
 * Vùng giữ phần RIÊNG của nó: nhãn, tiền tố id, và `hrefFor` (nó biết hàm href
 * cùng query của mình). Kit không biết vùng nào đang dùng.
 *
 * **Không còn nút Clear riêng** (05/09): nó chuyển sang `ToolbarClearFilters`
 * chung ở cuối hàng — đang lọc cả ngày lẫn chữ thì trước đây hàng mọc ra hai
 * nút xoá cạnh nhau.
 */

/**
 * Kiểu khoảng ngày LẤY TỪ CHÍNH `Calendar` thay vì import `DateRange` của
 * `react-day-picker`: package đó là dependency của `@tourism/ui`, không phải
 * của admin, nên import thẳng sẽ vỡ ở pnpm strict — cùng lý do đã ghi ở
 * `date-picker-field.tsx` cho `CalendarDisabled`.
 */
type RangeCalendarProps = Extract<React.ComponentProps<typeof Calendar>, { mode: 'range' }>;
type DateRangeValue = NonNullable<Parameters<NonNullable<RangeCalendarProps['onSelect']>>[0]>;

const t = messages.admin.table;

/** Năm sớm nhất dropdown năm cho chọn — trước cả booking đầu tiên của hệ. */
const EARLIEST_YEAR = 2020;
/** Đệm về tương lai: chuyến khởi hành đặt trước cả năm là chuyện bình thường. */
const FUTURE_YEARS = 2;

export interface ToolbarDateRangeProps {
  /** Tiền tố id cho nút — phải khác nhau giữa các vùng để label gắn đúng. */
  idPrefix: string;
  /**
   * Nhãn của cả bộ lọc, nói rõ vùng này lọc theo CỘT NGÀY nào ("Filter by
   * submitted date"). Vào `aria-label` của nút — chữ trên nút là giá trị đang
   * lọc nên tự nó không nói ra mục đích.
   */
  label: string;
  /** Ngày đang lọc, ISO `YYYY-MM-DD`; `undefined` là không lọc đầu đó. */
  from?: string | undefined;
  to?: string | undefined;
  /**
   * Href cho một sửa đổi khoảng ngày. Nhận cả `page` vì guard bên dưới phải
   * GHIM trang ở cả hai vế khi so sánh — không có nó thì guard trượt từ trang
   * 2 trở đi (xem `commit`).
   */
  hrefFor: (patch: { from?: string | null; to?: string | null; page?: number }) => string;
  /** Điều hướng thật. Vùng truyền `router.push` xuống. */
  onNavigate: (href: string) => void;
}

export function ToolbarDateRange({
  idPrefix,
  label,
  from,
  to,
  hrefFor,
  onNavigate,
}: ToolbarDateRangeProps) {
  const [open, setOpen] = React.useState(false);

  const applied = React.useMemo<DateRangeValue | undefined>(() => {
    const start = parseIsoDate(from);
    const end = parseIsoDate(to);
    return start || end ? { from: start, to: end } : undefined;
  }, [from, to]);

  /**
   * Khoảng đang vẽ trên lịch. Cần state riêng vì `mode="range"` chốt bằng HAI
   * cú bấm: sau cú thứ nhất `to` còn rỗng, và nếu chỉ đọc từ props thì cú bấm
   * ấy không hiện ra đâu cả — người dùng bấm một ngày rồi thấy lịch không đổi
   * gì, tưởng nó hỏng.
   */
  const [draft, setDraft] = React.useState<DateRangeValue | undefined>(applied);

  /**
   * Đã bấm mốc ĐẦU của khoảng mới chưa.
   *
   * Cần cờ này vì `mode="range"` trả về `{from: X, to: X}` NGAY TỪ CÚ BẤM ĐẦU
   * — một khoảng một ngày, đủ điều kiện "có cả hai đầu". Không có cờ thì cú
   * bấm đầu tiên đã chốt và đóng lịch, và **không ai chọn nổi một khoảng**.
   * (Đo được bằng test, không phải suy đoán: bản đầu của component này chốt
   * ngay lần bấm thứ nhất.)
   *
   * Đếm lượt CHỌN chứ không so `from` với `to`: so ngày sẽ chặn luôn một
   * khoảng một-ngày cố ý ("chỉ ngày 10"), thứ hoàn toàn hợp lệ.
   */
  const [awaitingEnd, setAwaitingEnd] = React.useState(false);

  const shownRange = formatDateRangeLabel(parseIsoDate(from), parseIsoDate(to));
  const triggerText = shownRange
    ? shownRange.kind === 'from'
      ? t.dateFrom(shownRange.text)
      : shownRange.kind === 'to'
        ? t.dateUntil(shownRange.text)
        : shownRange.text
    : t.dateAny;

  const thisYear = new Date().getFullYear();

  /**
   * Chốt khoảng vừa chọn.
   *
   * Bỏ qua khi href KHÔNG đổi — chọn lại đúng khoảng đang lọc thì một lần
   * điều hướng chỉ tổ fetch lại cả trang. Phép so GHIM `page: 1` ở CẢ HAI vế
   * (bài học `go` của bản cũ, vòng vá review F6 lần 2): patch làm
   * `scopeChanged = true` nên vế patch mất `page` khỏi URL còn vế `{}` giữ
   * trang hiện tại — từ trang 2 trở đi hai chuỗi khác nhau CHỈ VÌ `page` và
   * guard trượt.
   */
  function commit(range: DateRangeValue) {
    if (!range.from || !range.to) return;
    const patch = { from: toIsoDate(range.from), to: toIsoDate(range.to) };
    setOpen(false);
    if (hrefFor({ ...patch, page: 1 }) === hrefFor({ page: 1 })) return;
    onNavigate(hrefFor(patch));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Mở ra là gieo lại nháp từ URL: đóng giữa chừng rồi mở lại phải thấy
        // khoảng ĐANG lọc, không phải nửa khoảng bỏ dở lần trước.
        // Mỗi lần mở là một khoảng mới bắt đầu từ đầu: cú bấm kế tiếp luôn là
        // mốc ĐẦU, kể cả khi URL đang mang sẵn một khoảng — `onSelect` ép điều
        // đó, vì DayPicker một mình thì không (xem ghi chú ở đó).
        if (next) {
          setDraft(applied);
          setAwaitingEnd(false);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={`${idPrefix}-date-range`}
            type="button"
            variant="outline"
            className={`${TOOLBAR_BUTTON} font-normal`}
            aria-label={`${label}: ${triggerText}`}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" aria-hidden="true" />
        {triggerText}
        <ChevronDownIcon data-icon="inline-end" aria-hidden="true" className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start" sideOffset={8}>
        <Calendar
          mode="range"
          // `autoFocus` để lịch nhận bàn phím ngay khi mở — nếu không, cú
          // ArrowDown mở popover là một ngõ cụt cho người dùng phím (nếp
          // `DatePickerField`, và nay quan trọng hơn vì đây là đường DUY NHẤT
          // vào bộ lọc ngày).
          autoFocus
          numberOfMonths={2}
          // Hai dropdown tháng/năm — thứ bù lại cho việc mất ô gõ tay. Không
          // có nó thì lọc một tháng của năm ngoái là hơn chục cú bấm mũi tên.
          captionLayout="dropdown"
          startMonth={new Date(EARLIEST_YEAR, 0)}
          endMonth={new Date(thisYear + FUTURE_YEARS, 11)}
          defaultMonth={parseIsoDate(from) ?? parseIsoDate(to)}
          selected={draft}
          // Nhận cả `day` (mốc vừa bấm) chứ không chỉ `range`: khi nháp đang
          // là một khoảng ĐỦ HAI ĐẦU (gieo từ URL), `addToRange` của
          // react-day-picker KHÔNG mở khoảng mới mà SỬA ĐUÔI khoảng cũ — bấm
          // 10/09 rồi 20/09 trên URL 01–30/09 cho ra 01–20/09 (vòng vá review
          // 05/09, tái hiện bằng test). Cú bấm đầu vì thế ép thẳng
          // `{ from: day }` và bỏ qua thứ DayPicker vừa tính.
          onSelect={(range, day) => {
            if (!awaitingEnd) {
              setDraft({ from: day, to: undefined });
              setAwaitingEnd(true);
              return;
            }
            setAwaitingEnd(false);
            if (!range?.from || !range.to) {
              setDraft(range);
              return;
            }
            setDraft(range);
            commit(range);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
