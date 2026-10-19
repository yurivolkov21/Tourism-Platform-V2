'use client';

import type { AdminMediaQueue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tourism/ui/components/table';
import { UserRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { TableThumb } from '@/components/kit/table-thumb';
import { type QueueRowVM, queueSummary } from '@/lib/media-view';

/**
 * Tab Cleanup queue (spec P4f Media §6.3, ADR-0060 §4): hai dòng tóm tắt (dọn bật hay tắt, lượt
 * dọn gần nhất) và bảng các ảnh tải lên đang chờ số phận. CHỈ ĐỌC — không có nút xoá, xếp lại hay
 * bỏ khỏi hàng: muốn bỏ một ảnh thì gỡ nó khỏi trang đang dùng.
 */
const t = messages.admin.media;
const q = t.queue;

export function MediaQueueTab({ queue, rows }: { queue: AdminMediaQueue; rows: QueueRowVM[] }) {
  const summary = queueSummary(queue);
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="grid max-w-prose gap-1 text-sm">
        <p>{q.intro}</p>
        <p className={queue.gcEnabled ? 'text-muted-foreground' : 'font-medium'}>
          {summary.status}
        </p>
        <p className="text-muted-foreground">{summary.last}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {q.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table aria-label={q.caption}>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-14">{q.columns.photo}</TableHead>
                <TableHead>{q.columns.kind}</TableHead>
                <TableHead>{q.columns.owner}</TableHead>
                <TableHead>{q.columns.state}</TableHead>
                <TableHead>{q.columns.queued}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.publicId}>
                  <TableCell>
                    {row.avatar ? (
                      // Avatar không bao giờ hiện ảnh khách (ADR-0060 §4) — một biểu tượng giữ chỗ.
                      <span className="flex size-10 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                        <UserRoundIcon aria-hidden="true" className="size-4" />
                      </span>
                    ) : (
                      <TableThumb src={row.thumbUrl} emptyLabel={q.noPhoto} />
                    )}
                  </TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal wrap-anywhere">
                    {row.ownerHref ? (
                      <Link href={row.ownerHref} className="underline underline-offset-4">
                        {row.owner}
                      </Link>
                    ) : (
                      row.owner
                    )}
                  </TableCell>
                  <TableCell>{row.stateLabel}</TableCell>
                  <TableCell className="tabular-nums">{row.queuedLabel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
