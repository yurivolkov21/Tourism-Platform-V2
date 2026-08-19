import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Một card dữ kiện — dựng bám `.fcard` / `.fcard-h` / `.fcard-b` của wireframe:
 * header có icon + nhãn và một đường kẻ ngăn, thân chứa giá trị, câu mô tả, và
 * (nếu có) một link nhỏ đẩy xuống đáy bằng `margin-top:auto`.
 *
 * `note` đến từ bốn cột `fact*Note` mở ở [ADR-0023] — trước đó card thiếu hẳn
 * dòng này nên cao ~110 thay vì 197 của bản duyệt. **Vẫn nullable**: 30 tour ×
 * 4 câu là việc soạn nội dung thật và tour mới tạo ở admin sẽ trống lúc đầu,
 * nên card thiếu mô tả phải đọc được, chỉ là thấp hơn.
 */
export function FactCard({
  icon,
  label,
  value,
  note,
  link,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** Một câu mô tả dưới giá trị. `null` là hợp lệ — bỏ hẳn dòng, không in rỗng. */
  note?: string | null;
  /** Chỉ gắn khi thật sự có chỗ để tới — link chết còn tệ hơn không có link. */
  link?: { href: string; label: string };
}) {
  return (
    <div
      data-testid="fact-card"
      className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-muted-foreground [&_svg]:size-4">
        {icon}
        <span className="text-sm leading-[20px]">{label}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm leading-[20px] font-medium text-foreground">{value}</p>
        {note ? <p className="text-[13px] leading-5 text-muted-foreground">{note}</p> : null}
        {link ? (
          <a
            href={link.href}
            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary-emphasis hover:underline"
          >
            <ArrowRightIcon className="size-3 shrink-0" aria-hidden="true" />
            {link.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
