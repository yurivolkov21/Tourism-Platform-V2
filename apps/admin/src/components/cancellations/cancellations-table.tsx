'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { ButtonLink } from '@tourism/ui/components/button-link';
import {
  CalendarIcon,
  CalendarOffIcon,
  MapPinIcon,
  MessageSquareTextIcon,
  TagIcon,
  UserIcon,
} from 'lucide-react';
import * as React from 'react';
import {
  CancellationsClearFilters,
  CancellationsDateRange,
  CancellationsStatusTabs,
} from '@/components/cancellations/cancellations-toolbar';
import { ReviewRequestButton } from '@/components/cancellations/review-request-button';
import { BookingLink } from '@/components/kit/booking-link';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { formatCalendarDate, formatDateRange } from '@/lib/bookings-view';
import {
  type CancellationsQuery,
  cancellationDetailHref,
  cancellationsHref,
} from '@/lib/cancellations-query';
import { type CancellationRowVM, cancellationStatusBadgeVariant } from '@/lib/cancellations-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Hàng đợi `/cancellations` (spec P4b §3-F3) — vùng thật THỨ HAI, dựng trọn
 * trên kit (`DataTableFrame` + `DataTableBody` + `ColumnVisibilityMenu` +
 * `TablePagination` + `serverTableFeatures` — vỏ bảng/menu cột nâng lên kit ở
 * review F3 31/08, hết chép verbatim từ bookings): drag-row tắt, không
 * checkbox, TanStack chỉ lo ẩn/hiện cột. Trang/filter sống trên URL (§2.2).
 *
 * Cột cuối là chỗ DUY NHẤT khác bảng bookings: hàng còn mở thì mang cụm
 * approve/deny (hành vi ghi), hàng đã quyết thì mang dấu vết quyết định —
 * lịch sử append-only D1-B, không có nút "sửa lại".
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toCancellationRow`
 * (thuần, có test) nấu sẵn.
 */
const t = messages.admin.cancellations.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, CancellationRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry (review F3). */
const COLUMN_LABELS: Record<string, string> = {
  tourTitle: t.columns.tour,
  customerName: t.columns.customer,
  reason: t.columns.reason,
  statusLabel: t.columns.status,
  requested: t.columns.requested,
};

/** Icon menu Columns — cùng bộ glyph với hai bảng kia (xem `bookings-table`). */
const COLUMN_ICONS = {
  tourTitle: MapPinIcon,
  customerName: UserIcon,
  reason: MessageSquareTextIcon,
  statusLabel: TagIcon,
  requested: CalendarIcon,
};

/**
 * Cột nhận `query` qua tham số để cột Decision dựng được href mang bộ lọc
 * đang xem. Gọi trong `useMemo` khoá theo `query` — `columns` là đầu vào của
 * row model, đổi tham chiếu mỗi render sẽ khiến table dựng lại model liên tục.
 *
 * Không còn nhận `decide`: từ 04/09 bảng KHÔNG phát lệnh ghi nào nữa, mọi
 * quyết định diễn ra ở `/cancellations/[code]`.
 */
function buildColumns(query: CancellationsQuery) {
  return columnHelper.columns([
    columnHelper.accessor('bookingCode', {
      header: t.columns.booking,
      // Link chéo sang chi tiết booking (§3-F3): quyết xong thường muốn soi
      // ngay sổ cái refund. Cột này không ẩn được — nó là đường ra duy nhất.
      cell: ({ row }) => (
        <BookingLink
          code={row.original.bookingCode}
          fallback={messages.admin.bookings.detail.empty}
        />
      ),
      enableHiding: false,
    }),
    columnHelper.accessor('tourTitle', {
      header: t.columns.tour,
      cell: ({ row }) => (
        <div className="max-w-56">
          <div className="truncate">{row.original.tourTitle}</div>
          <div className="truncate text-xs text-muted-foreground">{row.original.departure}</div>
        </div>
      ),
    }),
    columnHelper.accessor('customerName', {
      header: t.columns.customer,
      cell: ({ row }) => (
        <div className="max-w-48">
          <div className="truncate">{row.original.customerName}</div>
          <div className="truncate text-xs text-muted-foreground">{row.original.customerEmail}</div>
        </div>
      ),
    }),
    columnHelper.accessor('reason', {
      header: t.columns.reason,
      // Lý do dài tới 1000 ký tự: cắt bằng CSS nhưng giữ NGUYÊN VĂN trong
      // `title` và trong dialog xác nhận — admin quyết dựa trên nó.
      cell: ({ row }) => (
        <div className="max-w-64 truncate" title={row.original.reason}>
          {row.original.reason}
        </div>
      ),
    }),
    columnHelper.accessor('statusLabel', {
      header: t.columns.status,
      cell: ({ row }) => (
        <Badge variant={cancellationStatusBadgeVariant(row.original.status)} className="px-1.5">
          {row.original.statusLabel}
        </Badge>
      ),
    }),
    columnHelper.accessor('requested', {
      header: t.columns.requested,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">{row.original.requested}</div>
      ),
    }),
    columnHelper.display({
      id: 'decision',
      header: t.columns.decision,
      cell: ({ row }) => <DecisionCell row={row.original} query={query} />,
      enableHiding: false,
    }),
  ]);
}

/**
 * Còn mở → MỘT nút dẫn sang màn quyết định; đã quyết → dấu vết (mốc + ghi chú).
 *
 * Hai nút Approve/Deny rời khỏi đây ở 04/09 (user chốt). Approve là lệnh vừa
 * hoàn tiền vừa nhả ghế, và quyết nó từ một hàng bảng là quá mỏng: hàng không
 * mang sổ hoàn tiền, không mang lịch sử xin huỷ. Nay hàng chỉ đưa người ta tới
 * `/cancellations/[code]`, nơi có đủ ngữ cảnh.
 *
 * Nút mang theo bộ lọc đang xem để lượt quay về không nhả filter — cùng luật
 * vòng đi–về của `/bookings`.
 */
function DecisionCell({ row, query }: { row: CancellationRowVM; query: CancellationsQuery }) {
  if (row.pending) {
    return (
      <ReviewRequestButton
        href={cancellationDetailHref(query, row.bookingCode)}
        label={t.review}
        ariaLabel={t.reviewFor(row.bookingCode)}
      />
    );
  }
  return (
    <div className="grid gap-0.5 text-xs text-muted-foreground">
      {/* Mốc quyết định LUÔN render — decidedAt nullable theo contract, thiếu
          thì gạch ngang thay vì ô trống trơn nhìn như render hỏng (review F3). */}
      <span className="whitespace-nowrap">
        {row.decided ? t.decidedAt(row.decided) : messages.admin.bookings.detail.empty}
      </span>
      {row.decisionNote ? (
        <span className="max-w-48 truncate" title={row.decisionNote}>
          {t.note(row.decisionNote)}
        </span>
      ) : null}
    </div>
  );
}

export interface CancellationsTableProps {
  rows: CancellationRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: CancellationsQuery;
  total: number;
  totalPages: number;
}

export function CancellationsTable({ rows, query, total, totalPages }: CancellationsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const columns = React.useMemo(() => buildColumns(query), [query]);

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL và
    // `TablePagination` nhận thẳng props (nếp bookings, review 31/08).
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<CancellationsStatusTabs query={query} />}
      actions={
        <>
          <CancellationsDateRange query={query} />
          <CancellationsClearFilters query={query} />
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
          hrefForPage={(page) => cancellationsHref(query, { page })}
          hrefForPageSize={(limit) => cancellationsHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={<CancellationsEmpty query={query} />} />
    </DataTableFrame>
  );
}

/**
 * Ô rỗng của bảng. Đang lọc ngày thì nói THẲNG khoảng đang lọc và mở sẵn một
 * lối thoát — cùng lưới an toàn với `/bookings` (vòng chỉnh UI 04/09), và nay
 * cần ở đây vì vùng này cũng có hai ô ngày.
 *
 * Rủi ro nhẹ hơn `/bookings` (vùng này mặc định KHÔNG lọc ngày, nên bảng rỗng
 * thường là rỗng thật), nhưng vẫn có thật: admin đặt khoảng rồi đổi tab trạng
 * thái, bảng rỗng, và thủ phạm là hai ô ngày họ đặt từ lúc trước.
 */
function CancellationsEmpty({ query }: { query: CancellationsQuery }) {
  if (!query.from && !query.to) return <>{t.empty}</>;

  // Ba dạng câu cho ba hình dạng khoảng — 'between X.' cho khoảng một đầu là
  // câu cụt và đọc thành 'đúng ngày X'.
  const message =
    query.from && query.to
      ? t.emptyInRange(formatDateRange(query.from, query.to))
      : query.from
        ? t.emptyFrom(formatCalendarDate(query.from))
        : t.emptyTo(formatCalendarDate(query.to as string));

  return (
    <div className="flex flex-col items-center gap-2">
      <p>{message}</p>
      {/* Link chứ không nút: đổi bộ lọc là ĐIỀU HƯỚNG ở vùng này (spec P4b
          §2.2), và một link thì mở tab mới / copy được như mọi filter khác. */}
      <ButtonLink
        variant="outline"
        size="sm"
        href={cancellationsHref(query, { from: null, to: null })}
      >
        <CalendarOffIcon data-icon="inline-start" aria-hidden="true" />
        {t.showAllDates}
      </ButtonLink>
    </div>
  );
}
