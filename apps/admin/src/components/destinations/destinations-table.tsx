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
import { TourCountCell } from '@/components/kit/tour-count-cell';
import { type DestinationRowVM, destinationStatusBadgeVariant } from '@/lib/destinations-view';
import {
  type CreateContractCode,
  type CreateDestinationAction,
  createErrorCopy,
  type DeleteDestinationAction,
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
 * MỌI thứ ô hành động cần từ bảng — đi qua CONTEXT, không qua cột, cùng lý do bảng danh mục.
 * Cột đổi danh tính thì `FlexRender` gặp một kiểu component mới ở ô, React unmount cả ô cùng
 * state của nó rồi mount lại. Hai thứ ở đây đổi danh tính:
 * - Cờ bận đổi hai lần mỗi lệnh ghi (bài học 12, vòng hai F12).
 * - Server action đổi danh tính sau MỖI `router.refresh()`: Flight client giải mã mỗi lượt thành
 *   một closure mới, không cache theo id (review D1). Nằm trong deps của cột thì mọi lệnh ghi
 *   xong đều dựng lại cột đúng lúc payload mới đáp xuống — hộp Edit đang mở biến mất, và focus
 *   ở nút Delete sau `IN_USE` rơi về `<body>`.
 * Nhờ vậy cột là hằng của module (`COLUMNS`): không còn gì của component để đổi danh tính.
 */
const RowActionsContext = React.createContext<{
  busy: boolean;
  update: UpdateDestinationAction;
  setActive: SetDestinationActiveAction;
  remove: DeleteDestinationAction;
  /** Nút Add của bảng — đích focus sau khi xoá được một hàng (review A2-1). */
  focusAfterDelete: React.RefObject<HTMLElement | null>;
  onSettled: () => void;
} | null>(null);

function ActionsCell({ row }: { row: DestinationRowVM }) {
  const context = React.useContext(RowActionsContext);
  if (context === null) throw new Error('ActionsCell must be used inside RowActionsContext');
  const { busy, ...actions } = context;
  return <DestinationRowActions row={row} disabled={busy} {...actions} />;
}

const COLUMNS = columnHelper.columns([
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
    cell: ({ row }) => <code className="text-xs text-muted-foreground">{row.original.slug}</code>,
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
      <TourCountCell
        totalLabel={row.original.toursLabel}
        publishedLabel={row.original.publishedLabel}
      />
    ),
  }),
  columnHelper.accessor('statusLabel', {
    header: t.list.columns.status,
    cell: ({ row }) => (
      <Badge variant={destinationStatusBadgeVariant(row.original.isActive)} className="px-1.5">
        {row.original.statusLabel}
      </Badge>
    ),
  }),
  columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">{t.list.columns.actions}</span>,
    // Lệnh ghi và cờ bận đọc qua `RowActionsContext`, không đóng vào cột.
    cell: ({ row }) => <ActionsCell row={row.original} />,
    enableHiding: false,
  }),
]);

export interface DestinationsTableProps {
  rows: DestinationRowVM[];
  create: CreateDestinationAction;
  update: UpdateDestinationAction;
  setActive: SetDestinationActiveAction;
  remove: DeleteDestinationAction;
  /** Quick Create (`?create=1`) — trang báo mở sẵn hộp Add (spec 2026-10-05 §2.5). */
  openCreate?: boolean;
}

export function DestinationsTable({
  rows,
  create,
  update,
  setActive,
  remove,
  openCreate = false,
}: DestinationsTableProps) {
  const router = useRouter();
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    country: false,
  });
  const [isRefreshing, startRefresh] = React.useTransition();
  // Quick Create (spec 2026-10-05 §2.5) mở hộp Add bằng hai đường. Tới từ trang khác thì
  // trang dựng mới, hộp mở ngay từ state khởi đầu. Bấm ngay trên trang này thì route giữ
  // nguyên, chỉ query đổi — bảng không remount, `useState(openCreate)` không chạy lại, nên
  // effect mở hộp khi prop bật lên. Effect chỉ đặt state, không bấm nút hộ, và không đóng
  // hộp khi prop tắt (lúc `StripCreateParam` gỡ tham số khỏi URL).
  const [adding, setAdding] = React.useState(openCreate);
  React.useEffect(() => {
    if (openCreate) setAdding(true);
  }, [openCreate]);

  /**
   * Nút Add — luôn có, sống qua mọi lượt làm mới, nên là đích focus khi một hàng vừa bị xoá
   * mang theo nút Delete của nó (review A2-1).
   */
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  /** Sau MỌI kết cục đã-chạm-server: kéo bảng tươi về, khoá nút tới khi xong. */
  const refreshList = React.useCallback(() => {
    startRefresh(() => router.refresh());
  }, [router]);

  const rowActions = React.useMemo(
    () => ({
      busy: isRefreshing,
      update,
      setActive,
      remove,
      focusAfterDelete: addButtonRef,
      onSettled: refreshList,
    }),
    [isRefreshing, update, setActive, remove, refreshList],
  );

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns: COLUMNS,
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
              ref={addButtonRef}
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
        <RowActionsContext.Provider value={rowActions}>
          <DataTableBody table={table} empty={t.list.empty} />
        </RowActionsContext.Provider>
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
