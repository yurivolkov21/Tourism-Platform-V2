'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Label } from '@tourism/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { DownloadIcon, PrinterIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { reportsExportHref, reportsHref } from '@/lib/reports-query';

/**
 * Thanh điều khiển của `/reports` (spec P4b §3-F6): chọn tháng · tải CSV · in.
 *
 * Cùng nếp URL-state với ba bảng vùng — chọn tháng là ĐIỀU HƯỚNG, server
 * component đọc lại `searchParams` rồi fetch. Không có state báo cáo nào ở
 * client, nên link tháng nào cũng share/bookmark được.
 *
 * Cả thanh mang `print:hidden`: bản in không có chỗ cho ba nút bấm, và một tờ
 * giấy in hình cái nút "Print" là thứ ai cũng nhận ra là lỗi.
 */
const t = messages.admin.reports;

export interface ReportsToolbarProps {
  month: string;
  options: Array<{ value: string; label: string }>;
}

export function ReportsToolbar({ month, options }: ReportsToolbarProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6 print:hidden">
      <div className="flex items-center gap-2">
        <Label htmlFor="reports-month" className="sr-only">
          {t.monthLabel}
        </Label>
        <Select
          value={month}
          onValueChange={(next) => router.push(reportsHref(String(next)))}
          items={options}
        >
          <SelectTrigger className="w-48" size="sm" id="reports-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Nút in chỉ gọi hộp thoại in của trình duyệt — "xuất PDF" của F6 là
            chính nó (đường 0-dependency: không thư viện PDF nào được thêm). */}
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" aria-hidden="true" />
          {t.print}
        </Button>
        <ButtonLink variant="outline" size="sm" href={reportsExportHref(month)}>
          <DownloadIcon data-icon="inline-start" aria-hidden="true" />
          {t.exportCsv}
        </ButtonLink>
      </div>
    </div>
  );
}
