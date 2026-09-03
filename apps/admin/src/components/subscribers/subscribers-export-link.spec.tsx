import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { EXPORT_MAX_ROWS } from '@/lib/export-pages';
import { SubscribersExportLink } from './subscribers-export-link';

/**
 * Nút Export CSV của `/subscribers` tự tắt khi tập vượt trần (cùng luật với
 * `/bookings`, spec có từ vòng vá review F10): trần là thứ biết được TRƯỚC cú
 * click, và một `<a>` nhận 413 là một cú điều hướng thật đá admin khỏi bảng.
 */
const t = messages.admin.subscribers.list;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('SubscribersExportLink', () => {
  it('tập trong trần → là một <a> thật trỏ route export, mang đủ filter (tab Active mặc định không viết ra)', () => {
    render(
      <SubscribersExportLink
        query={{ page: 2, limit: 20, active: true, search: 'ada' }}
        total={EXPORT_MAX_ROWS}
      />,
    );
    expect(screen.getByRole('link', { name: t.exportCsv })).toHaveAttribute(
      'href',
      '/subscribers/export?q=ada',
    );
  });

  it('tập vượt trần → nút TẮT kèm chính câu 413 làm tooltip, không có <a> nào để bấm', () => {
    const total = EXPORT_MAX_ROWS + 1;
    render(<SubscribersExportLink query={{ page: 1, limit: 20 }} total={total} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.exportCsv })).toBeDisabled();
    expect(screen.getByTitle(t.exportTooLarge(total, EXPORT_MAX_ROWS))).toBeInTheDocument();
  });
});
