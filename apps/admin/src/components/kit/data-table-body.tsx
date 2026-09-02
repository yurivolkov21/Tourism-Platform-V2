'use client';

import { FlexRender, type RowData, type Table as TanstackTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
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
import type * as React from 'react';
import type { selectableTableFeatures, serverTableFeatures } from '@/components/kit/table-features';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';

/**
 * Hai mảnh DÙNG CHUNG của mọi bảng admin đọc-từ-server (kit P4b — nâng từ cặp
 * bản chép verbatim bookings-table/cancellations-table ở review F3 31/08):
 * thân bảng (header sticky + rows + empty state) và menu ẩn/hiện cột. Vùng
 * chỉ còn giữ phần thật sự riêng: định nghĩa cột + toolbar + href.
 *
 * `DataTableBody` nhận MỘT TRONG HAI bộ feature của bảng vùng (nới ở vòng vá
 * review 02/09): `serverTableFeatures` (cancellations/reviews) hoặc
 * `selectableTableFeatures` (bookings, có cột checkbox). Không generic theo
 * `TableFeatures` được: v9 dựng `getVisibleCells`/`getVisibleLeafColumns`
 * bằng conditional type theo bộ CỤ THỂ, generic mở là chúng biến mất.
 *
 * `ColumnVisibilityMenu` thì đi đường khác (nới ra 01/09): bảng dashboard `/`
 * có thêm sorting/pagination/selection nên không lọt qua kiểu hẹp, mà nó vẫn
 * cần đúng cái menu này — xem hợp đồng tối thiểu bên dưới.
 */
type AdminTable<TData extends RowData> =
  | TanstackTable<typeof serverTableFeatures, TData>
  | TanstackTable<typeof selectableTableFeatures, TData>;

export function DataTableBody<TData extends RowData>({
  table,
  empty,
}: {
  table: AdminTable<TData>;
  empty: string;
}) {
  // Đọc qua kiểu của bộ RỘNG hơn: thân bảng chỉ gọi header group / row model /
  // visible cells — API mà cả hai bộ đều có, và bộ selectable là superset nên
  // ép kiểu ở đây không mở ra lời gọi nào mà bảng thường không trả lời được.
  const view = table as TanstackTable<typeof selectableTableFeatures, TData>;

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-muted">
        {view.getHeaderGroups().map((headerGroup) => (
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
        {view.getRowModel().rows.length ? (
          view.getRowModel().rows.map((row) => (
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
            <TableCell colSpan={view.getVisibleLeafColumns().length} className="h-24 text-center">
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/**
 * HỢP ĐỒNG TỐI THIỂU mà menu cột cần ở một bảng — cố ý KHÔNG mượn kiểu
 * `Table` đầy đủ của TanStack.
 *
 * Lý do: v9 dựng kiểu `Column` bằng conditional type theo BỘ FEATURE CỤ THỂ.
 * Viết `<TFeatures extends TableFeatures>` thì `getAllColumns()` trả về một
 * union mà TS không narrow nổi, và `getCanHide`/`toggleVisibility` biến mất
 * khỏi kiểu — đã thử, không đi được. Khai đúng thứ mình đụng tới thì cả bảng
 * vùng (`serverTableFeatures`) lẫn bảng dashboard (thêm sorting/pagination/
 * selection) đều lọt, mà không phải ép kiểu chỗ nào.
 */
interface HideableColumn {
  id: string;
  /** Có `accessorFn` nghĩa là cột dữ liệu thật, không phải display-column. */
  accessorFn?: unknown;
  columnDef: { header?: unknown };
  getCanHide: () => boolean;
  getIsVisible: () => boolean;
  toggleVisibility: (value: boolean) => void;
}

interface ColumnVisibilityTable {
  getAllColumns: () => HideableColumn[];
}

/**
 * Menu Columns — nhãn lấy từ `labels` (map `column.id` → copy i18n); thiếu thì
 * rơi về `header` nếu là chuỗi, cuối cùng mới tới `column.id` thô. Cột không
 * ẩn được hoặc display-column không vào menu.
 *
 * Hình dạng theo `dropdown-menu-12` của Shadcn Studio (user chốt 01/09): menu
 * rộng `w-56`, có tiêu đề nhóm, và MỖI MỤC MANG MỘT ICON bên trái. Bản
 * registry là menu thường; checkbox là phần user dặn thêm vào.
 *
 * Hai thứ đó ghép được trọn vẹn vì `DropdownMenuCheckboxItem` của repo đặt
 * dấu tích ở BÊN PHẢI (`absolute right-2` + `pr-8` chừa chỗ), nên slot trái
 * bỏ trống — đúng chỗ bản registry để icon. Mỗi dòng thành: icon · nhãn ·
 * dấu tích, và ba thứ nói ba việc khác nhau (cột gì · tên gì · đang bật hay
 * không) thay vì tranh nhau một chỗ.
 *
 * `DropdownMenuGroup` bọc quanh là bắt buộc, không phải trang trí: menu item
 * phải nằm trong group của nó (luật composition của shadcn) — bản trước để
 * checkbox item trần trong `DropdownMenuContent`, và `DropdownMenuLabel`
 * (render ra `MenuPrimitive.GroupLabel`) cần một group thật để gắn nhãn vào.
 */
export function ColumnVisibilityMenu({
  table,
  labels,
  icons,
}: {
  table: ColumnVisibilityTable;
  labels: Record<string, string>;
  /**
   * Icon cho từng `column.id`. Vùng tự cấp chứ không phải kit: "cột này nói
   * về cái gì" là kiến thức của bảng đó. Cột không khai icon vẫn chạy, chỉ là
   * mất chỗ đứng đầu dòng.
   */
  icons?: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className={TOOLBAR_BUTTON} />}>
        <Columns3Icon data-icon="inline-start" />
        {messages.admin.table.columns}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      {/* `w-56` của bản registry thay cho `w-40` cũ: thêm một cột icon vào mỗi
          dòng thì `w-40` bắt nhãn dài như "Requested at" xuống dòng. */}
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{messages.admin.table.columnsMenuLabel}</DropdownMenuLabel>
          {table
            .getAllColumns()
            .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
            .map((column) => {
              const Icon = icons?.[column.id];

              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {/* KHÔNG đắp `size-4`: item đã sẵn
                      `[&_svg:not([class*='size-'])]:size-4`, tự nó lo cỡ. */}
                  {Icon ? <Icon aria-hidden="true" /> : null}
                  {labels[column.id] ??
                    (typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id)}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
