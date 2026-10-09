import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';

/**
 * Khung thẻ của trang Settings (spec 09/10 §2, phương án C): tiêu đề serif kèm một dòng mô tả
 * muted, thân là danh sách dòng ngăn bằng vạch mảnh. Dùng cho Personal information và Password;
 * Danger zone tự mang khung viền đỏ riêng (`DeleteAccount`).
 */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-4 pt-4 pb-3 sm:px-6 sm:pt-4.5 sm:pb-3.5">
        <h2 className="font-heading text-lg leading-tight font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <ul className="divide-y">{children}</ul>
    </section>
  );
}

/**
 * Một dòng "nhãn trái — giá trị — hành động phải" (spec 09/10 §2).
 *
 * - Từ `lg`: ba cột `10rem | giá trị | hành động` trên MỘT hàng.
 * - Dưới `lg`: hai hàng — nhãn và hành động ở hàng trên, giá trị ở hàng dưới chiếm trọn bề ngang.
 * - Đang sửa: nền primary nhạt; `children` (form) THAY giá trị và hành động, không xếp chồng dưới
 *   giá trị — bản 10/08 xếp chồng thì nhãn hiện hai lần và có hai nút Cancel cạnh nhau.
 *
 * Mọi ô đặt chỗ TƯỜNG MINH (`col-*`, `row-*`): DOM giữ thứ tự nhãn → giá trị → hành động cho trình
 * đọc màn hình, còn mắt thấy hành động lên cạnh nhãn ở khổ hẹp.
 */
export function SettingsRow({
  label,
  hint,
  value,
  action,
  editing = false,
  children,
}: {
  label: string;
  /** Dòng gợi ý dưới nhãn (vd Phone) — hiện ở cả lúc xem lẫn lúc sửa. */
  hint?: string;
  value?: ReactNode;
  action?: ReactNode;
  editing?: boolean;
  /** Form THAY giá trị và hành động khi đang sửa dòng này. */
  children?: ReactNode;
}) {
  return (
    <li
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3.5 sm:px-6 lg:grid-cols-[10rem_minmax(0,1fr)_auto] lg:gap-x-4.5',
        editing ? 'items-start bg-primary/5' : 'items-center',
      )}
    >
      <div className="col-1 row-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {editing ? (
        <div className="col-span-full row-2 min-w-0 lg:col-[2/-1] lg:row-1">{children}</div>
      ) : (
        <>
          <div className="col-span-full row-2 min-w-0 text-sm break-words text-foreground lg:col-2 lg:row-1">
            {value}
          </div>
          <div className="col-2 row-1 justify-self-end lg:col-3">{action}</div>
        </>
      )}
    </li>
  );
}

/**
 * Nút "Edit" của một dòng. Tên đọc mang tên trường ("Edit Full name"): ba chữ "Edit" trần nghe y
 * hệt nhau với trình đọc màn hình. `px-0`: variant link vẫn mang padding ngang của size, 10px đó
 * đẩy chữ lệch khỏi mép phải thẻ. Nút chỉ hiện khi dòng đang ĐÓNG — lúc mở, form thay chỗ nó.
 */
export function EditButton({ field, onClick }: { field: string; onClick: () => void }) {
  const s = messages.accountProfile.summary;
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto px-0"
      aria-expanded={false}
      aria-label={s.editAria(field)}
      onClick={onClick}
    >
      {s.edit}
    </Button>
  );
}
