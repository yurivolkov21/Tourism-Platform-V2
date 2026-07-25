import { AlertCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Panel lỗi tối giản cho route boundary (error / global-error). Thuần trình
// bày, KHÔNG hook — để dùng được trong cả server và client boundary. Cố ý
// không ảnh, không chrome: nó phải render được khi phần còn lại đã hỏng.
export function ErrorState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertCircleIcon className="size-8" aria-hidden="true" />
      </span>
      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="text-pretty text-muted-foreground">{body}</p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
