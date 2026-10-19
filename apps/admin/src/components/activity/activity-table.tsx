'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { AdminActivityActorOption } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { BoxIcon, ClockIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import {
  ActivityAreaMenu,
  ActivityClearFilters,
  ActivityDateRange,
  ActivityPeopleMenu,
} from '@/components/activity/activity-toolbar';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { type ActivityQuery, activityHref, hasActivityFilters } from '@/lib/activity-query';
import type { ActivityRowVM } from '@/lib/activity-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/activity` (ADR-0061, spec §6) — dựng trên kit như mọi bảng vùng. Cột: When · Who ·
 * What · Item. Component KHÔNG tự tính gì: mọi con chữ do `toActivityRowVM` nấu sẵn.
 */
const t = messages.admin.activity.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, ActivityRowVM>();

/** Nhãn cho menu ẩn/hiện — What là cột chính nên không ẩn được. */
const COLUMN_LABELS: Record<string, string> = {
  when: t.columns.when,
  who: t.columns.who,
  item: t.columns.item,
};

const COLUMN_ICONS = { when: ClockIcon, who: UserIcon, item: BoxIcon };

const columns = columnHelper.columns([
  columnHelper.accessor('when', {
    header: t.columns.when,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-muted-foreground">{row.original.when}</div>
    ),
  }),
  columnHelper.accessor('who', {
    header: t.columns.who,
    cell: ({ row }) => (
      // Sàn bề rộng như cột tên của /users: bảng tự co thì tên dài không bị bóp còn 0px.
      <div className="flex min-w-40 items-center gap-2">
        <span className="max-w-48 truncate font-medium" title={row.original.who}>
          {row.original.who}
        </span>
        <Badge variant={row.original.roleVariant} className="px-1.5">
          {row.original.roleLabel}
        </Badge>
      </div>
    ),
  }),
  columnHelper.accessor('what', {
    header: t.columns.what,
    cell: ({ row }) => (
      <div className="grid min-w-48">
        <span className="font-medium">{row.original.what}</span>
        {row.original.summary ? (
          <span className="text-xs text-muted-foreground">{row.original.summary}</span>
        ) : null}
      </div>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor((row) => row.item?.label ?? '', {
    id: 'item',
    header: t.columns.item,
    cell: ({ row }) => {
      const item = row.original.item;
      if (!item) return <span className="text-muted-foreground">—</span>;
      if (item.href) {
        return (
          <Link
            href={item.href}
            aria-label={t.viewLabel(item.label)}
            className="block max-w-72 truncate font-medium text-foreground underline-offset-4 hover:underline"
            title={item.label}
          >
            {item.label}
          </Link>
        );
      }
      return (
        <span
          className={
            item.isFallback
              ? 'block max-w-72 truncate text-muted-foreground italic'
              : 'block max-w-72 truncate'
          }
          title={item.label}
        >
          {item.label}
        </span>
      );
    },
  }),
]);

export interface ActivityTableProps {
  rows: ActivityRowVM[];
  query: ActivityQuery;
  /** Người có trong nhật ký, cho ô lọc People — do chính response mang về. */
  actors: readonly AdminActivityActorOption[];
  total: number;
  totalPages: number;
}

export function ActivityTable({ rows, query, actors, total, totalPages }: ActivityTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={
        <>
          <ActivityPeopleMenu query={query} actors={actors} />
          <ActivityAreaMenu query={query} />
        </>
      }
      actions={
        <>
          <ActivityDateRange query={query} />
          <ActivityClearFilters query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => activityHref(query, { page })}
          hrefForPageSize={(limit) => activityHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={hasActivityFilters(query) ? t.emptyFiltered : t.empty} />
    </DataTableFrame>
  );
}
