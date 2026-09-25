'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import * as React from 'react';
import { type Keyed, moveItem, removeAt } from '@/lib/list-editor';

/**
 * Khung sửa MỘT danh sách của khu làm việc tour (spec F17 §2h): thêm, xoá, lên,
 * xuống, trần số dòng. Nội dung từng dòng do nơi dùng dựng (`renderItem`), vì
 * sáu danh sách có sáu hình dạng dòng khác nhau.
 *
 * Bốn luật tiêu điểm — bàn phím không được rơi về `<body>` (bài học 10):
 * - Nút lên/xuống/thêm khoá bằng `focusableWhenDisabled`: dời một dòng lên đầu
 *   thì nút "lên" của nó vừa bị khoá đúng lúc đang được focus.
 * - Dời xong thì đặt lại tiêu điểm vào đúng nút vừa bấm của dòng vừa dời: React
 *   đổi chỗ dòng bằng `insertBefore`, và trình duyệt bỏ tiêu điểm của nút bị dời
 *   (jsdom thì không — test không canh được luật này, phải thử tay).
 * - Xoá một dòng thì tiêu điểm sang nút xoá của dòng thay chỗ, hết dòng thì về
 *   nút thêm.
 * - Thêm dòng thì tiêu điểm vào ô nhập đầu tiên của dòng mới.
 */
const t = messages.admin.listEditor;

export interface ListEditorProps<Item extends Keyed> {
  items: readonly Item[];
  onChange: (items: Item[]) => void;
  max: number;
  newItem: () => Item;
  addLabel: string;
  /** Tên của một dòng cho trình đọc màn hình, vd "highlight 2". */
  itemName: (index: number) => string;
  renderItem: (item: Item, index: number) => React.ReactNode;
  disabled?: boolean;
  /** Câu hiện khi danh sách rỗng. */
  empty?: string;
}

export function ListEditor<Item extends Keyed>(props: ListEditorProps<Item>) {
  const {
    items,
    onChange,
    max,
    newItem,
    addLabel,
    itemName,
    renderItem,
    disabled = false,
    empty,
  } = props;
  const rows = React.useRef(new Map<string, HTMLLIElement>());
  const removeButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const addButton = React.useRef<HTMLButtonElement>(null);
  /** Việc tiêu điểm chờ làm SAU lượt render kế — dòng mới chưa có trong DOM lúc bấm. */
  const [focusAfter, setFocusAfter] = React.useState<
    | { kind: 'row' | 'remove'; key: string }
    | { kind: 'move'; key: string; direction: 'up' | 'down' }
    | { kind: 'add' }
    | null
  >(null);

  React.useEffect(() => {
    if (focusAfter === null) return;
    if (focusAfter.kind === 'add') addButton.current?.focus();
    else if (focusAfter.kind === 'remove') removeButtons.current.get(focusAfter.key)?.focus();
    else if (focusAfter.kind === 'move')
      rows.current
        .get(focusAfter.key)
        ?.querySelector<HTMLElement>(`[data-move="${focusAfter.direction}"]`)
        ?.focus();
    else
      rows.current
        .get(focusAfter.key)
        // Ô chọn của kit (`FormSelect`) là một trigger `role="combobox"`, không
        // phải `<select>` — thiếu nó thì dòng điểm đến hay dòng chi phí mới
        // thêm sẽ không nhận tiêu điểm.
        ?.querySelector<HTMLElement>('input, textarea, select, [role="combobox"], button')
        ?.focus();
    setFocusAfter(null);
  }, [focusAfter]);

  const full = items.length >= max;

  function add() {
    if (disabled || full) return;
    const item = newItem();
    onChange([...items, item]);
    setFocusAfter({ kind: 'row', key: item.key });
  }

  function move(index: number, step: -1 | 1) {
    const item = items[index];
    if (item === undefined) return;
    onChange(moveItem(items, index, index + step));
    setFocusAfter({ kind: 'move', key: item.key, direction: step < 0 ? 'up' : 'down' });
  }

  function remove(index: number) {
    const next = removeAt(items, index);
    onChange(next);
    const successor = next[Math.min(index, next.length - 1)];
    setFocusAfter(successor ? { kind: 'remove', key: successor.key } : { kind: 'add' });
  }

  return (
    <div className="grid gap-3">
      {items.length === 0 && empty ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : null}
      <ol className="grid gap-3">
        {items.map((item, index) => (
          <li
            key={item.key}
            ref={(node) => {
              if (node) rows.current.set(item.key, node);
              else rows.current.delete(item.key);
            }}
            className="flex items-start gap-2 rounded-md border p-3"
          >
            <div className="grid flex-1 gap-3">{renderItem(item, index)}</div>
            <div className="flex shrink-0 gap-1">
              {/* Ba nút icon; `aria-label` ghép tên dòng. Dòng đầu khoá "lên", dòng cuối khoá "xuống". */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                focusableWhenDisabled
                disabled={disabled || index === 0}
                aria-label={t.moveUp(itemName(index))}
                data-move="up"
                onClick={() => move(index, -1)}
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                focusableWhenDisabled
                disabled={disabled || index === items.length - 1}
                aria-label={t.moveDown(itemName(index))}
                data-move="down"
                onClick={() => move(index, 1)}
              >
                <ArrowDownIcon aria-hidden="true" />
              </Button>
              <Button
                ref={(node: HTMLButtonElement | null) => {
                  if (node) removeButtons.current.set(item.key, node);
                  else removeButtons.current.delete(item.key);
                }}
                type="button"
                variant="ghost"
                size="icon"
                focusableWhenDisabled
                disabled={disabled}
                aria-label={t.remove(itemName(index))}
                onClick={() => remove(index)}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          focusableWhenDisabled
          disabled={disabled || full}
          onClick={add}
        >
          <PlusIcon aria-hidden="true" />
          {addLabel}
        </Button>
        {full ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t.limit(max)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
