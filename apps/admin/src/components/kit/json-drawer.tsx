'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@tourism/ui/components/sheet';
import * as React from 'react';

/**
 * Drawer xem MỘT bản ghi kèm khối JSON (kit P4c — nâng từ `OutboxDetailSheet`
 * của F7 khi F8 payment events là consumer thứ hai, spec P4c §2.6): panel
 * trượt từ phải, tiêu đề + dòng mô tả mono (khoá định danh của hàng), các
 * field của vùng ở trên, khối JSON thụt lề/mono/cuộn ở dưới.
 *
 * Vì sao `Sheet` chứ không `Dialog` (quyết định F7 giữ nguyên): payload là
 * khối cao không biết trước, panel toàn chiều cao cuộn tự nhiên và giữ bảng
 * phía sau làm ngữ cảnh; dialog giữa màn phải tự giới hạn chiều cao rồi cuộn
 * trong cuộn.
 *
 * Kit lo đúng phần CHUNG: vỏ panel + ba trạng thái của khối JSON (đang tải ·
 * có dữ liệu · lỗi — F8 fetch `byId` khi mở vì list không mang payload, F7
 * đưa thẳng dữ liệu đã có nên không bao giờ ở trạng thái tải). Field nào,
 * nhãn gì, có khối lỗi hay không là của vùng — truyền qua `children` bằng
 * ba mảnh `JsonDrawerFields`/`JsonDrawerField`/`JsonDrawerText` bên dưới.
 *
 * JSON là DỮ LIỆU để soi, không map thành form (spec §2.3). Thụt lề ĐÚNG dữ
 * liệu đang mở, một lần (`useMemo` khoá theo `json`, vòng vá review F7): bảng
 * không nấu sẵn chuỗi cho cả trang.
 *
 * Bảng giữ MỘT instance, mở/đóng qua `open` — 50 hàng không mount 50 panel.
 */
export interface JsonDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Khoá định danh của hàng (dedupeKey, eventId) — in mono, cho phép gãy. */
  description: string;
  /** Field/section của vùng, render TRÊN khối JSON. */
  children?: React.ReactNode;
  /** Tiêu đề khối JSON ("Payload (JSON)"). */
  jsonLabel: string;
  /** Dữ liệu để thụt lề; `undefined` = đang tải (in `loadingLabel`). */
  json: unknown;
  loadingLabel: string;
  /** Lỗi tải dữ liệu — thay khối JSON bằng câu này (vai `alert`). */
  error?: string | null;
}

export function JsonDrawer({
  open,
  onClose,
  title,
  description,
  children,
  jsonLabel,
  json,
  loadingLabel,
  error,
}: JsonDrawerProps) {
  const pretty = React.useMemo(
    () => (json === undefined ? undefined : JSON.stringify(json, null, 2)),
    [json],
  );

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {/* Rộng hơn mặc định `sm:max-w-sm`: JSON thụt lề 2 khoảng ở 24rem gãy
          dòng liên tục, đọc không ra cấu trúc. */}
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {open ? (
          <>
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription className="break-all font-mono text-xs">
                {description}
              </SheetDescription>
            </SheetHeader>

            {children}

            <section aria-label={jsonLabel} className="grid gap-1.5 px-4 pb-4">
              <h3 className="text-sm font-medium">{jsonLabel}</h3>
              {error ? (
                <p role="alert" className="rounded-md border bg-muted/40 p-3 text-xs">
                  {error}
                </p>
              ) : pretty === undefined ? (
                <p aria-busy="true" className="rounded-md border bg-muted/40 p-3 text-xs">
                  {loadingLabel}
                </p>
              ) : (
                /* `overflow-auto` cho cả hai chiều: chuỗi dài không gãy cấu
                   trúc thụt lề. */
                <pre
                  data-testid="json-drawer-json"
                  className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs"
                >
                  {pretty}
                </pre>
              )}
            </section>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Danh sách field nhãn · giá trị của vùng (`<dl>` hai cột). */
export function JsonDrawerFields({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-2 px-4 text-sm">{children}</dl>;
}

/** Một dòng nhãn · giá trị. `value` là node để vùng đặt badge/link khi cần. */
export function JsonDrawerField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

/**
 * Khối chữ nguyên văn (lỗi, ghi chú dài) — bảng đã cắt bằng CSS, đây là chỗ
 * đọc đủ. Mono + `whitespace-pre-wrap` để stack trace giữ xuống dòng.
 */
export function JsonDrawerText({ label, text }: { label: string; text: string }) {
  return (
    <section aria-label={label} className="grid gap-1.5 px-4">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {text}
      </p>
    </section>
  );
}
