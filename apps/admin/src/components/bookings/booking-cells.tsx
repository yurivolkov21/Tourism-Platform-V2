import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { BanknoteIcon, MapPinIcon, TagIcon, UserIcon, UsersIcon } from 'lucide-react';
import { type BookingRowVM, statusBadgeVariant } from '@/lib/bookings-view';

/**
 * Ô THÂN dùng chung của hai bảng booking — `/bookings` và "Recent bookings"
 * trên dashboard (ADR-0036 §3). Tách ra để hai bảng không thành hai bản chép
 * của cùng năm ô (đó chính là "fork rút gọn" mà nếp 31/08 cấm); phần riêng
 * của mỗi bảng chỉ còn cột chọn/xuất, toolbar và footer.
 *
 * Ô KHÔNG tính gì: mọi con chữ đã được `toBookingRow` (thuần, có test) nấu sẵn.
 */
const t = messages.admin.bookings.list;

/** Nhãn menu ẩn/hiện — khoá theo `column.id`, chỉ cột ẩn ĐƯỢC mới cần entry. */
export const BOOKING_COLUMN_LABELS: Record<string, string> = {
  tourTitle: t.columns.tour,
  statusLabel: t.columns.status,
  guests: t.columns.guests,
  amount: t.columns.amount,
  customerName: t.columns.customer,
};

/**
 * Icon đầu mỗi dòng trong menu Columns (khuôn `dropdown-menu-12`, user chốt
 * 01/09). Cùng bộ khoá với `BOOKING_COLUMN_LABELS`, để đổi tên một cột là
 * thấy ngay cả hai chỗ phải sửa.
 */
export const BOOKING_COLUMN_ICONS = {
  tourTitle: MapPinIcon,
  statusLabel: TagIcon,
  guests: UsersIcon,
  amount: BanknoteIcon,
  customerName: UserIcon,
};

export function TourCell({ row }: { row: BookingRowVM }) {
  return (
    <div className="max-w-64">
      <div className="truncate">{row.tourTitle}</div>
      <div className="truncate text-xs text-muted-foreground">{row.departure}</div>
    </div>
  );
}

export function StatusCell({ row }: { row: BookingRowVM }) {
  return (
    <Badge variant={statusBadgeVariant(row.status)} className="px-1.5">
      {row.statusLabel}
    </Badge>
  );
}

export function GuestsCell({ row }: { row: BookingRowVM }) {
  return (
    <div className="text-right tabular-nums" title={row.guestsLabel}>
      {row.guests}
    </div>
  );
}

export function AmountCell({ row }: { row: BookingRowVM }) {
  return <div className="text-right tabular-nums">{row.amount}</div>;
}

export function CustomerCell({ row }: { row: BookingRowVM }) {
  return (
    <div className="max-w-56">
      <div className="truncate">{row.customerName}</div>
      <div className="truncate text-xs text-muted-foreground">{row.customerEmail}</div>
    </div>
  );
}

/** Tiêu đề cột số — canh phải như ô của nó. */
export function RightHeader({ children }: { children: string }) {
  return <div className="w-full text-right">{children}</div>;
}
