'use client';

import { messages } from '@tourism/i18n';
import * as React from 'react';
import { BookingLink } from '@/components/kit/booking-link';
import { JsonDrawer, JsonDrawerField, JsonDrawerFields } from '@/components/kit/json-drawer';
import { UnprocessedBadge } from '@/components/payment-events/unprocessed-badge';
import {
  loadErrorCopy,
  type PaymentEventLoader,
  type PaymentEventLoadResult,
} from '@/lib/payment-events-detail';
import type { PaymentEventRowVM } from '@/lib/payment-events-view';

/**
 * Drawer chi tiết MỘT payment event (spec P4c §3-F8) — consumer thứ hai của
 * kit `JsonDrawer`. Khác F7: list KHÔNG mang payload, nên khi mở drawer gọi
 * `load` (server action `getPaymentEventAction`, truyền từ trang như một
 * prop — client component không tự import server action, nếp F2) và đi qua
 * ba trạng thái tải của kit. Các field bảng thì có sẵn trong VM, hiện ngay.
 *
 * Trạng thái tải GẮN VỚI ID (vòng vá review F8): `state.id` là hàng mà
 * kết quả thuộc về; render chỉ tin nó khi trùng `rowId` đang mở, còn lại coi
 * như đang tải. Nhờ đó (a) đổi từ hàng A sang hàng B không có một frame in
 * JSON của A dưới tiêu đề B (effect chạy SAU paint, `setState(loading)`
 * trong effect là quá muộn cho frame đầu), (b) kết quả A về muộn không ghi
 * đè B — cùng lưới `current` chặn set sau cleanup. Loader ném (server action
 * đứt mạng, action throw) đi vào nhánh lỗi GENERIC thay vì để drawer treo ở
 * "Loading…" vô hạn.
 *
 * Bảng giữ MỘT instance, truyền hàng đang mở qua `row` — 50 hàng không mount
 * 50 sheet.
 */
const t = messages.admin.paymentEvents;

type LoadState =
  | { id: string; status: 'loading' }
  | { id: string; status: 'ready'; payload: unknown }
  | { id: string; status: 'error'; message: string };

export function PaymentEventDetailSheet({
  row,
  onClose,
  load,
}: {
  /** Hàng đang mở; `null` = đóng. */
  row: PaymentEventRowVM | null;
  onClose: () => void;
  load: PaymentEventLoader;
}) {
  const [state, setState] = React.useState<LoadState | null>(null);
  const rowId = row?.id ?? null;

  React.useEffect(() => {
    if (rowId === null) return;
    let current = true;
    load({ id: rowId })
      .then((result: PaymentEventLoadResult) => {
        if (!current) return;
        setState(
          result.ok
            ? { id: rowId, status: 'ready', payload: result.event.payload }
            : { id: rowId, status: 'error', message: loadErrorCopy(result.code) },
        );
      })
      .catch(() => {
        if (!current) return;
        setState({ id: rowId, status: 'error', message: loadErrorCopy('GENERIC') });
      });
    return () => {
      current = false;
    };
  }, [rowId, load]);

  // Chỉ tin state của ĐÚNG hàng đang mở; state của hàng khác là "đang tải".
  const view: LoadState | null = state && state.id === rowId ? state : null;

  return (
    <JsonDrawer
      open={row !== null}
      onClose={onClose}
      title={t.detail.title}
      description={row ? t.detail.description(row.eventId) : ''}
      jsonLabel={t.detail.payload}
      json={view?.status === 'ready' ? view.payload : undefined}
      loadingLabel={t.detail.loading}
      error={view?.status === 'error' ? view.message : null}
    >
      {row ? (
        <JsonDrawerFields>
          <JsonDrawerField label={t.detail.provider} value={row.providerLabel} />
          <JsonDrawerField label={t.detail.type} value={row.typeLabel} />
          <JsonDrawerField
            label={t.detail.amount}
            value={row.amount ?? messages.admin.bookings.detail.empty}
          />
          <JsonDrawerField
            label={t.detail.booking}
            value={<BookingLink code={row.bookingCode} fallback={t.list.noBooking} />}
          />
          <JsonDrawerField label={t.detail.received} value={row.received} />
          <JsonDrawerField
            label={t.detail.processed}
            value={row.processed ?? <UnprocessedBadge />}
          />
        </JsonDrawerFields>
      ) : null}
    </JsonDrawer>
  );
}
