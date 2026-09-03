import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { EXPORT_MAX_ROWS } from '@/lib/export-pages';
import { BookingsExportLink } from './bookings-toolbar';

/**
 * Nút Export CSV tự tắt khi tập vượt trần (vòng vá review F6): trần là thứ
 * biết được TRƯỚC cú click (server đã đếm `total`), và một `<a>` nhận 413 là
 * một cú điều hướng thật đá admin khỏi bảng đang lọc.
 */
const t = messages.admin.bookings.list;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('BookingsExportLink', () => {
  it('tập trong trần → là một <a> thật trỏ route export, mang đủ filter', () => {
    render(
      <BookingsExportLink
        query={{ page: 1, limit: 20, status: 'PAID' }}
        total={EXPORT_MAX_ROWS}
        selected={[]}
      />,
    );

    const link = screen.getByRole('link', { name: t.exportCsv });
    expect(link).toHaveAttribute('href', '/bookings/export?status=PAID');
  });

  it('tập vượt trần → nút TẮT kèm chính câu 413 làm tooltip, không có <a> nào để bấm', () => {
    const total = EXPORT_MAX_ROWS + 400;
    render(<BookingsExportLink query={{ page: 1, limit: 20 }} total={total} selected={[]} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.exportCsv })).toBeDisabled();
    expect(screen.getByTitle(t.exportTooLarge(total, EXPORT_MAX_ROWS))).toBeInTheDocument();
  });
});
