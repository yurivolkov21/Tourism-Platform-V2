'use client';

import * as React from 'react';

/**
 * CỨU FOCUS khi phần tử đang giữ nó rời thân bảng ở một lượt làm mới (phần còn hở của G6).
 *
 * G6 giữ được focus khi nút mở hộp CÒN SỐNG qua lượt làm mới (`focusableWhenDisabled`). Nhưng ở
 * bốn chỗ nút ấy biến mất ngay sau một lệnh ghi thành công: Unsubscribe (hàng rời tab Active),
 * Retry (hàng hết FAILED), Approve (đổi thành Unpublish, hoặc hàng rời tab Pending) và Cancel
 * chuyến (hàng CANCELLED không còn nút nào). Base UI đã trả focus về đúng nút, rồi lượt làm mới
 * gỡ nút ấy khỏi DOM và focus bàn phím rơi về `<body>` — người dùng phải Tab lại từ đầu trang.
 *
 * Luật cứu: ở lại ĐÚNG CỘT. Hàng cũ còn thì lấy phần tử focus được đầu tiên của ô ấy (Retry mất
 * thì còn View, Approve mất thì còn Unpublish). Hàng cũ trống ô hay đã đi thì lấy hàng đứng sau
 * nó, rồi hàng đứng trước — như hộp thư: xử xong một thư thì sang thư kế. Không còn gì thì focus
 * chính bảng, để Tab đi tiếp từ chỗ bảng chứ không từ đầu trang.
 *
 * Chỉ cứu khi focus THẬT SỰ lạc (`document.activeElement` là `<body>`) và nó lạc từ chính thân
 * bảng: người dùng đã tự đi chỗ khác — ô tìm kiếm, một hộp thoại — thì không bao giờ bị giành
 * focus về. Hộp thoại mở từ một nút trong hàng cũng là "đi chỗ khác"; Base UI trả focus về nút ấy
 * lúc hộp đóng, và từ đó bảng mới canh lại.
 */

/** Chỗ focus đứng gần nhất trong thân bảng. */
interface FocusSpot {
  element: HTMLElement;
  rowId: string;
  /** Vị trí của hàng trong `<tbody>` lúc focus vào — hàng đã đi thì hàng thế chỗ đứng đúng đây. */
  rowIndex: number;
  cellIndex: number;
}

/** Phần tử nhận focus bằng Tab. Nút `disabled` thật không nhận; `aria-disabled` thì nhận. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function firstFocusable(cell: HTMLTableCellElement | undefined): HTMLElement | null {
  return cell?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
}

/**
 * Đích cứu theo luật ở đầu file — hàm THUẦN trên DOM, tách ra để test thẳng. `null` khi bảng
 * không còn `<tbody>` (bảng đã gỡ hẳn: không còn gì để cứu).
 */
export function rescueTarget(
  table: HTMLTableElement,
  spot: Omit<FocusSpot, 'element'>,
): HTMLElement | null {
  const body = table.tBodies[0];
  if (!body) return null;
  const rows = [...body.rows];
  const sameIndex = rows.findIndex((row) => row.dataset.rowId === spot.rowId);
  const cellOf = (row: HTMLTableRowElement | undefined) =>
    firstFocusable(row?.cells[spot.cellIndex]);

  // Hàng cũ còn đó: ô của nó trước, rồi các hàng SAU nó. Hàng cũ đã đi: hàng thế chỗ (cùng vị
  // trí) trước. Sau cùng mới tới các hàng phía trên, gần nhất trước.
  const start = sameIndex === -1 ? spot.rowIndex : sameIndex;
  for (let index = start; index < rows.length; index += 1) {
    const found = cellOf(rows[index]);
    if (found) return found;
  }
  for (let index = Math.min(start, rows.length) - 1; index >= 0; index -= 1) {
    const found = cellOf(rows[index]);
    if (found) return found;
  }
  return table;
}

export function useRowFocusRescue(tableRef: React.RefObject<HTMLTableElement | null>) {
  const spot = React.useRef<FocusSpot | null>(null);

  React.useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      const cell = target instanceof HTMLElement ? target.closest('td') : null;
      const row = cell?.parentElement;
      if (
        !(target instanceof HTMLElement) ||
        !(row instanceof HTMLTableRowElement) ||
        row.dataset.rowId === undefined ||
        row.parentElement !== table?.tBodies[0]
      ) {
        spot.current = null;
        return;
      }
      spot.current = {
        element: target,
        rowId: row.dataset.rowId,
        rowIndex: row.sectionRowIndex,
        cellIndex: (cell as HTMLTableCellElement).cellIndex,
      };
    }

    // Focus tự rời bảng (sang hộp thoại, thanh công cụ, hay bấm ra vùng trống): quên chỗ cũ. Riêng
    // phần tử bị GỠ khỏi DOM thì giữ chỗ cho bước cứu — trình duyệt có thể bắn `focusout` lúc gỡ.
    function onFocusOut(event: FocusEvent) {
      const next = event.relatedTarget;
      if (next instanceof Node && table?.contains(next)) return;
      if (event.target instanceof Node && !event.target.isConnected) return;
      spot.current = null;
    }

    table.addEventListener('focusin', onFocusIn);
    table.addEventListener('focusout', onFocusOut);
    return () => {
      table.removeEventListener('focusin', onFocusIn);
      table.removeEventListener('focusout', onFocusOut);
    };
  }, [tableRef]);

  // Không mảng phụ thuộc: chạy sau MỌI lượt vẽ của bảng — lượt làm mới mang hàng mới về là một
  // trong số đó, và đây là chỗ sớm nhất thấy được DOM mới mà trình duyệt chưa kịp vẽ.
  React.useLayoutEffect(() => {
    const last = spot.current;
    const table = tableRef.current;
    if (!last || !table || last.element.isConnected) return;
    spot.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const target = rescueTarget(table, last);
    if (target === table) {
      // Bảng chỉ nhận focus bằng script, và chỉ trong lúc này: `tabIndex` gắn lâu dài thì bấm
      // chuột vào chữ trong bảng cũng kéo focus về bảng.
      table.tabIndex = -1;
      table.addEventListener('blur', () => table.removeAttribute('tabindex'), { once: true });
    }
    target?.focus();
  });
}
