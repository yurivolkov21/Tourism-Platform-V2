'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { CircleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { StableLabel } from '@/components/kit/stable-label';
import { useReportUnsaved } from '@/components/kit/unsaved-changes';
import type { SectionBanner } from '@/lib/use-section-save';

/**
 * Khung chung của các form tab (spec F17 §2i): dải báo TRÊN nội dung, rồi nội
 * dung, rồi chân form — ghi chú hệ quả cạnh nút Save.
 *
 * - Nút Save chỉ sáng khi form có thay đổi; khoá bằng `focusableWhenDisabled`
 *   để bấm Save xong (nút khoá lúc đang lưu) tiêu điểm không rơi về `<body>`.
 * - Chữ nút trong `StableLabel` giữa "Save changes" / "Saving…": nút không co giãn.
 * - Tự báo "có thay đổi chưa lưu" cho `UnsavedChangesProvider` của khu làm việc.
 * - Server có bản mới hơn thứ đang sửa (`serverChanged`) → dải stale dù lần lưu
 *   chưa hỏng. Reload đi qua `onReload` của form: form tự nạp bản mới, không
 *   phải gỡ rồi dựng lại (vòng review F17).
 */
const t = messages.admin.tours.editor;
const SAVE_LABELS = [t.save, t.saving] as const;

const STALE: SectionBanner = { kind: 'stale' };

export function EditorFormFrame({
  dirty,
  pending,
  banner,
  serverChanged = false,
  note,
  blockedNote,
  onSubmit,
  onReload,
  children,
}: {
  dirty: boolean;
  pending: boolean;
  banner: SectionBanner | null;
  /** Server đã có bản mới hơn thứ form đang sửa (`useTourFormState`). */
  serverChanged?: boolean;
  /** Câu nói hệ quả của lần lưu, hiện cạnh nút Save. */
  note?: string;
  /**
   * Lý do Save đang khoá dù form có thay đổi (tab Photos: còn ảnh đang tải lên) —
   * in thay chỗ `note`. Không dùng `pending`: nhãn nút sẽ thành "Saving…" trong khi
   * chẳng có gì đang lưu.
   */
  blockedNote?: string;
  onSubmit: () => void;
  /** Nút Reload của mọi dải báo — form nạp bản server mới. */
  onReload: () => void;
  children: React.ReactNode;
}) {
  useReportUnsaved(dirty);
  const shown = banner ?? (serverChanged ? STALE : null);

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !pending && blockedNote === undefined) onSubmit();
      }}
    >
      {shown ? <FormBanner banner={shown} onReload={onReload} /> : null}
      {children}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        {(blockedNote ?? note) ? (
          <p className="text-xs text-muted-foreground">{blockedNote ?? note}</p>
        ) : null}
        <Button
          type="submit"
          focusableWhenDisabled
          disabled={!dirty || pending || blockedNote !== undefined}
        >
          <StableLabel label={pending ? t.saving : t.save} reserve={SAVE_LABELS} />
        </Button>
      </div>
    </form>
  );
}

/** Dải báo của một lần Save hỏng — giọng cảnh báo cho stale/notReady, đỏ cho lỗi. */
function FormBanner({ banner, onReload }: { banner: SectionBanner; onReload: () => void }) {
  const reload = (
    <Button type="button" variant="outline" size="sm" onClick={onReload}>
      {t.banners.reload}
    </Button>
  );
  const destructive = banner.kind === 'error';

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        destructive
          ? 'border-destructive/40 bg-destructive/10 text-destructive-emphasis'
          : 'border-warning/50 bg-warning/10',
      )}
    >
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="grid flex-1 gap-2">
        {banner.kind === 'stale' ? (
          <>
            <p>{t.banners.stale}</p>
            <div>{reload}</div>
          </>
        ) : null}
        {banner.kind === 'notReady' && banner.issues.length > 0 ? (
          <>
            <p>{t.banners.notReady}</p>
            <ul className="grid list-disc gap-0.5 pl-4">
              {banner.issues.map((issue) => (
                <li key={issue.key}>
                  <Link
                    href={issue.href}
                    className="underline underline-offset-4 hover:no-underline"
                  >
                    {issue.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {banner.kind === 'notReady' && banner.issues.length === 0 ? (
          <>
            <p>{t.banners.notReadyUnknown}</p>
            <div>{reload}</div>
          </>
        ) : null}
        {banner.kind === 'error' ? (
          <>
            <p>{banner.message}</p>
            {banner.uncertain ? <div>{reload}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
