import { cn } from '@tourism/ui/lib/utils';

// Mark: PrebuiltUI free placeholder logos ("Slidex" — user chọn ở review vòng 1,
// thay mark "Vectory" ban đầu) — chỉ dùng phần mark hai viên kim cương lồng nhau,
// wordmark là chữ của mình (Literata). Viên sau nhuộm primary, viên trước theo
// foreground nên tự đổi theo light/dark. Placeholder logo (không độc quyền) —
// đủ cho capstone; thương mại hóa nghiêm túc thì đặt mark riêng.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 46 33" aria-hidden="true" className="h-6 w-auto shrink-0">
        <path
          className="fill-primary"
          d="M30.966 12.968 19.938 1.945a2.75 2.75 0 0 0-3.891 0l-14.1 14.093a2.75 2.75 0 0 0 0 3.89L12.975 30.95a2.75 2.75 0 0 0 3.891 0l14.1-14.094a2.75 2.75 0 0 0 0-3.889"
        />
        <path
          className="fill-foreground"
          d="M44.032 12.968 33.004 1.945a2.75 2.75 0 0 0-3.89 0l-14.1 14.093a2.75 2.75 0 0 0 0 3.89L26.041 30.95a2.75 2.75 0 0 0 3.89 0l14.1-14.094a2.75 2.75 0 0 0 0-3.889"
        />
      </svg>
      {/* text-foreground tường minh để wordmark đọc token theo scope (vd span.dark trên hero) */}
      <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
        {/* Wordmark "nexora" (đổi từ "tourism" 19/08 — user lấy lại tên Nexora của
            bản tiền nhiệm): viết hoa chữ N (user chốt 21/08) + hai tông, phần nhấn là đuôi "ora". */}
        Nex<span className="text-primary-emphasis">ora</span>
      </span>
    </span>
  );
}
