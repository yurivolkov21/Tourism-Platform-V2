'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { AdminDepartureStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  BanIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  ListIcon,
  LockIcon,
  PlusIcon,
  TicketIcon,
  UsersIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { DepartureFormDialog } from '@/components/departures/departure-form-dialog';
import { DepartureRowActions } from '@/components/departures/departure-row-actions';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { formatDateRange } from '@/lib/bookings-view';
import { type DeparturesQuery, departuresHref } from '@/lib/departures-query';
import { type DepartureRowVM, departureStatusBadgeVariant } from '@/lib/departures-view';
import {
  type CancelDepartureAction,
  type CreateContractCode,
  type CreateDepartureAction,
  createDeadlineHint,
  createErrorCopy,
  isCreateStale,
  type SetDepartureStatusAction,
  type UpdateDepartureAction,
} from '@/lib/departures-write';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/tours/[slug]/departures` (spec P4e-1 F12) — dựng trọn trên kit
 * (`DataTableFrame` + `DataTableBody` + `ColumnVisibilityMenu` +
 * `TablePagination` + `serverTableFeatures`), đúng luật "mọi bảng vùng một
 * kiểu" (user chốt 31/08). Trang/lọc sống trên URL.
 *
 * Cột: Dates · Price · Seats · Book/cancel by · Live bookings · Status ·
 * Actions. **Hạn chót có cột RIÊNG, không giấu sau tooltip** (spec F12 B2):
 * nó là mốc quyết định của mọi thao tác trên hàng — còn đặt được không, mở
 * lại được không, huỷ thì khách được hoàn bao nhiêu.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toDepartureRowVM`
 * (thuần, có test) nấu sẵn, kể cả ba lá cờ quyết định nút nào bấm được.
 */
const t = messages.admin.departures;

const columnHelper = createColumnHelper<typeof serverTableFeatures, DepartureRowVM>();

/**
 * Bảng đang kéo dữ liệu tươi về hay không — đi qua CONTEXT chứ không qua deps
 * của `useMemo` dựng cột (F12 vòng hai).
 *
 * Vì sao: `isRefreshing` đổi hai lần mỗi lệnh ghi, và nếu nó nằm trong deps thì
 * MẢNG CỘT được dựng lại cả hai lần — TanStack thấy cột mới nên dựng lại ô,
 * kéo theo `DepartureRowActions` unmount rồi mount lại cùng toàn bộ state nội
 * bộ của nó (dialog đang mở, phiên bản hàng đã chụp, ô lý do đang gõ).
 *
 * Với context thì cột đứng yên và chỉ những ô THẬT SỰ đọc cờ này mới vẽ lại.
 */
const RefreshingContext = React.createContext(false);

/**
 * Ô Actions — component riêng để nó đọc được context. Cột chỉ giữ một tham
 * chiếu ổn định tới đây, không giữ giá trị của cờ.
 */
function ActionsCell({
  row,
  basePriceLabel,
  update,
  setStatus,
  cancel,
  onSettled,
}: {
  row: DepartureRowVM;
  basePriceLabel: string;
  update: UpdateDepartureAction;
  setStatus: SetDepartureStatusAction;
  cancel: CancelDepartureAction;
  onSettled: () => void;
}) {
  const disabled = React.useContext(RefreshingContext);
  return (
    <DepartureRowActions
      row={row}
      basePriceLabel={basePriceLabel}
      update={update}
      setStatus={setStatus}
      cancel={cancel}
      disabled={disabled}
      onSettled={onSettled}
    />
  );
}

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  price: t.list.columns.price,
  seats: t.list.columns.seats,
  deadline: t.list.columns.deadline,
  bookingsLabel: t.list.columns.bookings,
  refundOutstanding: t.list.columns.refunds,
  statusLabel: t.list.columns.status,
};

