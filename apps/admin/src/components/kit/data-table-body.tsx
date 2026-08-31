'use client';

import { FlexRender, type RowData, type Table as TanstackTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tourism/ui/components/table';
import { ChevronDownIcon, Columns3Icon } from 'lucide-react';
import type { serverTableFeatures } from '@/components/kit/table-features';

/**
 * Hai mảnh DÙNG CHUNG của mọi bảng admin đọc-từ-server (kit P4b — nâng từ cặp
 * bản chép verbatim bookings-table/cancellations-table ở review F3 31/08):
 * thân bảng (header sticky + rows + empty state) và menu ẩn/hiện cột. Vùng
 * chỉ còn giữ phần thật sự riêng: định nghĩa cột + toolbar + href.
 *
 * Khoá kiểu vào `serverTableFeatures` (không generic theo features): mọi bảng
 * vùng của admin đều dựng trên đúng bộ feature đó — generic hoá thêm là mua
 * phức tạp cho một ca chưa tồn tại.
 */
type AdminTable<TData extends RowData> = TanstackTable<typeof serverTableFeatures, TData>;

export function DataTableBody<TData extends RowData>({
  table,
  empty,
}: {
  table: AdminTable<TData>;
  empty: string;
}) {
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-muted">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} colSpan={header.colSpan}>
                {header.isPlaceholder ? null : <FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  <FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            {/* Đếm cột ĐANG HIỆN, không phải cột định nghĩa — admin ẩn bớt cột
                rồi lọc ra tập rỗng thì colSpan cứng sẽ thừa cột ma. */}
            <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/**
 * Menu Columns — nhãn lấy từ `labels` (map `column.id` → copy i18n); thiếu thì
 * rơi về `header` nếu là chuỗi, cuối cùng mới tới `column.id` thô. Cột không
 * ẩn được hoặc display-column không vào menu.
 */
export function ColumnVisibilityMenu<TData extends RowData>({
  table,
  labels,
}: {
  table: AdminTable<TData>;
  labels: Record<string, string>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3Icon data-icon="inline-start" />
        {messages.admin.table.columns}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {table
          .getAllColumns()
          .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {labels[column.id] ??
                (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
