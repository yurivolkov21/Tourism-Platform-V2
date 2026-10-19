'use client';

import type { AdminMediaItem, AdminMediaQueue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tourism/ui/components/tabs';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { StatCardRow } from '@/components/kit/stat-card';
import { type AddPhotosDestination, AddPhotosMenu } from '@/components/media/add-photos-menu';
import { MediaDrawer } from '@/components/media/media-drawer';
import { MediaGrid } from '@/components/media/media-grid';
import { MediaQueueTab } from '@/components/media/media-queue';
import { MediaToolbar } from '@/components/media/media-toolbar';
import { mediaHref, parseMediaSearchParams } from '@/lib/media-query';
import {
  filterMedia,
  mediaStats,
  toMediaItemVM,
  toMediaStatCards,
  toQueueRowVM,
} from '@/lib/media-view';
import { licenseSuggestions, type UpdateMediaAction } from '@/lib/media-write';
import { rawSearchParamsFrom } from '@/lib/table-query';

/**
 * Trang `/media` (spec P4f Media §6, ADR-0060): ba thẻ số đầu trang, hai tab In use và Cleanup
 * queue. Danh sách đọc trọn một lần nên lọc, tìm và đổi tab chạy ngay ở đây: URL đổi bằng
 * `history.pushState` (Next đồng bộ `useSearchParams` theo nó), không kéo lại server — trừ
 * `router.refresh()` sau một lần lưu.
 */
const t = messages.admin.media;

const navigate = (href: string) => window.history.pushState(null, '', href);

export function MediaLibrary({
  items,
  queue,
  destinations,
  update,
}: {
  items: AdminMediaItem[];
  queue: AdminMediaQueue;
  /** Điểm đến cho nút Add photos to the library (Media B). */
  destinations: readonly AddPhotosDestination[];
  update: UpdateMediaAction;
}) {
  const searchParams = useSearchParams();
  const query = parseMediaSearchParams(rawSearchParamsFrom(new URLSearchParams(searchParams)));
  const vms = useMemo(() => items.map(toMediaItemVM), [items]);
  const rows = useMemo(() => queue.rows.map(toQueueRowVM), [queue.rows]);
  const licenses = useMemo(() => licenseSuggestions(items), [items]);
  const shown = filterMedia(vms, query);
  /** Ảnh đang mở ở ngăn chi tiết — theo publicId để bản tươi sau `refresh` thay vào chỗ cũ. */
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId === null ? null : (vms.find((vm) => vm.publicId === openId) ?? null);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 lg:px-6">
        <p className="max-w-prose text-sm text-muted-foreground">{t.intro}</p>
        <AddPhotosMenu destinations={destinations} />
      </div>
      <StatCardRow cards={toMediaStatCards(mediaStats(vms, queue), queue.graceDays)} />
      <Tabs
        value={query.tab}
        onValueChange={(next) =>
          navigate(mediaHref(query, { tab: next === 'queue' ? 'queue' : 'inUse' }))
        }
        className="gap-4"
      >
        <div className="px-4 lg:px-6">
          <TabsList aria-label={t.tabs.label}>
            <TabsTrigger value="inUse">{t.tabs.inUse}</TabsTrigger>
            <TabsTrigger value="queue">{t.tabs.queue}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="inUse" className="flex flex-col gap-4">
          <MediaToolbar
            query={query}
            shownCount={shown.length}
            totalCount={vms.length}
            onNavigate={navigate}
          />
          <MediaGrid
            items={shown}
            onOpen={setOpenId}
            onClearFilters={() =>
              navigate(mediaHref(query, { used: null, show: null, search: null }))
            }
          />
        </TabsContent>
        <TabsContent value="queue">
          <MediaQueueTab queue={queue} rows={rows} />
        </TabsContent>
      </Tabs>
      <MediaDrawer
        item={open}
        licenses={licenses}
        update={update}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
