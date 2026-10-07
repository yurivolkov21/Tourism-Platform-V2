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
import { NameDescriptionCell } from '@/components/kit/name-description-cell';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TourCountCell } from '@/components/kit/tour-count-cell';
import { type CategoryRowVM, categoryStatusBadgeVariant } from '@/lib/categories-view';
import {
  type CreateCategoryAction,
  type CreateContractCode,
  categoryCreatePayload,
  createErrorCopy,
  type DeleteCategoryAction,
  isCreateStale,
  type MoveCategoryAction,
  type SetCategoryActiveAction,
  type UpdateCategoryAction,
} from '@/lib/categories-write';
import { useCreateRequest } from '@/lib/quick-create';

/**
 * Bảng `/categories` (spec P4e-2 F14) — dựng trọn trên kit, đúng luật "mọi bảng
 * vùng một kiểu" (user chốt 31/08).
 *
 * KHÔNG có phân trang, lọc hay tìm kiếm: đo trên production 22/09 thì bảng này
 * có SÁU hàng. Một thanh công cụ cho sáu hàng là nhiễu, và `TablePagination`
 * cho sáu hàng thì chỉ in "1–6 of 6".
 *
 * Thứ tự hàng là thứ tự server trả về (`order`), và nó dẫn dắt thứ tự chip
 * lọc trên `/tours` của khách — nên bảng KHÔNG cho sắp theo cột nào khác. Sắp
 * lại bằng hai mũi tên trên từng hàng; một cột sắp-theo-tên ở đây sẽ nói dối
 * về thứ tự thật.
 *
 * Lưu ý bảng này liệt kê CẢ hàng đã ẩn, mà trang khách thì lọc chúng đi. Nên
 * đổi chỗ quanh một hàng đã ẩn không đổi gì ở ngoài kia — câu phụ đề của màn
 * nói thẳng điều đó.
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
 * MỌI thứ ô hành động cần từ bảng — đi qua CONTEXT, không qua cột. Cột đổi danh tính thì
 * `FlexRender` gặp một kiểu component mới ở ô, React unmount cả ô cùng toàn bộ state của nó
 * (hộp đang mở, focus Base UI vừa trả về nút) rồi mount lại. Hai thứ ở đây đổi danh tính:
 * - Cờ bận đổi hai lần mỗi lệnh ghi (bài học vòng hai F12).
 * - Server action đổi danh tính sau MỖI `router.refresh()`: Flight client giải mã mỗi lượt thành
 *   một closure mới, không cache theo id (review D1). Nằm trong deps của cột thì mọi lệnh ghi
 *   xong đều dựng lại cột đúng lúc payload mới đáp xuống — hộp Edit đang mở biến mất, và focus
 *   ở nút Delete sau `IN_USE` rơi về `<body>`.
 * Nhờ vậy cột là hằng của module (`COLUMNS`): không còn gì của component để đổi danh tính.
 *
 * "Bận" gộp HAI thứ: đang kéo dữ liệu tươi về, và đang có một lượt đổi chỗ bay
 * ở một hàng bất kỳ. Vế thứ hai là bản vá vòng review F14 — xem JSDoc prop
 * `disabled` của `CategoryRowActions`.
 */
const RowActionsContext = React.createContext<{
  busy: boolean;
  onMoveStart: () => void;
  update: UpdateCategoryAction;
  setActive: SetCategoryActiveAction;
  move: MoveCategoryAction;
  remove: DeleteCategoryAction;
  /** Nút Add của bảng — đích focus sau khi xoá được một hàng (review A2-1). */
  focusAfterDelete: React.RefObject<HTMLElement | null>;
  onSettled: () => void;
} | null>(null);

function ActionsCell({ row }: { row: CategoryRowVM }) {
  const context = React.useContext(RowActionsContext);
  if (context === null) throw new Error('ActionsCell must be used inside RowActionsContext');
  const { busy, ...actions } = context;
  return <CategoryRowActions row={row} disabled={busy} {...actions} />;
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
      <Badge variant={categoryStatusBadgeVariant(row.original.isActive)} className="px-1.5">
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

export interface CategoriesTableProps {
  rows: CategoryRowVM[];
  create: CreateCategoryAction;
  update: UpdateCategoryAction;
  setActive: SetCategoryActiveAction;
  move: MoveCategoryAction;
  remove: DeleteCategoryAction;
}

export function CategoriesTable({
  rows,
  create,
  update,
  setActive,
  move,
  remove,
}: CategoriesTableProps) {
  const router = useRouter();
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [isRefreshing, startRefresh] = React.useTransition();
  const [adding, setAdding] = React.useState(false);
  // Quick Create (spec 2026-10-05 §2.5) mở hộp Add như bấm nút: lúc bảng mount nếu menu vừa ghi
  // yêu cầu từ trang khác, hay ngay khi menu ghi yêu cầu trên chính trang này.
  useCreateRequest('category', () => setAdding(true));
  /**
   * Một lượt đổi chỗ đang bay — khoá mũi tên của MỌI hàng, không riêng hàng
   * vừa bấm. `isRefreshing` một mình không đủ: nó chỉ bật ở `finally`, tức
   * SAU khi request về, nên giữa cú bấm và lúc ấy các hàng khác vẫn bấm được.
   */
  const [isMoving, setIsMoving] = React.useState(false);
  /**
   * Nút Add — luôn có, sống qua mọi lượt làm mới, nên là đích focus khi một hàng vừa bị xoá
   * mang theo nút Delete của nó (review A2-1), và khi hộp Add đóng (review A2-8).
   */
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  /** Sau MỌI kết cục đã-chạm-server: kéo bảng tươi về, khoá nút tới khi xong. */
  const refreshList = React.useCallback(() => {
    setIsMoving(false);
    startRefresh(() => router.refresh());
  }, [router]);

  const busy = isRefreshing || isMoving;
  const rowActions = React.useMemo(
    () => ({
      busy,
      onMoveStart: () => setIsMoving(true),
      update,
      setActive,
      move,
      remove,
      focusAfterDelete: addButtonRef,
      onSettled: refreshList,
    }),
    [busy, update, setActive, move, remove, refreshList],
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
      {/* `views`/`footer` là `null` TƯỜNG MINH, không phải prop optional: bảng
          này cố ý không có tab lọc lẫn phân trang, còn prop vẫn bắt buộc để
          bảng nào QUÊN phân trang thật thì đỏ ở compiler. Khung tự bọc khe
          trái nên cụm hành động vẫn nằm bên phải như mọi bảng khác. */}
      <DataTableFrame
        views={null}
        footer={null}
        actions={
          <>
            <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
            <Button
              ref={addButtonRef}
              type="button"
              size="sm"
              disabled={busy}
              // Hộp Add đóng đúng lúc bảng làm mới — focus phải quay về được nút này.
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
          // Mở bằng Quick Create thì không có nút nào được bấm để focus quay về (review A2-8).
          finalFocus={addButtonRef}
        />
      ) : null}
    </>
  );
}
