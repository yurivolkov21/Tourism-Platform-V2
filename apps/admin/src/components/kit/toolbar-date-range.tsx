'use client';

import { Button } from '@tourism/ui/components/button';
import * as React from 'react';
import { DatePickerField } from '@/components/kit/date-picker-field';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';

/**
 * Bộ lọc KHOẢNG NGÀY của hàng điều khiển bảng admin — hai ô `DatePickerField`
 * cộng nút xoá cả hai đầu.
 *
 * Ở KIT từ 04/09 khi có consumer thứ hai (`/cancellations`, ADR-0028 §AMEND);
 * `/bookings` là consumer đầu (spec P4b §3-F6). Nâng lên vì phần đáng dùng
 * chung KHÔNG phải hai cái ô — đó là `DatePickerField`, vốn đã ở kit — mà là
 * **guard "patch bị vứt"** dưới đây: một cơ chế tinh vi, học được bằng hai
 * vòng review, và chép sang vùng thứ hai là chép đúng thứ khó nhất.
 *
 * Đổi ngày là ĐIỀU HƯỚNG ngay, cùng nếp với tab trạng thái — nhưng "ngay"
 * tính theo lúc CHỐT (chọn trên lịch / rời ô / Enter) chứ không theo từng
 * phím, vì ô chữ tự do không có sẵn ranh giới `change` mà ô date native cho
 * không. Chi tiết ở `DatePickerField`.
 *
 * Vùng giữ phần RIÊNG của nó: nhãn, tiền tố id, và `hrefFor` (nó biết hàm
 * href cùng query của mình). Kit không biết vùng nào đang dùng.
 */
export interface ToolbarDateRangeProps {
  /** Tiền tố id cho hai ô — phải khác nhau giữa các vùng để label gắn đúng. */
  idPrefix: string;
  /** Nhãn của cả bộ lọc, gắn vào `<fieldset>`. */
  label: string;
  labels: {
    from: string;
    to: string;
    openFrom: string;
    openTo: string;
    placeholder: string;
    clear: string;
  };
  /** Ngày đang lọc, ISO `YYYY-MM-DD`; `undefined` là không lọc đầu đó. */
  from?: string | undefined;
  to?: string | undefined;
  /**
   * Href cho một sửa đổi khoảng ngày. Nhận cả `page` vì guard bên dưới phải
   * GHIM trang ở cả hai vế khi so sánh — không có nó thì guard trượt từ trang
   * 2 trở đi (xem `go`).
   */
  hrefFor: (patch: { from?: string | null; to?: string | null; page?: number }) => string;
  /** Điều hướng thật. Vùng truyền `router.push` xuống. */
  onNavigate: (href: string) => void;
}

export function ToolbarDateRange({
  idPrefix,
  label,
  labels,
  from,
  to,
  hrefFor,
  onNavigate,
}: ToolbarDateRangeProps) {
  // Nonce ĐẶT LẠI ô nhập (vòng vá review F6). Xem `go`: có một ca mà URL
  // không đổi nhưng ô vẫn phải quay về giá trị đang lọc, và `key` theo URL
  // một mình không kéo nổi nó về.
  const [resetNonce, setResetNonce] = React.useState(0);

  /**
   * Đổi một đầu của khoảng.
   *
   * Ca phải xử riêng: giá trị vừa chốt bị luật khoảng-ngược của `parseDateRange`
   * VỨT ĐI — điều hướng lúc đó chỉ tổ hại (URL không đổi, hoặc tệ hơn: nhảy về
   * trang 1 mà chẳng lọc thêm gì), còn ô thì đứng đó khoe một bộ lọc không tồn
   * tại vì React không dựng lại nó. Bump nonce để ô snap về đúng thứ URL đang
   * nói. (Lịch làm mờ ngày ngoài khoảng, nhưng ô CHỮ vẫn gõ tay được nên ca
   * này tới được — y như hồi `min`/`max` của ô date native chỉ làm value
   * `:invalid` chứ không chặn gõ.)
   *
   * Phát hiện "patch bị vứt" bằng cách so PHẦN LỌC với `page` GHIM CÙNG MỘT
   * GIÁ TRỊ ở cả hai vế (vòng vá review F6 lần 2): bản đầu so `next` với
   * href-hiện-tại trần, nhưng hai vế đó tính `page` theo hai luật khác nhau —
   * patch (dù bị vứt) vẫn làm `scopeChanged=true` nên vế patch mất `page` khỏi
   * URL, còn vế `{}` giữ trang hiện tại. Từ trang 2+ hai chuỗi khác nhau CHỈ
   * VÌ page, guard trượt, và bug "ô khoe bộ lọc ma" tái hiện y nguyên.
   */
  function go(patch: { from?: string | null; to?: string | null }) {
    const filtersUnchanged = hrefFor({ ...patch, page: 1 }) === hrefFor({ page: 1 });
    if (filtersUnchanged) {
      setResetNonce((nonce) => nonce + 1);
      return;
    }
    onNavigate(hrefFor(patch));
  }

  return (
    // `<fieldset>` chứ không phải div trần: hai ô là MỘT bộ lọc, và nhãn chung
    // chỉ gắn được vào phần tử có role — fieldset mang sẵn role `group` mà
    // không cần thuộc tính ARIA nào.
    <fieldset aria-label={label} className="flex items-center gap-1.5">
      <DatePickerField
        id={`${idPrefix}-from`}
        label={labels.from}
        openLabel={labels.openFrom}
        placeholder={labels.placeholder}
        // `key` ép React dựng lại ô sau mỗi lần điều hướng nên ô luôn khớp URL
        // mà không cần effect đồng bộ (cùng nếp `TableSearchForm`); nonce là
        // đường kéo về cho ca URL-không-đổi (xem `go`).
        key={`from-${from ?? ''}-${resetNonce}`}
        value={from ?? ''}
        onCommit={(iso) => go({ from: iso || null })}
      />
      <span aria-hidden="true" className="text-muted-foreground">
        –
      </span>
      <DatePickerField
        id={`${idPrefix}-to`}
        label={labels.to}
        openLabel={labels.openTo}
        placeholder={labels.placeholder}
        key={`to-${to ?? ''}-${resetNonce}`}
        // KHÔNG `min`/`max` chéo nhau (vòng vá review polish 2): ở `/bookings`
        // mặc định tháng hiện tại làm ô kia luôn có giá trị, nên lùi tháng
        // bằng ô "đến ngày" bị lịch xám chặn; khoảng ngược đã có
        // `parseDateRange` lo.
        value={to ?? ''}
        onCommit={(iso) => go({ to: iso || null })}
      />
      {/* Xoá cả hai đầu trong một cú bấm — nếp `TableSearchForm`. Không có nó
          thì bỏ lọc nghĩa là quét trắng từng ô rồi rời ô, và nó cũng là lối
          thoát cho ca ô bị kéo về ở `go` (review F6). */}
      {from || to ? (
        <Button
          type="button"
          variant="ghost"
          className={TOOLBAR_BUTTON}
          onClick={() => go({ from: null, to: null })}
        >
          {labels.clear}
        </Button>
      ) : null}
    </fieldset>
  );
}
