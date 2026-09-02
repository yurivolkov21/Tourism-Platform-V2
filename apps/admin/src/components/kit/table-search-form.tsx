'use client';

import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { cn } from '@tourism/ui/lib/utils';
import * as React from 'react';
import { TOOLBAR_BUTTON, TOOLBAR_FIELD } from '@/components/kit/toolbar-metrics';

/**
 * Ô tìm kiếm của bảng admin (kit P4b — nâng từ cặp bản chép VERBATIM
 * `BookingsSearch`/`ReviewsSearch`, sổ nợ ghi ở CHANGELOG 31/08 entry F4).
 *
 * Hình dạng lấy từ `input-24` của Shadcn Studio (user chốt 01/09): NHÃN NỔI —
 * nhãn nằm trong ô lúc nghỉ, trôi lên nằm trên viền khi ô được focus hoặc đã
 * có chữ. Registry khai ở `components.json` (`@ss-components`), kéo lại bản
 * gốc bằng `pnpm dlx shadcn@latest view @ss-components/input-24`.
 *
 * Sửa ở KIT chứ không fork riêng cho `/bookings`: user chốt 31/08 mọi bảng
 * admin đi một kiểu, cấm bản rút gọn. Nên `/reviews` đổi theo cùng lúc — đó
 * là ý đồ, không phải tác dụng phụ.
 *
 * Ranh giới: kit lo hình dạng + hành vi ô nhập, vùng lo URL. Chuỗi đi ra
 * NGUYÊN VĂN — trim và cắt trần là luật của `*Href` (một bản duy nhất cho cả
 * đường URL người gõ lẫn đường form), lặp lại ở đây là hai bản sẽ trôi lệch.
 *
 * Chỉ dựng ô này cho vùng mà server THẬT SỰ đọc tham số search — bảng
 * `/cancellations` cố ý không có, vì `AdminCancellationsListQuerySchema`
 * không khai `search` và một ô tìm kiếm không lọc gì là lời hứa suông.
 */

/**
 * Nhãn nổi, bê từ `input-24`. Hai điều kiện đẩy nhãn lên viền, và phải có ĐỦ
 * CẢ HAI vì mỗi cái bắt một ca: `group-focus-within` cho lúc ô đang được gõ,
 * `has-[+input:not(:placeholder-shown)]` cho lúc ô đã có chữ nhưng mất focus
 * (không có vế sau, rời ô là nhãn rơi xuống đè lên chính chữ vừa gõ).
 *
 * Đệm ngang phải khớp ô nhập kẻo chữ nhảy ngang lúc nhãn trôi: `Input` của
 * repo là `px-2.5` (10px), nên nhãn `px-1.5` (6px) cộng `px-1` (4px) của span
 * bên trong là vừa đúng. (Bản registry dùng `px-2`+`px-1` vì Input bên đó
 * `px-3`.)
 *
 * Lúc nghỉ nhãn canh ĐÚNG TÂM ô (`top-1/2`), không phải `top-[calc(50%-0.1rem)]`
 * như bản registry: cái nhích 1.6px lên trên ấy hợp với ô cao hơn của họ,
 * nhưng ở `Input` cao `h-8` của repo thì nhìn thấy rõ là lệch lên (user báo
 * 01/09). Canh đúng tâm cũng khớp luôn với chữ người ta gõ vào, vì trình
 * duyệt cũng canh giữa chữ trong ô.
 */
const FLOATING_LABEL = cn(
  'absolute top-1/2 block origin-start -translate-y-1/2 cursor-text px-1.5 text-sm text-muted-foreground transition-all',
  'group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium group-focus-within:text-foreground',
  'has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium has-[+input:not(:placeholder-shown)]:text-foreground',
);

