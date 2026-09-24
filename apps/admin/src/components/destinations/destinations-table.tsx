'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import { CircleCheckIcon, GlobeIcon, MapIcon, PlusIcon, TagIcon, UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { DestinationFormDialog } from '@/components/destinations/destination-form-dialog';
import { DestinationRowActions } from '@/components/destinations/destination-row-actions';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { NameDescriptionCell } from '@/components/kit/name-description-cell';
import { serverTableFeatures } from '@/components/kit/table-features';
import { type DestinationRowVM, destinationStatusBadgeVariant } from '@/lib/destinations-view';
import {
  type CreateContractCode,
  type CreateDestinationAction,
  createErrorCopy,
  destinationCreatePayload,
  isCreateStale,
  newDestinationFormValues,
  type SetDestinationActiveAction,
  type UpdateDestinationAction,
} from '@/lib/destinations-write';

/**
 * Bảng `/destinations` (spec P4e-2 F15) — dựng trọn trên kit, cùng khuôn bảng
 * `/categories` (user chốt 31/08: mọi bảng vùng một kiểu).
 *
 * KHÔNG phân trang, lọc hay tìm kiếm: đo trên production 22/09 thì bảng này có
 * mười tám hàng. Thứ tự là thứ tự server trả (theo tên, cùng thước với bề mặt
 * công khai); không có mũi tên vì bảng không có thứ tự nào để sắp.
 *
 * Cột quốc gia ẩn sẵn (bật lại được ở menu cột): mười tám hàng đều ghi
 * Vietnam, một cột lặp một chữ là nhiễu — nhưng ô ấy sửa được trong form, nên
 * nó vẫn phải có chỗ để nhìn.
 */
const t = messages.admin.destinations;

const columnHelper = createColumnHelper<typeof serverTableFeatures, DestinationRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  slug: t.list.columns.slug,
  regionLabel: t.list.columns.region,
  country: t.list.columns.country,
  toursLabel: t.list.columns.tours,
  statusLabel: t.list.columns.status,
};

const COLUMN_ICONS = {
  slug: TagIcon,
  regionLabel: MapIcon,
  country: GlobeIcon,
  toursLabel: UsersIcon,
  statusLabel: CircleCheckIcon,
};

/**
 * Bảng đang bận hay không — đi qua CONTEXT chứ không qua deps của `useMemo`
 * dựng cột (bài học 12, vòng hai F12): cờ ấy đổi hai lần mỗi lệnh ghi, và nằm
 * trong deps thì cột dựng lại cả hai lần, kéo theo ô unmount cùng state của nó.
 */
const BusyContext = React.createContext(false);

function ActionsCell({
  row,
  update,
  setActive,
  onSettled,
}: {
  row: DestinationRowVM;
  update: UpdateDestinationAction;
  setActive: SetDestinationActiveAction;
  onSettled: () => void;
}) {
  const busy = React.useContext(BusyContext);
  return (
    <DestinationRowActions
      row={row}
      update={update}
      setActive={setActive}
      disabled={busy}
      onSettled={onSettled}
    />
  );
}

export interface DestinationsTableProps {
  rows: DestinationRowVM[];
  create: CreateDestinationAction;
  update: UpdateDestinationAction;
  setActive: SetDestinationActiveAction;
}

export function DestinationsTable({ rows, create, update, setActive }: DestinationsTableProps) {
  const router = useRouter();
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    country: false,
  });
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
            <NameDescriptionCell name={row.original.name} description={row.original.description} />
          ),
          enableHiding: false,
        }),
        columnHelper.accessor('slug', {
          header: t.list.columns.slug,
          cell: ({ row }) => (
            <code className="text-xs text-muted-foreground">{row.original.slug}</code>
          ),
        }),
        columnHelper.accessor('regionLabel', {
          header: t.list.columns.region,
          // Chuỗi trong DB không khớp vùng nào thì điểm đến không hiện ở trang
          // vùng nào — trước F15 không có gì báo điều ấy ở bất cứ đâu.
          cell: ({ row }) =>
            row.original.regionName ? (
              <span className="whitespace-nowrap">{row.original.regionLabel}</span>
            ) : (
              <Badge variant="destructive" className="px-1.5">
                {row.original.regionLabel}
              </Badge>
            ),
        }),
        columnHelper.accessor('country', {
          header: t.list.columns.country,
          cell: ({ row }) => <span className="whitespace-nowrap">{row.original.country}</span>,
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
            <Badge
              variant={destinationStatusBadgeVariant(row.original.isActive)}
              className="px-1.5"
            >
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
              onSettled={refreshList}
            />
          ),
          enableHiding: false,
        }),
      ]),
    // KHÔNG có cờ bận ở đây — xem `BusyContext`.
    [update, setActive, refreshList],
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
      {/* `views`/`footer` là `null` TƯỜNG MINH như bảng danh mục: bảng này cố ý
          không có tab lọc lẫn phân trang. */}
      <DataTableFrame
        views={null}
        footer={null}
        actions={
          <>
            <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
            {/* `focusableWhenDisabled`: xem `DestinationRowActions` — hộp Add đóng đúng
                lúc bảng làm mới, focus phải quay về được nút này. */}
            <Button
              type="button"
              size="sm"
              disabled={isRefreshing}
              focusableWhenDisabled
              onClick={() => setAdding(true)}
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {t.create.action}
            </Button>
          </>
        }
      >
        <BusyContext.Provider value={isRefreshing}>
          <DataTableBody table={table} empty={t.list.empty} />
        </BusyContext.Provider>
      </DataTableFrame>

      {adding ? (
        <DestinationFormDialog<CreateContractCode>
          copy={t.create.dialog}
          mode="create"
          formId="destination-create"
          initial={newDestinationFormValues()}
          isStale={isCreateStale}
          errorCopy={createErrorCopy}
          onSubmit={(values) => create(destinationCreatePayload(values))}
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