const COLUMN_ICONS = {
  price: TicketIcon,
  seats: UsersIcon,
  deadline: CalendarDaysIcon,
  bookingsLabel: UsersIcon,
  refundOutstanding: BanIcon,
  statusLabel: CircleCheckIcon,
};

const STATUSES = AdminDepartureStatusSchema.options;

/** Icon theo trạng thái — `Record` trên enum để quên một member là đỏ typecheck. */
const STATUS_ICONS: Record<(typeof STATUSES)[number], typeof ListIcon> = {
  OPEN: CircleCheckIcon,
  CLOSED: LockIcon,
  CANCELLED: BanIcon,
};

const TAB_ITEMS = [
  { label: t.list.all, value: ALL, icon: ListIcon },
  ...STATUSES.map((status) => ({
    label: t.status[status],
    value: status,
    icon: STATUS_ICONS[status],
  })),
];

export interface DeparturesTableProps {
  rows: DepartureRowVM[];
  query: DeparturesQuery;
  total: number;
  totalPages: number;
  tour: { slug: string; basePriceLabel: string };
  /**
   * Ngày lịch VIỆT NAM do server tính — cùng giá trị đã nấu ra `rows`. Form
   * thêm cần nó để biết chuyến sắp tạo có quá hạn nhận đặt hay chưa.
   */
  today: string;
  create: CreateDepartureAction;
  update: UpdateDepartureAction;
  setStatus: SetDepartureStatusAction;
  cancel: CancelDepartureAction;
}

