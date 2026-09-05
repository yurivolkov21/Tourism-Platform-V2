import { Card, CardContent } from '@tourism/ui/components/card';
import { AlertCircleIcon } from 'lucide-react';

/**
 * Ô báo "khối này không tải được" — dùng khi một trang gồm NHIỀU khối độc lập
 * và một khối hỏng không được phép kéo cả trang vào `app/error.tsx` (ADR-0036
 * AMEND 2, trang `/`). Trang vùng một-khối vẫn theo luật cũ: không nuốt lỗi,
 * rơi thẳng vào error.tsx.
 */
export function SectionError({ message }: { message: string }) {
  return (
    <Card role="alert">
      <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
        <AlertCircleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        <span>{message}</span>
      </CardContent>
    </Card>
  );
}
