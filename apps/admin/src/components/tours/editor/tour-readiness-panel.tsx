import type { TourReadiness } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { readinessIssues } from '@/lib/tour-editor-view';

/**
 * Khung "đủ để bán chưa" ở đầu khu làm việc (spec F17 §2c, §2g) — server
 * component, đọc `readiness` mà `admin.tours.get` đã tính bằng `tourReadiness`.
 *
 * Đủ thì một câu yên tâm; thiếu thì mỗi chỗ thiếu một link tới ĐÚNG tab kèm
 * `#id` của ô cần sửa. `role="status"`: thông tin có sẵn lúc mở trang, không
 * phải sự kiện vừa xảy ra — không được ngắt lời trình đọc màn hình.
 */
const t = messages.admin.tours.editor.readiness;

export function TourReadinessPanel({
  readiness,
  slug,
}: {
  readiness: TourReadiness;
  slug: string;
}) {
  const issues = readinessIssues(readiness, slug);

  if (issues.length === 0) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm"
      >
        <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        <div className="grid gap-0.5">
          <p className="font-medium">{t.ready}</p>
          <p className="text-muted-foreground">{t.readyBody}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm"
    >
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        <p className="font-medium">{t.missingTitle}</p>
        <ul className="grid list-disc gap-0.5 pl-4">
          {issues.map((issue) => (
            <li key={issue.key}>
              <Link href={issue.href} className="underline underline-offset-4 hover:no-underline">
                {issue.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
