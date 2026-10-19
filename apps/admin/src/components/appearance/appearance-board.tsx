'use client';

import type { AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { SlotCard } from '@/components/appearance/slot-card';
import type { SlotGroupVM } from '@/lib/appearance-view';
import type { AppearanceActions } from '@/lib/appearance-write';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';

/**
 * Trang `/appearance` (spec P4f Appearance §6.1): tám nhóm theo trang web, đầu mỗi nhóm có link mở
 * trang ấy trên site; mỗi khe một thẻ. Kho ảnh thư viện tải MỘT lần cho cả trang — mọi hộp Replace
 * dùng chung bản đã tải (kit `PhotoLibraryDialog` để nơi dùng giữ nó).
 */
const t = messages.admin.appearance;

export function AppearanceBoard({
  groups,
  actions,
  loadLibrary,
}: {
  groups: SlotGroupVM[];
  actions: AppearanceActions;
  loadLibrary: LoadPhotoLibraryAction;
}) {
  const [library, setLibrary] = useState<AdminPhotoLibrary | null>(null);

  return (
    <div className="flex flex-col gap-8 px-4 lg:px-6">
      <p className="max-w-prose text-sm text-muted-foreground">{t.intro}</p>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`appearance-${group.key}`} className="grid gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id={`appearance-${group.key}`} className="text-lg font-semibold tracking-tight">
              {group.label}
            </h2>
            <span className="text-sm text-muted-foreground">{group.countLabel}</span>
            <a
              href={group.pageHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.viewPageLabel(group.label)}
              className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
            >
              {t.viewPage}
              <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            </a>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.slots.map((slot) => (
              <li key={slot.key}>
                <SlotCard
                  slot={slot}
                  actions={actions}
                  library={library}
                  onLibraryChange={setLibrary}
                  loadLibrary={loadLibrary}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
