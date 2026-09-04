'use client';

import { Button } from '@tourism/ui/components/button';
import { Calendar } from '@tourism/ui/components/calendar';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { Popover, PopoverContent, PopoverTrigger } from '@tourism/ui/components/popover';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import { TOOLBAR_FIELD } from '@/components/kit/toolbar-metrics';
import { formatDateLabel, parseIsoDate, parseTypedDate, toIsoDate } from '@/lib/date-field';

/**
 * Một ô chọn ngày của kit admin — kiểu `date-picker-04` của Shadcn Studio
 * (user chốt 01/09).
 *
 * Ở KIT từ 04/09 khi có consumer thứ hai (`/cancellations`, ADR-0028 §AMEND);
 * trước đó nó nằm trong `components/bookings/`. Component vốn đã hoàn toàn
 * tổng quát — props chỉ là nhãn, `value` ISO và `onCommit` — nên lần nâng này
 * không phải sửa gì ngoài đường import.
 *
 * Mô tả gốc:
 * ô chữ đọc được ("September 01, 2026") mang sẵn nút lịch nhỏ NẰM TRONG ô,
 * mở ra Popover chứa Calendar. Registry đã khai ở `components.json`
 * (`@ss-components`), nên kéo lại bản gốc bất cứ lúc nào bằng
 * `pnpm dlx shadcn@latest view @ss-components/date-picker-04`.
 *
 * Khác bản registry ở ba chỗ, đều vì bản kia là DEMO còn đây là bộ lọc thật:
 *
 * 1. **Controlled theo URL.** Demo giữ ngày trong state riêng; ở đây nguồn sự
 *    thật là `value` (ISO trên URL) — cùng luật với cả trang `/bookings`, nơi
 *    không có state danh sách nào ở client (spec §2.2).
 * 2. **Không điều hướng theo từng phím.** Demo `setState` mỗi ký tự. Ở đây
 *    mỗi lần đổi URL là một lần fetch lại cả trang, nên chỉ CHỐT khi người ta
 *    tỏ ý xong: chọn trên lịch, rời ô, hoặc Enter. Gõ dở chỉ dời tháng đang
 *    xem của lịch. (Bản `<input type="date">` cũ dựa vào việc trình duyệt chỉ
 *    phát `change` khi đủ ba phần — ô chữ tự do không có sẵn ranh giới ấy.)
 * 3. **Gõ rác thì quay về, không im lặng nuốt.** Ô chữ nhận được mọi thứ, nên
 *    khi `parseTypedDate` từ chối thì ô phải snap về đúng thứ URL đang lọc —
 *    kẻo màn hình đứng đó khoe một bộ lọc không tồn tại (cùng bệnh mà vòng vá
 *    review F6 đã trị cho ca khoảng-ngược).
 *
 * CỐ Ý chưa nâng lên `components/kit/`: bookings vẫn là vùng DUY NHẤT có bộ
 * lọc ngày (`/cancellations` và `/reviews` không khai `from`/`to` trong
 * contract), và luật §2.1 là kit mọc từ vùng thật chứ không dựng abstraction
 * trước. Vùng thứ hai xuất hiện thì nâng lên.
 */
/**
 * Kiểu của prop `disabled` LẤY TỪ CHÍNH `Calendar` thay vì import `Matcher`
 * của `react-day-picker`: package đó là dependency của `@tourism/ui`, không
 * phải của admin, nên import thẳng sẽ vỡ ở pnpm strict — và mượn kiểu qua
 * component cũng đúng hơn về mặt sở hữu: admin chỉ cần biết cái nó truyền vào.
 */
type CalendarDisabled = NonNullable<React.ComponentProps<typeof Calendar>['disabled']>;

export interface DatePickerFieldProps {
  /** Id của ô chữ — nhãn ẩn trỏ vào đây. */
  id: string;
  /** Nhãn của ô (ẩn về mặt thị giác, hàng điều khiển đã chật). */
  label: string;
  /** Nhãn của nút mở lịch — chỉ máy đọc màn hình nghe thấy. */
  openLabel: string;
  /** Gợi ý trong ô rỗng; cũng là bản mẫu ngầm của dạng ngày ô này nhận. */
  placeholder: string;
  /** Ngày đang lọc, dạng ISO `YYYY-MM-DD`, rỗng là không lọc. */
  value: string;
  /** Chặn dưới (ISO) — ngày trước mốc này bị làm mờ trên lịch. */
  min?: string | undefined;
  /** Chặn trên (ISO) — ngày sau mốc này bị làm mờ trên lịch. */
  max?: string | undefined;
  /** Gọi khi người dùng CHỐT một ngày; chuỗi rỗng nghĩa là bỏ lọc đầu này. */
  onCommit: (iso: string) => void;
}

