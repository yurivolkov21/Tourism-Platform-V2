import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { parseOutboxSearchParams } from '@/lib/outbox-query';
import type { OutboxRowVM } from '@/lib/outbox-view';
import { OutboxTable } from './outbox-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/outbox',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Bảng `/outbox` không cuộn ngang ở 1440px (spec 2026-10-05 §4 #6). Đo bằng trình duyệt thật ở
 * Task 19: trang hàng FAILED với dedupe key, người nhận và lỗi dài còn cuộn 120px với ba trần cũ
 * (208/192/160px), 146px khi ngày có hai chữ số; khung bảng chỉ rộng 1094px. Spec ghim ba trần
 * mới và luật "chuỗi đầy đủ vẫn ở `title`" — jsdom không dàn trang nên không đo được bề rộng.
 */
const t = messages.admin.outbox;

const LONG_KEY = 'booking-confirmation:3f2b9c1e-8a7d-4e6f-b5c4-d3e2f1a0b9c8';
const LONG_RECIPIENT = 'maximilian.alexander.von-hohenberg@university-of-somewhere.example.com';
const LONG_ERROR =
  'Resend API error 403 validation_error: You can only send testing emails to your own email address.';

const ROW: OutboxRowVM = {
  id: '4f2a1b3c-0000-4000-8000-000000000019',
  type: 'BOOKING_CONFIRMATION',
  typeLabel: t.type.BOOKING_CONFIRMATION,
  recipient: LONG_RECIPIENT,
  status: 'FAILED',
  statusLabel: t.status.FAILED,
  attempts: 5,
  attemptsLabel: '5/5',
  lastError: LONG_ERROR,
  created: '28 May 2026, 23:58 UTC',
  processed: '28 May 2026, 23:59 UTC',
  nextAttempt: null,
  dedupeKey: LONG_KEY,
  payload: { to: LONG_RECIPIENT },
  retried: false,
  canRetry: true,
};

describe('OutboxTable — ba ô bị cắt', () => {
  it('Type, Recipient, Last error cắt ở trần đo cho 1440px, chuỗi đầy đủ vẫn ở title', () => {
    render(
      <OutboxTable
        rows={[ROW]}
        query={parseOutboxSearchParams({})}
        total={1}
        totalPages={1}
        retry={vi.fn()}
      />,
    );

    // Dòng dedupe key nằm trong khối Type — trần đặt ở khối, nhãn loại email dài nhất vẫn vừa.
    const key = screen.getByText(LONG_KEY);
    expect(key).toHaveAttribute('title', LONG_KEY);
    expect(key.parentElement).toHaveClass('max-w-44');

    const recipient = screen.getByText(LONG_RECIPIENT);
    expect(recipient).toHaveAttribute('title', LONG_RECIPIENT);
    expect(recipient).toHaveClass('max-w-36', 'truncate');

    const error = screen.getByText(LONG_ERROR);
    expect(error).toHaveAttribute('title', LONG_ERROR);
    expect(error).toHaveClass('max-w-20', 'truncate');
  });
});

describe('OutboxTable — ô Attempts', () => {
  it('nhãn dài xuống dòng dưới trần thay vì kéo bảng cuộn ngang, chữ giữ nguyên (Ruling F-a)', () => {
    // Đo ở 1440px trước bản vá: trang có hàng SKIPPED giữa các hàng FAILED cuộn 125–152px vì ô
    // này `whitespace-nowrap` — chữ "Not sent — recipient unsubscribed" rộng 213px.
    const skippedRow: OutboxRowVM = {
      ...ROW,
      id: '4f2a1b3c-0000-4000-8000-000000000020',
      status: 'SKIPPED',
      statusLabel: t.status.SKIPPED,
      attempts: 0,
      attemptsLabel: t.list.skipped,
      lastError: null,
      dedupeKey: 'newsletter-welcome:0a1b2c3d',
      retried: false,
      canRetry: false,
    };
    render(
      <OutboxTable
        rows={[ROW, skippedRow]}
        query={parseOutboxSearchParams({})}
        total={2}
        totalPages={1}
        retry={vi.fn()}
      />,
    );

    const label = screen.getByText(t.list.skipped);
    expect(label).toHaveClass('max-w-36', 'whitespace-normal', 'text-balance');
    expect(label).not.toHaveClass('whitespace-nowrap');
    // Nhãn ngắn dùng chung ô ấy — ngắn hơn trần nên vẫn một dòng (đo trên Edge; jsdom không dàn
    // trang nên ở đây chỉ canh class).
    expect(screen.getByText('5/5')).toHaveClass('max-w-36', 'whitespace-normal');
  });
});