/**
 * Cụm nhãn nổi + ô nhập, TỰ giữ `focused` để `key` của cha đặt lại được cả
 * hai cùng lúc (xem chú thích ở chỗ dùng).
 *
 * Nhãn nổi chiếm đúng chỗ placeholder thường nằm, nên hai thứ không thể cùng
 * hiện: lúc nghỉ ô phải để trống chỗ đó cho nhãn. Đổi lại, khi ô được focus
 * thì nhãn đã trôi lên viền và chỗ ấy trống ra — vừa đủ để trả gợi ý ("Code,
 * name or email") về. Giữ nó là thuộc tính `placeholder` THẬT chứ không phải
 * một span vẽ đè: trình đọc màn hình đọc placeholder, không đọc span trang trí.
 */
function FloatingSearchInput({
  inputId,
  label,
  placeholder,
  defaultValue,
}: {
  inputId: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  const [focused, setFocused] = React.useState(false);

  return (
    <div className="group relative">
      {/* `<label>` trần chứ không phải `Label` của kit: `Label` mang sẵn
          `flex items-center gap-2 font-medium` — cả ba đều đánh nhau với
          nhãn nổi (nó phải là inline, tự đổi cỡ chữ và độ đậm theo trạng
          thái). Bản registry cũng dùng thẻ trần vì lý do đó. */}
      <label htmlFor={inputId} className={FLOATING_LABEL}>
        {/* Span nền để nhãn CẮT qua viền ô lúc trôi lên, thay vì nằm đè
            lên một nét viền chạy ngang giữa chữ. */}
        <span className="inline-flex bg-background px-1">{label}</span>
      </label>
      <Input
        id={inputId}
        name="q"
        type="search"
        // Không kiểm soát bằng state — cha `key` cả cụm theo URL.
        defaultValue={defaultValue}
        // Một dấu CÁCH, không phải chuỗi rỗng: cả mẹo nhãn nổi đứng trên
        // `:placeholder-shown`, mà ô không có placeholder thì pseudo-class
        // ấy không bao giờ đúng và nhãn sẽ kẹt ở trên viền vĩnh viễn.
        placeholder={focused ? placeholder : ' '}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // `dark:bg-background` để nền span của nhãn khớp nền ô ở dark mode —
        // mặc định `Input` là `dark:bg-input/30`, lệch tông thì chỗ nhãn cắt
        // viền trông như một miếng vá. (Bản registry cũng đắp đúng class này.)
        className={`w-40 dark:bg-background lg:w-56 ${TOOLBAR_FIELD}`}
      />
    </div>
  );
}

export function TableSearchForm({
  inputId,
  label,
  placeholder,
  clearLabel,
  value,
  onSearch,
  onClear,
}: {
  /** `id` của ô — mỗi bảng một id, tránh trùng khi hai bảng cùng DOM. */
  inputId: string;
  /** Nhãn nổi: "Search bookings"/"Search reviews" — nay NHÌN THẤY được. */
  label: string;
  /** Gợi ý dạng dữ liệu; chỉ hiện khi ô được focus (xem `placeholder` dưới). */
  placeholder: string;
  clearLabel: string;
  /** Từ khoá đang lọc (từ URL) — `undefined` là chưa lọc gì. */
  value: string | undefined;
  onSearch: (term: string) => void;
  onClear: () => void;
}) {
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSearch(String(form.get('q') ?? ''));
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      {/* `key` ép React dựng lại ô sau mỗi lần điều hướng nên ô luôn khớp URL
          mà không cần effect đồng bộ. Key đặt trên CẢ cụm ô + state `focused`
          của nó (vòng vá review 02/09): bản đầu chỉ key `<Input>` còn `focused`
          nằm ở đây, mà remount gỡ node đang focus KHÔNG bắn `blur` → `focused`
          kẹt `true`, placeholder hiện ra đè lên nhãn nổi đang ở vị trí nghỉ. */}
      <FloatingSearchInput
        key={value ?? ''}
        inputId={inputId}
        label={label}
        placeholder={placeholder}
        defaultValue={value ?? ''}
      />
      {value ? (
        <Button type="button" variant="ghost" className={TOOLBAR_BUTTON} onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </form>
  );
}