export function DatePickerField({
  id,
  label,
  openLabel,
  placeholder,
  value,
  min,
  max,
  onCommit,
}: DatePickerFieldProps) {
  const selected = parseIsoDate(value);
  const [open, setOpen] = React.useState(false);
  // Mốc để biết focus có đang đi VÀO LỊCH không (popover portal ra ngoài cây,
  // và Calendar `autoFocus` kéo focus về nó ngay khi mở). Xem `onBlur`.
  const popoverRef = React.useRef<HTMLDivElement>(null);
  // Chữ đang nằm trong ô. Chỉ là BẢN NHÁP giữa hai lần chốt — `value` mới là
  // nguồn sự thật. Nơi dùng đã `key` theo URL nên state này tự gieo lại sau
  // mỗi lần điều hướng, không cần effect đồng bộ.
  const [text, setText] = React.useState(() => formatDateLabel(selected));
  // Tháng lịch đang mở. Tách khỏi `selected` để lịch còn đi theo được cả ngày
  // vừa gõ dở (chưa chốt) lẫn tháng người ta bấm mũi tên sang.
  const [month, setMonth] = React.useState<Date | undefined>(selected);

  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  // Làm mờ phần lịch nằm ngoài đầu kia của khoảng. Đây là RÀO ĐỠ chứ không
  // phải cái chốt: ô chữ vẫn gõ tay được, nên `bookingsHref` vẫn phải lọc lần
  // nữa — cùng luật khoan dung với đường URL.
  const disabled: CalendarDisabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  /** Chốt chữ đang có trong ô: ra ngày thì đẩy lên, không ra thì kéo ô về. */
  function commitText() {
    const trimmed = text.trim();

    // Xoá trắng là một ý định rõ ràng: bỏ lọc đầu này.
    if (!trimmed) {
      if (value) onCommit('');
      return;
    }

    const parsed = parseTypedDate(trimmed);
    if (!parsed) {
      setText(formatDateLabel(selected));
      return;
    }

    const iso = toIsoDate(parsed);
    // Cùng một ngày viết kiểu khác ("Sep 1 2026") không đáng một lần fetch
    // lại — chỉ chuẩn hoá lại chữ trong ô.
    if (iso === value) {
      setText(formatDateLabel(parsed));
      return;
    }

    onCommit(iso);
  }

  return (
    <div className="relative">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Input
        id={id}
        // Ô chữ, KHÔNG phải `type="date"`: cả điểm hấp dẫn của
        // `date-picker-04` nằm ở chỗ nó thay lịch native (mỗi trình duyệt một
        // kiểu, không nhuộm được theo token) bằng Calendar của chính repo.
        type="text"
        // KHÔNG `inputMode="numeric"`: ô này nhận "September 01, 2026", tức
        // chủ yếu là CHỮ — bàn phím số trên mobile sẽ khoá luôn tên tháng.
        autoComplete="off"
        className={`w-52 bg-background pr-10 ${TOOLBAR_FIELD}`}
        aria-label={label}
        title={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          // Gõ tới đâu lịch theo tới đó — nhưng KHÔNG chốt (xem đầu file).
          const typed = parseTypedDate(event.target.value);
          if (typed) setMonth(typed);
        }}
        // Rời ô là chốt — TRỪ khi focus đi VÀO LỊCH của chính ô này (vòng vá
        // review 02/09): Calendar `autoFocus` kéo focus về nó ngay khi popover
        // mở, mà chốt lúc đó là: đẩy bản nháp lên URL → `key` của ô đổi → ô
        // remount với `open=false` → lịch đóng ngay khi vừa mở. Lịch nằm trong
        // Portal nên hỏi qua ref của popover; `relatedTarget` vẫn trỏ được vào
        // phần tử portal. (Cú CLICK vào icon lịch thì chặn từ `mousedown` ở
        // trigger — xem dưới — nên không tới được đây; còn `Tab` sang icon là
        // rời ô thật, chốt như thường.)
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next && popoverRef.current?.contains(next)) return;
          commitText();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            // Ô này có thể nằm trong `<form>` ở tương lai — chặn submit ngầm.
            event.preventDefault();
            commitText();
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" variant="ghost" />}
          className="absolute top-1/2 right-2 size-7 -translate-y-1/2 active:-translate-y-1/2"
          // Bấm chuột vào icon KHÔNG được làm ô chữ blur (vòng vá review
          // 02/09): blur là chốt, chốt bản nháp là điều hướng, điều hướng là
          // remount — và lịch vừa mở đã đóng. Chặn default của `mousedown` giữ
          // focus ở ô; `click` vẫn tới và popover vẫn mở.
          onMouseDown={(event) => event.preventDefault()}
        >
          <CalendarIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">{openLabel}</span>
        </PopoverTrigger>
        <PopoverContent
          ref={popoverRef}
          className="w-auto overflow-hidden p-0"
          align="end"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode="single"
            // `autoFocus` để lịch nhận bàn phím ngay khi mở — nếu không, cú
            // ArrowDown mở popover ở trên là một ngõ cụt cho người dùng phím.
            autoFocus
            selected={selected}
            month={month ?? selected}
            onMonthChange={setMonth}
            disabled={disabled}
            onSelect={(next) => {
              setOpen(false);
              if (!next) return;
              setText(formatDateLabel(next));
              setMonth(next);
              onCommit(toIsoDate(next));
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
