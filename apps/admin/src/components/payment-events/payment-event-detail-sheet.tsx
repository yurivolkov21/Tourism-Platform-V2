'use client';

import { messages } from '@tourism/i18n';
import Link from 'next/link';
import * as React from 'react';
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
 * Kết quả về muộn của hàng đã đóng/đã đổi bị bỏ qua (so id lúc về với id
 * đang mở) — bấm nhanh hai hàng không được để hàng cũ ghi đè hàng mới.
 *
 * Bảng giữ MỘT instance, truyền hàng đang mở qua `row` — 50 hàng không mount
 * 50 sheet.
 */
const t = messages.admin.paymentEvents;

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; payload: unknown }
  | { status: 'error'; message: string };

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
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const rowId = row?.id ?? null;

  React.useEffect(() => {
    if (rowId === null) return;
    let current = true;
    setState({ status: 'loading' });
    load({ id: rowId }).then((result: PaymentEventLoadResult) => {
      if (!current) return;
      setState(
        result.ok
          ? { status: 'ready', payload: result.event.payload }
          : { status: 'error', message: loadErrorCopy(result.code) },
      );
    });
    return () => {
      current = false;
    };
  }, [rowId, load]);

  return (
    <JsonDrawer
      open={row !== null}
      onClose={onClose}
      title={t.detail.title}
      description={row ? t.detail.description(row.eventId) : ''}
      jsonLabel={t.detail.payload}
      json={state.status === 'ready' ? state.payload : undefined}
      loadingLabel={t.detail.loading}
      error={state.status === 'error' ? state.message : null}
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
            value={
              row.bookingHref && row.bookingCode ? (
                <Link
                  href={row.bookingHref}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {row.bookingCode}
                </Link>
              ) : (
                <span className="text-muted-foreground">{t.list.noBooking}</span>
              )
            }
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
