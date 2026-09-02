'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@tourism/ui/components/sheet';
import { type OutboxRowVM, outboxStatusBadgeVariant } from '@/lib/outbox-view';

/**
 * Drawer chi tiết MỘT hàng outbox (spec P4c §3-F7): payload JSON nguyên văn
 * (thụt lề, mono, cuộn) + `lastError` đầy đủ + các field bảng đã cắt ngắn.
 *
 * Quyết định tự chọn của F7: `Sheet` (panel trượt từ phải) chứ không phải
 * `Dialog`. Payload là khối cao không biết trước (booking confirmation mang
 * cả itinerary), panel toàn chiều cao cuộn tự nhiên và giữ bảng phía sau làm
 * ngữ cảnh — đúng nghĩa "drawer" spec gọi tên; dialog giữa màn sẽ phải tự
 * giới hạn chiều cao rồi cuộn trong cuộn.
 *
 * Để ở VÙNG (`components/outbox/`), chưa lên kit: F8 (payment events) là
 * consumer thứ hai và sẽ nâng nó thành `kit/json-drawer.tsx` (spec §2.6).
 *
 * Bảng giữ MỘT instance, truyền hàng đang mở qua `row` — 50 hàng không mount
 * 50 sheet.
 */
const t = messages.admin.outbox.detail;

export function OutboxDetailSheet({
  row,
  onClose,
}: {
  /** Hàng đang mở; `null` = đóng. */
  row: OutboxRowVM | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {/* Rộng hơn mặc định `sm:max-w-sm`: JSON thụt lề 2 khoảng ở 24rem gãy
          dòng liên tục, đọc không ra cấu trúc. */}
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle>{t.title}</SheetTitle>
              <SheetDescription className="break-all font-mono text-xs">
                {t.description(row.dedupeKey)}
              </SheetDescription>
            </SheetHeader>

            <dl className="grid gap-2 px-4 text-sm">
              <Field label={t.type} value={row.typeLabel} />
              <Field
                label={t.recipient}
                value={row.recipient ?? messages.admin.outbox.list.noRecipient}
              />
              <div className="grid grid-cols-[8rem_1fr] gap-2">
                <dt className="text-muted-foreground">{t.status}</dt>
                <dd>
                  <Badge variant={outboxStatusBadgeVariant(row.status)} className="px-1.5">
                    {row.statusLabel}
                  </Badge>
                </dd>
              </div>
              <Field label={t.attempts} value={row.attemptsLabel} />
              <Field label={t.created} value={row.created} />
              <Field
                label={t.processed}
                value={row.processed ?? messages.admin.bookings.detail.empty}
              />
            </dl>

            <section aria-label={t.lastError} className="grid gap-1.5 px-4">
              <h3 className="text-sm font-medium">{t.lastError}</h3>
              {/* Nguyên văn, KHÔNG cắt — bảng đã cắt bằng CSS, đây là chỗ đọc đủ. */}
              <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
                {row.lastError ?? t.noError}
              </p>
            </section>

            <section aria-label={t.payload} className="grid gap-1.5 px-4 pb-4">
              <h3 className="text-sm font-medium">{t.payload}</h3>
              {/* JSON là DỮ LIỆU để soi, không map thành form (spec §2.3).
                  `overflow-auto` cho cả hai chiều: chuỗi dài không gãy cấu trúc
                  thụt lề. */}
              <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
                {row.payloadJson}
              </pre>
            </section>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
