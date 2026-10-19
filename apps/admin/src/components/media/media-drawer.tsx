'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@tourism/ui/components/drawer';
import { ScrollArea } from '@tourism/ui/components/scroll-area';
import { CopyIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { DRAWER_SHELL } from '@/components/kit/drawer-shell';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { SafeImg } from '@/components/kit/safe-img';
import { MediaForm } from '@/components/media/media-form';
import type { MediaItemVM } from '@/lib/media-view';
import type { UpdateMediaAction } from '@/lib/media-write';

/**
 * Ngăn chi tiết của một ảnh (spec P4f Media §6.2) — cùng vỏ panel bên phải với `JsonDrawer`: ảnh
 * lớn, số đo, tên file bấm để chép, mọi chỗ dùng kèm link tới trình sửa, rồi form alt và ghi công.
 *
 * Trang giữ MỘT ngăn, mở theo publicId: sau một lần lưu `router.refresh()` đưa bản tươi về, ngăn
 * vẽ lại bằng nó và form dựng lại theo version mới. Ảnh biến mất khỏi danh sách (không còn chỗ dùng
 * nào) thì ngăn tự đóng.
 */
const t = messages.admin.media;
const d = t.drawer;

export function MediaDrawer({
  item,
  licenses,
  update,
  onClose,
}: {
  item: MediaItemVM | null;
  licenses: string[];
  update: UpdateMediaAction;
  onClose: () => void;
}) {
  /** Đang lưu thì không đóng ngăn — kết quả lưu phải có chỗ để hiện. */
  const [pending, setPending] = React.useState(false);
  /**
   * Ruột ngăn GIỮ LẠI qua animation đóng, cùng lý do ở `JsonDrawer`: `item` về `null` là ngăn còn
   * trượt ra 450ms, không giữ thì người dùng nhìn một tấm trống trượt đi.
   */
  const last = React.useRef<MediaItemVM | null>(null);
  const shown = item ?? last.current;
  React.useEffect(() => {
    if (item !== null) last.current = item;
  });

  return (
    <Drawer
      open={item !== null}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
      swipeDirection="right"
    >
      <DrawerContent className={DRAWER_SHELL}>
        {shown === null ? null : (
          <>
            <DrawerHeader className="flex-row items-start justify-between gap-3 border-b p-5">
              <div className="grid min-w-0 gap-0.5">
                <DrawerTitle>{d.title}</DrawerTitle>
                <DrawerDescription className="wrap-anywhere">{shown.summary}</DrawerDescription>
              </div>
              <DrawerClose render={<Button variant="ghost" size="icon-sm" />}>
                <XIcon />
                <span className="sr-only">{d.close}</span>
              </DrawerClose>
            </DrawerHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-5 p-5">
                <SafeImg
                  src={shown.previewUrl}
                  alt={shown.item.alt ?? ''}
                  className="max-h-80 w-full rounded-lg border bg-muted object-contain"
                  brokenClassName="h-48"
                />
                <MediaFacts item={shown} />
                <MediaUsages item={shown} />
                <MediaForm
                  // Version đổi (lưu xong, hay ai đó sửa ở nơi khác) là form dựng lại từ bản tươi.
                  key={`${shown.publicId}:${shown.version}`}
                  item={shown.item}
                  licenses={licenses}
                  update={update}
                  onPendingChange={setPending}
                />
              </div>
            </ScrollArea>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function MediaFacts({ item }: { item: MediaItemVM }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(item.publicId);
      toast.success(d.copied);
    } catch {
      toast.error(d.copyFailed);
    }
  }
  return (
    <dl className="grid gap-2 text-sm">
      <LabelValueRow label={d.facts.dimensions} value={item.sizeLabel} />
      {item.bytesLabel ? <LabelValueRow label={d.facts.fileSize} value={item.bytesLabel} /> : null}
      {item.formatLabel ? <LabelValueRow label={d.facts.format} value={item.formatLabel} /> : null}
      <LabelValueRow label={d.facts.source} value={item.sourceLabel} />
      <LabelValueRow
        label={d.facts.file}
        value={
          <span className="flex items-start gap-1">
            <span className="min-w-0 font-mono text-xs wrap-anywhere">{item.publicId}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={d.copy}
              title={d.copy}
              onClick={() => void copy()}
            >
              <CopyIcon />
            </Button>
          </span>
        }
      />
    </dl>
  );
}

function MediaUsages({ item }: { item: MediaItemVM }) {
  const headingId = `media-usages-${item.publicId}`;
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h3 id={headingId} className="text-sm font-medium">
        {d.usedInCount(item.usages.length)}
      </h3>
      <ul className="grid gap-1.5 text-sm">
        {item.usages.map((usage) => (
          <li key={usage.key} className="flex flex-wrap items-baseline gap-x-2">
            <span className="w-14 shrink-0 text-muted-foreground">{usage.kind}</span>
            {usage.href ? (
              <Link
                href={usage.href}
                aria-label={d.edit(`${usage.kind} · ${usage.name}`)}
                className="min-w-0 underline underline-offset-4 wrap-anywhere"
              >
                {usage.name}
              </Link>
            ) : (
              <span className="min-w-0 text-muted-foreground wrap-anywhere">{usage.name}</span>
            )}
            {usage.note ? (
              <span className="text-xs text-muted-foreground">{usage.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
