import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { OutboxRowVM } from '@/lib/outbox-view';
import { OutboxDetailSheet } from './outbox-detail-sheet';

/**
 * Drawer chi tiết một hàng outbox (spec P4c §3-F7) — consumer thứ nhất của
 * kit `JsonDrawer`, nhưng tới vòng vá review F8 mới có spec render (F7 chỉ
 * test kit). Pin: payload có sẵn trong VM nên KHÔNG BAO GIỜ ở trạng thái
 * tải, `lastError` in đủ, và `null` là một giá trị JSON hợp lệ chứ không
 * phải "đang tải".
 */
const t = messages.admin.outbox;

const ROW: OutboxRowVM = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  type: 'BOOKING_CONFIRMATION',
  typeLabel: t.type.BOOKING_CONFIRMATION,
  recipient: 'ada@example.com',
  status: 'FAILED',
  statusLabel: t.status.FAILED,
  attempts: 5,
  attemptsLabel: '5',
  lastError: 'Resend: 401 invalid api key',
  created: '1 Sep 2026, 10:00 UTC',
  processed: null,
  dedupeKey: 'booking-confirmed:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  payload: { code: 'BK-ABCD1234', email: 'ada@example.com' },
  retried: false,
  canRetry: true,
};

describe('OutboxDetailSheet', () => {
  it('đóng (row null): không render gì', () => {
    render(<OutboxDetailSheet row={null} onClose={vi.fn()} />);
    expect(screen.queryByText(t.detail.title)).not.toBeInTheDocument();
  });

  it('mở: bảy field + lastError nguyên văn + payload thụt lề NGAY (không có trạng thái tải)', () => {
    render(<OutboxDetailSheet row={ROW} onClose={vi.fn()} />);
    expect(screen.getByText(t.detail.title)).toBeInTheDocument();
    expect(screen.getByText(t.detail.description(ROW.dedupeKey))).toBeInTheDocument();
    expect(screen.getByText(t.type.BOOKING_CONFIRMATION)).toBeInTheDocument();
    // Từ 03/09 payload cũng in ra chữ (chế độ Simple), nên `ada@example.com`
    // xuất hiện HAI chỗ: field Recipient và giá trị `email` của payload. Neo
    // vào đúng ô giá trị của field thay vì tìm khắp panel.
    expect(screen.getByText(t.detail.recipient).nextElementSibling).toHaveTextContent(
      'ada@example.com',
    );
    expect(screen.getByText(t.status.FAILED)).toBeInTheDocument();
    expect(screen.getByText(messages.admin.bookings.detail.empty)).toBeInTheDocument();
    expect(screen.getByText('Resend: 401 invalid api key')).toBeInTheDocument();
    // Mặc định là chế độ Simple (kit đổi 03/09): payload hiện ra thành
    // nhãn · giá trị, không phải khối JSON.
    const payload = within(screen.getByTestId('json-drawer-simple'));
    expect(payload.getByText('Code')).toBeInTheDocument();
    expect(payload.getByText('BK-ABCD1234')).toBeInTheDocument();
    expect(payload.getByText('Email')).toBeInTheDocument();
  });

  it('payload null là GIÁ TRỊ, không phải "đang tải"; lastError null in câu "không lỗi"', () => {
    render(
      <OutboxDetailSheet
        row={{ ...ROW, payload: null, lastError: null, status: 'SENT', statusLabel: t.status.SENT }}
        onClose={vi.fn()}
      />,
    );
    // `null` là một giá trị JSON hợp lệ — drawer phải HIỆN nó, không được
    // nhầm thành `undefined` rồi treo ở "đang tải".
    const payload = within(screen.getByTestId('json-drawer-simple'));
    expect(payload.getByText(messages.admin.payload.scalar)).toBeInTheDocument();
    expect(payload.getByText(messages.admin.bookings.detail.empty)).toBeInTheDocument();
    // Có khối payload nghĩa là KHÔNG ở trạng thái tải: kit chỉ render nó khi
    // `json !== undefined`, mà `null` thì khác `undefined`.
    expect(screen.getByText(t.detail.noError)).toBeInTheDocument();
  });
});
