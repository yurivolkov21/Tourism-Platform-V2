'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import { CircleCheckIcon, PlusIcon, TagIcon, UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { CategoryFormDialog } from '@/components/categories/category-form-dialog';
import { CategoryRowActions } from '@/components/categories/category-row-actions';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { type CategoryRowVM, categoryStatusBadgeVariant } from '@/lib/categories-view';
import {
  type CreateCategoryAction,
  type CreateContractCode,
  categoryCreatePayload,
  createErrorCopy,
  isCreateStale,
  type MoveCategoryAction,
  type SetCategoryActiveAction,
  type UpdateCategoryAction,
} from '@/lib/categories-write';

/**
 * Bảng `/categories` (spec P4e-2 F14) — dựng trọn trên kit, đúng luật "mọi bảng
 * vùng một kiểu" (user chốt 31/08).
 *
 * KHÔNG có phân trang, lọc hay tìm kiếm: đo trên production 22/09 thì bảng này
 * có SÁU hàng. Một thanh công cụ cho sáu hàng là nhiễu, và `TablePagination`
 * cho sáu hàng thì chỉ in "1–6 of 6".
 *
 * Thứ tự hàng là thứ tự server trả về (`order`) — thứ tự sẽ dẫn dắt chip lọc
 * của khách sau Task 5 — nên bảng KHÔNG cho sắp theo cột nào khác. Sắp lại
 * bằng hai mũi tên trên từng hàng; một cột sắp-theo-tên ở đây sẽ nói dối về
 * thứ tự thật.
 */
const t = messages.admin.categories;

const columnHelper = createColumnHelper<typeof serverTableFeatures, CategoryRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  slug: t.list.columns.slug,
  toursLabel: t.list.columns.tours,
  statusLabel: t.list.columns.status,
};

const COLUMN_ICONS = {
  slug: TagIcon,
  toursLabel: UsersIcon,
  statusLabel: CircleCheckIcon,
};

/**
 * Bảng đang kéo dữ liệu tươi về hay không — đi qua CONTEXT chứ không qua deps
 * của `useMemo` dựng cột (bài học vòng hai F12): cờ ấy đổi hai lần mỗi lệnh
 * ghi, và nằm trong deps thì cột dựng lại cả hai lần, kéo theo ô unmount cùng
 * toàn bộ state của nó.
 */
const RefreshingContext = React.createContext(false);

function ActionsCell({
  row,
  update,
  setActive,
  move,
  onSettled,
}: {
  row: CategoryRowVM;
  update: UpdateCategoryAction;
  setActive: SetCategoryActiveAction;
  move: MoveCategoryAction;
  onSettled: () => void;
}) {
  const disabled = React.useContext(RefreshingContext);
  return (
    <CategoryRowActions
      row={row}
      update={update}
      setActive={setActive}
      move={move}
      disabled={disabled}
      onSettled={onSettled}
    />
  );
}

export interface CategoriesTableProps {
  rows: CategoryRowVM[];
  create: CreateCategoryAction;
  update: UpdateCategoryAction;
  setActive: SetCategoryActiveAction;
  move: MoveCategoryAction;
}

export function CategoriesTable({ rows, create, update, setActive, move }: CategoriesTableProps) {
  const router = useRouter();
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [isRefreshing, startRefresh] = React.useTransition();
  const [adding, setAdding] = React.useState(false);

  /** Sau MỌI kết cục đã-chạm-server: kéo bảng tươi về, khoá nút tới khi xong. */
  const refreshList = React.useCallback(() => {
    startRefresh(() => router.refresh());
  }, [router]);

  const columns = React.useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: t.list.columns.name,
          // Danh tính của hàng — không ẩn được.
          cell: ({ row }) => (
            <div className="min-w-0">
              <div className="font-medium text-foreground">{row.original.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {row.original.description}
              </div>
            </div>
          ),
          enableHiding: false,
        }),
        columnHelper.accessor('slug', {
          header: t.list.columns.slug,
          cell: ({ row }) => (
            <code className="text-xs text-muted-foreground">{row.original.slug}</code>
          ),
        }),
        columnHelper.accessor('toursLabel', {
          header: t.list.columns.tours,
          cell: ({ row }) => (
            <span className="tabular-nums whitespace-nowrap">{row.original.toursLabel}</span>
          ),
        }),
        columnHelper.accessor('statusLabel', {
          header: t.list.columns.status,
          cell: ({ row }) => (
            <Badge variant={categoryStatusBadgeVariant(row.original.isActive)} className="px-1.5">
              {row.original.statusLabel}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">{t.list.columns.actions}</span>,
          cell: ({ row }) => (
            <ActionsCell
              row={row.original}
              update={update}
              setActive={setActive}
              move={move}
              onSettled={refreshList}
            />
          ),
          enableHiding: false,
        }),
      ]),
    // KHÔNG có `isRefreshing` ở đây — xem `RefreshingContext`.
    [update, setActive, move, refreshList],
  );

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <>
      {/* `views`/`footer` là `null` TƯỜNG MINH, không phải prop optional: bảng
          này cố ý không có tab lọc lẫn phân trang, còn prop vẫn bắt buộc để
          bảng nào QUÊN phân trang thật thì đỏ ở compiler. */}
      <DataTableFrame
        views={null}
        footer={null}
        actions={
          <>
            <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
            <Button type="button" size="sm" disabled={isRefreshing} onClick={() => setAdding(true)}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {t.create.action}
            </Button>
          </>
        }
      >
        <RefreshingContext.Provider value={isRefreshing}>
          <DataTableBody table={table} empty={t.list.empty} />
        </RefreshingContext.Provider>
      </DataTableFrame>

      {adding ? (
        <CategoryFormDialog<CreateContractCode>
          copy={t.create.dialog}
          mode="create"
          formId="category-create"
          initial={{ name: '', slug: '', description: '' }}
          isStale={isCreateStale}
          errorCopy={createErrorCopy}
          onSubmit={(values) => create(categoryCreatePayload(values))}
          toast={(created) => ({
            title: t.create.toast.title,
            description: t.create.toast.body(created.name),
          })}
          onClose={() => setAdding(false)}
          onSettled={refreshList}
        />
      ) : null}
    </>
  );
}
