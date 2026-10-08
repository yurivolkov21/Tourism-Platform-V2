'use client';

import { Checkbox } from '@tourism/ui/components/checkbox';
import { useEffect, useId, useState } from 'react';
import { readPrepChecked } from '@/lib/get-ready';

/**
 * Ô tích "Budget for what's not included" (spec P7 §2.4) — nhớ trên ĐÚNG máy này bằng
 * `localStorage`, khoá theo mã đơn (`prepStorageKey`).
 *
 * Đọc sau khi mount chứ không lúc khởi tạo state: server không có `localStorage`, đọc lúc
 * render là HTML của server và của client lệch nhau. Mọi lần chạm storage đều bọc `try`:
 * chế độ riêng tư hay trình duyệt chặn storage thì vẫn tích được trên màn hình, chỉ không nhớ.
 *
 * `<label htmlFor>` trỏ vào `id` của `Checkbox`: Base UI tự nối `aria-labelledby` tới label
 * (cùng khuôn `login-form.tsx`, `tours-filters.tsx`).
 */
export function PrepChecklist({
  storageKey,
  items,
}: {
  storageKey: string;
  items: readonly string[];
}) {
  const baseId = useId();
  const [checked, setChecked] = useState<readonly string[]>([]);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      raw = null;
    }
    setChecked(readPrepChecked(raw, items));
  }, [storageKey, items]);

  function toggle(item: string, on: boolean) {
    // Giữ thứ tự của danh sách chứ không thứ tự bấm — bản lưu không phụ thuộc cách khách tích.
    const next = items.filter((entry) => (entry === item ? on : checked.includes(entry)));
    setChecked(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage bị chặn: tích vẫn hiện trên màn hình, chỉ không nhớ sau khi tải lại.
    }
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item, index) => {
        const id = `${baseId}-${index}`;
        return (
          <li key={item}>
            <label
              htmlFor={id}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-[5px] text-[12.5px]"
            >
              <Checkbox
                id={id}
                checked={checked.includes(item)}
                onCheckedChange={(on) => toggle(item, on)}
              />
              {item}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
