import { cn } from '@tourism/ui/lib/utils';

// PORT NGUYÊN từ apps/web/src/components/logo.tsx (đồng bộ nhận diện — user
// nhắc 20/08: mọi chỗ phải dùng mark "Slidex" hai viên kim cương, không chế
// ô "N"). Mark: PrebuiltUI free placeholder ("Slidex"), viên sau nhuộm
// primary, viên trước theo foreground; wordmark chữ thường Literata hai tông.
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
      <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
        nex<span className="text-primary-emphasis">ora</span>
      </span>
    </span>
  );
}
