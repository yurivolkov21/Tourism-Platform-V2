'use client';

import { ReportMonthSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { CalendarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  ToolbarFilterMenu,
  type ToolbarFilterMenuGroup,
} from '@/components/kit/toolbar-filter-menu';
import { groupMonthOptions, reportsHref } from '@/lib/reports-query';

/**
 * Ô chọn tháng của `/reports` — kit `ToolbarFilterMenu`.
 *
 * Đây là consumer DUY NHẤT bỏ `allItem`, và chính nó là lý do prop ấy tuỳ
 * chọn: một báo cáo luôn thuộc đúng một tháng, không có trạng thái "mọi
 * tháng" nào để bày — bày thêm là mời bấm vào một báo cáo không tồn tại.
 *
 * Separator cắt ở mỗi lần ĐỔI NĂM (`groupMonthOptions`, logic thuần có test):
 * trong một danh sách 12 tháng, năm là mốc duy nhất mắt cần để bám.
 *
 * Bề rộng: nút tự co theo nhãn như ba nút menu kia — bốn nút phải đọc ra là
 * MỘT control. Ở đây gần như không thấy: thanh `/reports` là
 * `justify-between`, ô tháng đứng một mình bên trái nên nó co giãn vào khoảng
 * trống, không đẩy nút Print/Export nào.
 */
const t = messages.admin.reports;

export interface ReportsMonthMenuProps {
  month: string;
  options: Array<{ value: string; label: string }>;
}

export function ReportsMonthMenu({ month, options }: ReportsMonthMenuProps) {
  const router = useRouter();

  const groups: ToolbarFilterMenuGroup[] = groupMonthOptions(options).map((group) => ({
    key: group.key,
    // `CalendarIcon` là glyph dự án đã dùng cho mốc thời gian (cột Created/
    // Received của ba bảng vùng). Mười hai tháng cùng một icon là đúng: chúng
    // CÙNG một loại thứ, và icon ở đây nói "đây là tháng", không phải "tháng
    // nào" — nhãn đã nói điều đó rồi.
    items: group.months.map((option) => ({ ...option, icon: CalendarIcon })),
  }));

  return (
    <ToolbarFilterMenu
      label={t.monthLabel}
      value={month}
      groups={groups}
      onSelect={(next) => {
        // `safeParse` chứ không `parse`: tháng lạ dừng ở đây, không đẩy tiếp
        // lên URL (nếp bookings, review F1).
        const parsed = ReportMonthSchema.safeParse(next);
        if (parsed.success) router.push(reportsHref(parsed.data));
      }}
    />
  );
}
