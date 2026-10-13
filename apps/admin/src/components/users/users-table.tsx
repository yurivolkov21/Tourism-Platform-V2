'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@tourism/ui/components/avatar';
import { Badge } from '@tourism/ui/components/badge';
import { CalendarIcon, ClockIcon, ShieldIcon, TagIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { UsersClearFilters, UsersSearch, UsersViewTabs } from '@/components/users/users-toolbar';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';
import { type UsersQuery, usersHref } from '@/lib/users-query';
import { type UserRowVM, userRoleBadgeVariant, userStatusBadgeVariant } from '@/lib/users-view';

/**
 * Bảng `/users` (P4f, spec §7.1) — dựng trọn trên kit như mọi bảng vùng (user chốt 31/08:
 * mọi bảng một kiểu). Cột: User (ảnh, tên là link, email) · Role · Status · Joined ·
 * Last active. Component KHÔNG tự tính gì: mọi con chữ do `toUserRowVM` nấu sẵn.
 */
const t = messages.admin.users.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, UserRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  roleLabel: t.columns.role,
  statusLabel: t.columns.status,
  joined: t.columns.joined,
  lastActive: t.columns.lastActive,
};

const COLUMN_ICONS = {
  roleLabel: ShieldIcon,
  statusLabel: TagIcon,
  joined: CalendarIcon,
  lastActive: ClockIcon,
};

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: t.columns.user,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-8">
          {/* Ảnh trang trí — tên đứng ngay cạnh nên alt rỗng. */}
          {row.original.image ? <AvatarImage src={row.original.image} alt="" /> : null}
          <AvatarFallback>{row.original.initial}</AvatarFallback>
        </Avatar>
        {/* Sàn 12rem, không phải min-w-0: hai dòng `truncate` không giữ được bề rộng nào trong
            bảng tự co, nên ở khổ 390px và 768px Chrome bóp cột còn đúng ảnh đại diện, tên (link
            duy nhất sang trang chi tiết) rộng 0px — đo bằng CSS build thật, plan P4f Task 13.
            Có sàn thì bảng tự cuộn ngang trong khung của kit, trang không tràn. */}
        <div className="grid min-w-48">
          <Link
            href={row.original.href}
            aria-label={t.viewLabel(row.original.name)}
            className="truncate font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.name}
          </Link>
          <span
            className="max-w-64 truncate text-xs text-muted-foreground"
            title={row.original.email}
          >
            {row.original.email}
          </span>
        </div>
      </div>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor('roleLabel', {
    header: t.columns.role,
    cell: ({ row }) => (
      <Badge variant={userRoleBadgeVariant(row.original.role)} className="px-1.5">
        {row.original.roleLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('statusLabel', {
    header: t.columns.status,
    cell: ({ row }) => (
      <Badge variant={userStatusBadgeVariant(row.original.status)} className="px-1.5">
        {row.original.statusLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('joined', {
    header: t.columns.joined,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-muted-foreground">{row.original.joined}</div>
    ),
  }),
  columnHelper.accessor('lastActive', {
    header: t.columns.lastActive,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-muted-foreground">{row.original.lastActive}</div>
    ),
  }),
]);

export interface UsersTableProps {
  rows: UserRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: UsersQuery;
  total: number;
  totalPages: number;
}

export function UsersTable({ rows, query, total, totalPages }: UsersTableProps) {
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
      views={<UsersViewTabs query={query} />}
      actions={
        <>
          <UsersSearch query={query} />
          <UsersClearFilters query={query} />
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
          hrefForPage={(page) => usersHref(query, { page })}
          hrefForPageSize={(limit) => usersHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
