'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import {
  JsonDrawer,
  JsonDrawerField,
  JsonDrawerFields,
  JsonDrawerText,
} from '@/components/kit/json-drawer';
import { type OutboxRowVM, outboxStatusBadgeVariant } from '@/lib/outbox-view';

/**
 * Drawer chi tiết MỘT hàng outbox (spec P4c §3-F7): payload JSON nguyên văn
 * (thụt lề, mono, cuộn) + `lastError` đầy đủ + các field bảng đã cắt ngắn.
 *
 * Vỏ panel + khối JSON là kit `JsonDrawer` (F8 nâng lên khi trở thành
 * consumer thứ hai, spec §2.6); ở đây chỉ còn phần RIÊNG của outbox: bảy
 * field và khối lỗi. Payload đã có sẵn trong VM (list outbox mang payload)
 * nên drawer này không bao giờ ở trạng thái tải.
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
    <JsonDrawer
      open={row !== null}
      onClose={onClose}
      title={t.title}
      description={row ? t.description(row.dedupeKey) : ''}
      jsonLabel={t.payload}
      // Payload không bao giờ vắng ở outbox — `null` là một giá trị JSON hợp
      // lệ, chỉ `undefined` mới là "đang tải" với kit.
      json={row ? row.payload : null}
      loadingLabel=""
    >
      {row ? (
        <>
          <JsonDrawerFields>
            <JsonDrawerField label={t.type} value={row.typeLabel} />
            <JsonDrawerField
              label={t.recipient}
              value={row.recipient ?? messages.admin.outbox.list.noRecipient}
            />
            <JsonDrawerField
              label={t.status}
              value={
                <Badge variant={outboxStatusBadgeVariant(row.status)} className="px-1.5">
                  {row.statusLabel}
                </Badge>
              }
            />
            <JsonDrawerField label={t.attempts} value={row.attemptsLabel} />
            <JsonDrawerField label={t.created} value={row.created} />
            <JsonDrawerField
              label={t.processed}
              value={row.processed ?? messages.admin.bookings.detail.empty}
            />
          </JsonDrawerFields>
          {/* Nguyên văn, KHÔNG cắt — bảng đã cắt bằng CSS, đây là chỗ đọc đủ. */}
          <JsonDrawerText label={t.lastError} text={row.lastError ?? t.noError} />
        </>
      ) : null}
    </JsonDrawer>
  );
}
