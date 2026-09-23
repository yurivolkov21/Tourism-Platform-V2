import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeparturesQuery } from '@/lib/departures-query';
import { toDepartureRowVM } from '@/lib/departures-view';
import { type DepartureRowFixture, withPhase } from '@/test/departure-row';
import { DeparturesTable } from './departures-table';

/**
 * Bảng `/tours/[slug]/departures` (spec F16) — soi phần RIÊNG của F16, không
 * soi lại kit: tab lọc theo NHÓM giai đoạn (task 3) và cột Status in GIAI ĐOẠN
 * thay vì công tắc (task 4).
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const t = messages.admin.departures;

const QUERY: DeparturesQuery = { slug: 'hoi-an-lantern-evening', page: 1, limit: 20 };

/** Chuyến 5 ngày 10/10 → 14/10, hạn chót 03/10. */
const ROW: DepartureRowFixture = {
  id: '4f1b1f2e-0000-4000-8000-000000000001',
  startDate: '2026-10-10',
  endDate: '2026-10-14',
  price: '129.00',
  priceOverride: null,
  currency: 'USD',
  seatsBooked: 4,
  seatsTotal: 20,
  status: 'OPEN',
  cancellationDeadline: '2026-10-03',
  liveBookingCount: 2,
  pendingBookingCount: 0,
  version: '2026-09-20T08:00:00.000Z',
};

function renderTable({
  query = QUERY,
  today = '2026-10-01',
  row = ROW,
}: {
  query?: DeparturesQuery;
  today?: string;
  row?: DepartureRowFixture;
} = {}) {
  const rows = [toDepartureRowVM(withPhase(row, today), today)];
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
      t.list.phaseFilter.upcoming,
      t.list.phaseFilter.departed,
      t.list.phaseFilter.completed,
      t.list.phaseFilter.cancelled,
    ]);
  });

  it('tab đang lọc là tab được nhấn', () => {
    renderTable({ query: { ...QUERY, phase: 'upcoming' } });

    expect(
      screen.getByRole('button', { name: t.list.phaseFilter.upcoming, pressed: true }),
    ).toBeInTheDocument();
  });

  it('bấm một tab đẩy URL mang NHÓM giai đoạn và về trang 1', async () => {
    const user = userEvent.setup();
    renderTable({ query: { ...QUERY, page: 3 } });

    await user.click(screen.getByRole('button', { name: t.list.phaseFilter.completed }));

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
  /** Hàng dữ liệu duy nhất của bảng (hàng 0 là tiêu đề). */
  function bodyRow() {
    const [, row] = screen.getAllByRole('row');
    if (!row) throw new Error('bảng không có hàng dữ liệu');
    return row;
  }

  it('chuyến đang chạy mà công tắc vẫn OPEN: in Departed kèm icon máy bay', () => {
    renderTable({ today: '2026-10-12' });

    const badge = within(bodyRow()).getByText(t.phase.departed);
    expect(badge.querySelector('svg')).toHaveClass('lucide-plane');
    expect(within(bodyRow()).queryByText(t.phase['on-sale'])).not.toBeInTheDocument();
  });

  it('chuyến đã về: in Completed kèm icon cờ đích', () => {
    renderTable({ today: '2026-10-20' });

    expect(within(bodyRow()).getByText(t.phase.completed).querySelector('svg')).toHaveClass(
      'lucide-flag',
    );
  });
});
