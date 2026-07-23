import { cn } from '@tourism/ui/lib/utils';

// Mark: PrebuiltUI free placeholder logos ("Vectory") — chỉ dùng phần mark,
// wordmark là chữ của mình (Literata). Lá nhuộm primary, chấm theo foreground
// nên tự đổi theo light/dark. Placeholder logo (không độc quyền) — đủ cho
// capstone; thương mại hóa nghiêm túc thì đặt mark riêng (spec Home §Quyết định 2).
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 63 77" aria-hidden="true" className="h-7 w-auto shrink-0">
        <path
          className="fill-primary"
          d="M33.817 52.382c0-15.988 12.96-28.948 28.948-28.948v17.585c0 15.987-12.96 28.948-28.948 28.948zm-4.869 0c0-15.988-12.96-28.948-28.948-28.948v17.585c0 15.987 12.96 28.948 28.948 28.948z"
        />
        <path
          className="fill-foreground"
          d="M31.487 0c0 8.764 7.049 15.881 15.786 15.992l.207.001-.207.001c-8.737.11-15.786 7.228-15.786 15.992 0-8.833-7.16-15.993-15.993-15.993 8.833 0 15.993-7.16 15.993-15.993"
        />
      </svg>
      <span className="font-heading text-xl font-semibold tracking-tight">
        tour<span className="text-primary">ism</span>
      </span>
    </span>
  );
}