export function DeparturesTable({
  rows,
  query,
  total,
  totalPages,
  tour,
  today,
  create,
  update,
  setStatus,
  cancel,
}: DeparturesTableProps) {
  const router = useRouter();
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [isRefreshing, startRefresh] = React.useTransition();
  const [adding, setAdding] = React.useState(false);

  /** Sau MỌI kết cục đã-chạm-server: kéo bảng tươi về, khoá nút tới khi xong. */
  const refreshList = React.useCallback(() => {
    startRefresh(() => router.refresh());
  }, [router]);

  // Cột dựng trong component vì ô Actions cần ba server action và cờ
  // `isRefreshing` — `useMemo` giữ chúng ổn định giữa các lần render.
  const columns = React.useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('dates', {
          header: t.list.columns.dates,
          // Danh tính của hàng — không ẩn được.
          cell: ({ row }) => (
            <span className="font-medium whitespace-nowrap text-foreground">
              {row.original.dates}
            </span>
          ),
          enableHiding: false,
        }),
        columnHelper.accessor('price', {
          header: t.list.columns.price,
          cell: ({ row }) => (
            <div className="whitespace-nowrap">
              <div className="tabular-nums">{row.original.price}</div>
              {/* Dòng phụ chỉ hiện khi chuyến KHÔNG có giá riêng — nếu không,
                  con số trên đã tự nói hết. */}
              {row.original.priceNote ? (
                <div className="text-xs text-muted-foreground">{row.original.priceNote}</div>
              ) : null}
            </div>
          ),
        }),
        columnHelper.accessor('seats', {
          header: t.list.columns.seats,
          cell: ({ row }) => (
            <span className="tabular-nums" title={row.original.seatsLabel}>
              {row.original.seats}
            </span>
          ),
        }),
        columnHelper.accessor('deadline', {
          header: t.list.columns.deadline,
          cell: ({ row }) => (
            <div className="whitespace-nowrap">
              <div className={row.original.deadlinePassed ? 'text-muted-foreground' : undefined}>
                {row.original.deadline}
              </div>
              {row.original.deadlinePassed ? (
                <div className="text-xs text-muted-foreground">{t.list.deadlinePassed}</div>
              ) : null}
            </div>
          ),
        }),
        columnHelper.accessor('bookingsLabel', {
          header: t.list.columns.bookings,
          cell: ({ row }) => (
            <span className="tabular-nums whitespace-nowrap">{row.original.liveBookingCount}</span>
          ),
        }),
        columnHelper.accessor('refundOutstanding', {
          header: t.list.columns.refunds,
          // Chỉ nói khi CÒN người phải chờ. Hàng đã hoàn xong và hàng chưa huỷ
          // đều để trống — cột Status đã nói chuyến ở đâu rồi.
          cell: ({ row }) =>
            row.original.refundOutstanding ? (
              <div className="whitespace-nowrap">
                <div className="tabular-nums">{row.original.refundOutstanding}</div>
                {/* Worker gói free của Render ngủ sau 15 phút: job nằm nguyên
                    trong hàng đợi tới khi nó tỉnh nên không mất gì, nhưng admin
                    nhìn màn hình thì không đoán được điều đó. */}
                <div className="text-xs text-muted-foreground">{t.list.refundStalled}</div>
              </div>
            ) : null,
        }),
        columnHelper.accessor('statusLabel', {
          header: t.list.columns.status,
          cell: ({ row }) => (
            <Badge variant={departureStatusBadgeVariant(row.original.status)} className="px-1.5">
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
              basePriceLabel={tour.basePriceLabel}
              update={update}
              setStatus={setStatus}
              cancel={cancel}
              onSettled={refreshList}
            />
          ),
          enableHiding: false,
        }),
      ]),
    // KHÔNG có `isRefreshing` ở đây — xem `RefreshingContext`.
    [tour.basePriceLabel, update, setStatus, cancel, refreshList],
  );

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL.
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  function goStatus(next: string) {
    // `safeParse` chứ không `parse`: value lạ rơi êm về "All" thay vì ném
    // ZodError giữa event handler (nếp bookings, review F1).
    const parsed = AdminDepartureStatusSchema.safeParse(next);
    router.push(departuresHref(query, { status: parsed.success ? parsed.data : null }));
  }

  return (
    <>
      <DataTableFrame
        views={
          <StatusFilterTabs
            items={TAB_ITEMS}
            value={query.status ?? ALL}
            label={t.list.filterLabel}
            selectId="departures-status-selector"
            onSelect={goStatus}
          />
        }
        actions={
          <>
            <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
            <Button type="button" size="sm" disabled={isRefreshing} onClick={() => setAdding(true)}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {t.create.action}
            </Button>
          </>
        }
        footer={
          <TablePagination
            page={query.page}
            totalPages={totalPages}
            total={total}
            pageSize={query.limit}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            hrefForPage={(page) => departuresHref(query, { page })}
            hrefForPageSize={(limit) => departuresHref(query, { limit })}
          />
        }
      >
        <RefreshingContext.Provider value={isRefreshing}>
          <DataTableBody table={table} empty={t.list.empty} />
        </RefreshingContext.Provider>
      </DataTableFrame>

      {adding ? (
        <DepartureFormDialog<CreateContractCode>
          copy={t.create.dialog}
          formId="departure-create"
          // Form trống: ngày để người gõ chọn, ghế và giá thì gợi ý bằng
          // placeholder/hint chứ không điền hộ — một con số điền sẵn là một
          // con số không ai đọc lại.
          initial={{ startDate: '', endDate: '', seats: '', price: '' }}
          seatsBooked={0}
          // Hạn nhận đặt là `ngày đi − N` với N tới 7 ngày: một chuyến khởi
          // hành tuần sau có thể đã quá hạn ngay lúc tạo. Vẫn cho tạo, nhưng
          // nói trước rằng nó sẽ không bán được.
          notice={(values) => createDeadlineHint(values, today)}
          basePriceLabel={tour.basePriceLabel}
          isStale={isCreateStale}
          errorCopy={createErrorCopy}
          onSubmit={(values) => create({ slug: tour.slug, ...values })}
          toast={(created) => ({
            title: t.create.toast.title,
            description: t.create.toast.body(formatDateRange(created.startDate, created.endDate)),
          })}
          onClose={() => setAdding(false)}
          onSettled={refreshList}
        />
      ) : null}
    </>
  );
}
