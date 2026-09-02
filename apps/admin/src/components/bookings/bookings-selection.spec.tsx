import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { BookingRowVM } from '@/lib/bookings-view';
import { BookingsTable } from './bookings-table';

/**
 * Cột checkbox + nút Export trong hàng tiêu đề (spec 01/09).
 *
 * Ràng buộc nền, và là thứ định nghĩa cả tính năng: việc chọn KHOÁ trong trang
 * đang xem. Nhưng "khoá" không tự có: đổi trang/lọc là soft navigation cùng
 * segment nên React GIỮ state của bảng (vòng vá review 02/09) — bảng phải tự
 * đặt lại tích khi query đổi, và nhãn checkbox tiêu đề phải NÓI RA "cả trang"
 * thay vì hứa "select all".
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const t = messages.admin.bookings.list;

function row(code: string, name: string): BookingRowVM {
  return {
    code,
    tourTitle: 'Ha Long overnight',
    status: 'PAID',
    statusLabel: 'Paid',
    guests: 2,
    guestsLabel: '2 adults',
    amount: '$49.00',
    customerName: name,
    customerEmail: `${name.toLowerCase()}@x.test`,
    departure: '24 Sep 2026',
    href: `/bookings/${code}`,
  };
}

const ROWS = [row('BK-A', 'Ada'), row('BK-B', 'Bob')];

function view(total = 2) {
  return render(
    <BookingsTable rows={ROWS} query={{ page: 1, limit: 20 }} total={total} totalPages={1} />,
  );
}

/** Nút export là một `<a>` thật (tải file), nên tìm theo role link. */
function exportLink(name: string) {
  return screen.getByRole('link', { name: new RegExp(name) });
}

describe('BookingsTable — chọn hàng để export', () => {
  it('chưa tích gì: nút xuất CẢ TẬP đang lọc, URL không mang page/limit', () => {
    view();

    expect(exportLink(t.exportCsv)).toHaveAttribute('href', '/bookings/export');
  });

  it('tích một hàng: nhãn đếm đúng và URL mang sel + phạm vi trang', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('BK-A') }));

    expect(exportLink(t.exportSelected(1))).toHaveAttribute(
      'href',
      '/bookings/export?page=1&limit=20&sel=BK-A',
    );
  });

  it('checkbox tiêu đề chọn CẢ TRANG, bấm lại thì bỏ hết', async () => {
    const user = userEvent.setup();
    view();
    const all = screen.getByRole('checkbox', { name: t.selectAllRows });

    await user.click(all);
    expect(exportLink(t.exportSelected(2))).toBeInTheDocument();

    await user.click(all);
    expect(exportLink(t.exportCsv)).toBeInTheDocument();
  });

  it('tích lẻ: checkbox tiêu đề ở trạng thái MỘT PHẦN, không phải đã-chọn', async () => {
    // Nếu nó báo "đã chọn" khi mới tích 1/2 hàng thì một cú bấm tiếp theo sẽ
    // BỎ hết thay vì chọn nốt — đúng kiểu mất dữ liệu thầm lặng.
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('BK-A') }));

    expect(screen.getByRole('checkbox', { name: t.selectAllRows })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });

  it('sang trang (query đổi) ĐẶT LẠI tích: checkbox tiêu đề không kẹt "một phần"', async () => {
    // Vòng vá review 02/09: bản đầu tin state chết theo điều hướng. Thực tế
    // React giữ nguyên instance, và `getIsSomeRowsSelected` của TanStack v9
    // đếm KEY trong state chứ không đếm hàng đang hiện — key lạc từ trang 1
    // làm ô tiêu đề trang 2 hiện `mixed` dù không hàng nào tích, và bấm hai
    // lần cũng không gỡ được.
    const user = userEvent.setup();
    const { rerender } = render(
      <BookingsTable rows={ROWS} query={{ page: 1, limit: 20 }} total={4} totalPages={2} />,
    );
    await user.click(screen.getByRole('checkbox', { name: t.selectRow('BK-A') }));
    expect(exportLink(t.exportSelected(1))).toBeInTheDocument();

    const PAGE_2 = [row('BK-C', 'Cy'), row('BK-D', 'Di')];
    rerender(
      <BookingsTable rows={PAGE_2} query={{ page: 2, limit: 20 }} total={4} totalPages={2} />,
    );

    expect(exportLink(t.exportCsv)).toHaveAttribute('href', '/bookings/export');
    expect(screen.getByRole('checkbox', { name: t.selectAllRows })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    // Quay lại trang 1: tích cũ KHÔNG sống lại.
    rerender(<BookingsTable rows={ROWS} query={{ page: 1, limit: 20 }} total={4} totalPages={2} />);
    expect(screen.getByRole('checkbox', { name: t.selectRow('BK-A') })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('vượt trần export: nút TẮT khi xuất cả tập, nhưng có tích thì vẫn bấm được', async () => {
    // Trần 2000 chỉ nói về ca export-all. Có tích thì số hàng ≤ limit, tắt nút
    // là chặn một việc hoàn toàn làm được.
    const user = userEvent.setup();
    view(5000);
    expect(screen.queryByRole('link', { name: new RegExp(t.exportCsv) })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('BK-A') }));

    expect(exportLink(t.exportSelected(1))).toBeInTheDocument();
  });
});
