import { cn } from '@tourism/ui/lib/utils';
import { ImageIcon } from 'lucide-react';

// Placeholder ảnh chuẩn toàn trang (review #10): chính sách static-first của
// user — dùng placeholder thay ảnh thật, khi nào chốt trang mới thay media
// thật. Nền muted + sọc chéo mảnh từ token border, icon + nhãn mô tả ảnh
// sẽ nằm ở đó. Bọc trong scope `dark` nếu cần bản tối (vd nền hero).
export function ImagePlaceholder({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-muted',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60 [background:repeating-linear-gradient(45deg,transparent_0_14px,var(--border)_14px_15px)]"
      />
      <span className="relative flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
        <ImageIcon className="size-6" aria-hidden="true" />
        {label ? <span className="text-xs">{label}</span> : null}
      </span>
    </div>
  );
}
