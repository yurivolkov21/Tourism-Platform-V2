'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { DownloadIcon, PrinterIcon } from 'lucide-react';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';
import { ReportsMonthMenu } from '@/components/reports/reports-month-menu';
import { reportsExportHref } from '@/lib/reports-query';

/**
 * Thanh điều khiển của `/reports` (spec P4b §3-F6): chọn tháng · tải CSV · in.
 *
 * Cùng nếp URL-state với ba bảng vùng — chọn tháng là ĐIỀU HƯỚNG, server
 * component đọc lại `searchParams` rồi fetch. Không có state báo cáo nào ở
 * client, nên link tháng nào cũng share/bookmark được.
 *
 * Cả thanh mang `print:hidden`: bản in không có chỗ cho ba nút bấm, và một tờ
 * giấy in hình cái nút "Print" là thứ ai cũng nhận ra là lỗi.
 *
 * Ô tháng tách sang `reports-month-menu.tsx` ngày 03/09: nó thôi là Select và
 * thành menu theo khuôn `dropdown-menu-10`, cùng kiểu với ba nút lọc của
 * `/outbox`, `/payment-events`, `/subscribers`.
 */
const t = messages.admin.reports;

export interface ReportsToolbarProps {
  month: string;
  options: Array<{ value: string; label: string }>;
}

export function ReportsToolbar({ month, options }: ReportsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6 print:hidden">
      <div className="flex items-center gap-2">
        <ReportsMonthMenu month={month} options={options} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Nút in chỉ gọi hộp thoại in của trình duyệt — "xuất PDF" của F6 là
            chính nó (đường 0-dependency: không thư viện PDF nào được thêm). */}
        <Button variant="outline" className={TOOLBAR_BUTTON} onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" aria-hidden="true" />
          {t.print}
        </Button>
        <ButtonLink variant="outline" className={TOOLBAR_BUTTON} href={reportsExportHref(month)}>
          <DownloadIcon data-icon="inline-start" aria-hidden="true" />
          {t.exportCsv}
        </ButtonLink>
      </div>
    </div>
  );
}
