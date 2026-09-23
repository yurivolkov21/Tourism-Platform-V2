import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DeparturePhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeparturesQuery } from '@/lib/departures-query';
import { type DepartureRowVM, toDepartureRowVM } from '@/lib/departures-view';
import { makeDepartureRow, serverRow, vmAt } from '@/test/departure-row';
import { DeparturesTable } from './departures-table';

/**
 * Bảng `/tours/[slug]/departures` (spec F16) — soi phần RIÊNG của F16, không
 * soi lại kit: tab lọc theo NHÓM giai đoạn, cột Status in GIAI ĐOẠN thay vì
 * công tắc, và bảng không sập khi hàng thiếu `phase` (khe deploy).
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const t = messages.admin.departures;

const QUERY: DeparturesQuery = { slug: 'hoi-an-lantern-evening', page: 1, limit: 20 };

/** Chuyến 5 ngày 10/10 → 14/10, hạn chót 03/10. */
const ROW = makeDepartureRow();

function renderTable({
  query = QUERY,
  today = '2026-10-01',
  rows = [vmAt(ROW, today)],
}: {
  query?: DeparturesQuery;
  today?: string;
  rows?: DepartureRowVM[];
} = {}) {
  return render(
    <DeparturesTable
      rows={rows}
      query={query}
      total={rows.length}
      totalPages={1}
      tour={{ slug: QUERY.slug, basePriceLabel: '$129.00' }}
      today={today}
      create={vi.fn()}
      update={vi.fn()}
      setStatus={vi.fn()}
      cancel={vi.fn()}
    />,
  );
}

/** Hàng dữ liệu duy nhất của bảng (hàng 0 là tiêu đề). */
function bodyRow() {
  const [, row] = screen.getAllByRole('row');
  if (!row) throw new Error('bảng không có hàng dữ liệu');
  return row;
}

beforeEach(() => {
  push.mockReset();
});

describe('DeparturesTable — tab lọc theo NHÓM giai đoạn', () => {
  it('năm tab theo đúng thứ tự: All rồi bốn nhóm', () => {
    renderTable();

    // Nút tab mang `aria-pressed`; nút hàng và nút công cụ thì không.
    const tabs = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-pressed'));
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      t.list.all,
      t.list.upcoming,
      t.phase.departed,
      t.phase.completed,
      t.phase.cancelled,
    ]);
  });

  it('tab đang lọc là tab được nhấn', () => {
    renderTable({ query: { ...QUERY, phase: 'upcoming' } });

    expect(
      screen.getByRole('button', { name: t.list.upcoming, pressed: true }),
    ).toBeInTheDocument();
  });

  it('bấm một tab đẩy URL mang NHÓM giai đoạn và về trang 1', async () => {
    const user = userEvent.setup();
    renderTable({ query: { ...QUERY, page: 3 } });

    await user.click(screen.getByRole('button', { name: t.phase.completed }));

    expect(push).toHaveBeenCalledWith('/tours/hoi-an-lantern-evening/departures?phase=completed');
  });

  it('bấm All thì xoá tham số', async () => {
    const user = userEvent.setup();
    renderTable({ query: { ...QUERY, phase: 'departed' } });

    await user.click(screen.getByRole('button', { name: t.list.all }));

    expect(push).toHaveBeenCalledWith('/tours/hoi-an-lantern-evening/departures');
  });
});

describe('DeparturesTable — cột Status in GIAI ĐOẠN, không in công tắc', () => {
  it('chuyến đang chạy mà công tắc vẫn OPEN: in Departed kèm icon máy bay', () => {
    renderTable({ today: '2026-10-12' });

    const badge = within(bodyRow()).getByText(t.phase.departed);
    // Ghim luôn dấu `data-slot` mà ca "thiếu phase" bên dưới dựa vào để khẳng
    // định KHÔNG có huy hiệu — thiếu dòng này thì ca ấy có thể xanh suông.
    expect(badge).toHaveAttribute('data-slot', 'badge');
    expect(badge.querySelector('svg')).toHaveClass('lucide-plane');
    expect(within(bodyRow()).queryByText(t.phase['on-sale'])).not.toBeInTheDocument();
  });

  it('chuyến đã về: in Completed kèm icon cờ đích', () => {
    renderTable({ today: '2026-10-20' });

    expect(within(bodyRow()).getByText(t.phase.completed).querySelector('svg')).toHaveClass(
      'lucide-flag',
    );
  });

  it('hàng THIẾU `phase` (API cũ trong khe deploy): ô Status để trống, bảng không sập', () => {
    // Vercel thường deploy xong trước Render. Trong vài phút ấy admin mới đọc
    // API cũ, và bản đầu của F16 dựng `<undefined />` ở ô này — React ném, cả
    // trang Departures thành 500 (vòng review F16). Lùi về ô trống, KHÔNG về
    // huy hiệu mặc định: biến thể mặc định là xanh đặc, màu dành cho chuyến
    // còn nhận booking.
    const today = '2026-10-01';
    const vm = toDepartureRowVM(
      { ...serverRow(ROW, today), phase: undefined as unknown as DeparturePhase },
      today,
    );
    renderTable({ today, rows: [vm] });

    expect(within(bodyRow()).queryByText(t.phase['on-sale'])).not.toBeInTheDocument();
    expect(bodyRow().querySelector('[data-slot="badge"]')).toBeNull();
  });
});
