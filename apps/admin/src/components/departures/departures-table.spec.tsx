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

/**
 * Router ỔN ĐỊNH qua các lần render, như Next thật (`useRouter` memo theo router). Mock trả
 * object mới mỗi render thì `refreshList` đổi danh tính ở MỌI render và che mất lỗi D1 (server
 * action đổi danh tính sau mỗi `router.refresh()`).
 */
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const { push } = router;

const t = messages.admin.departures;

const QUERY: DeparturesQuery = { slug: 'hoi-an-lantern-evening', page: 1, limit: 20 };

/** Chuyến 5 ngày 10/10 → 14/10, hạn chót 03/10. */
const ROW = makeDepartureRow();

/**
 * Một bộ lệnh ghi MỚI — mô phỏng lượt `router.refresh()`: Flight client giải mã server action
 * thành một closure mới mỗi lần, nên trang chở xuống bảng những hàm khác danh tính (review D1).
 */
function freshActions() {
  return { create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), cancel: vi.fn() };
}

function table({
  query = QUERY,
  today = '2026-10-01',
  rows = [vmAt(ROW, today)],
  actions = freshActions(),
}: {
  query?: DeparturesQuery;
  today?: string;
  rows?: DepartureRowVM[];
  actions?: ReturnType<typeof freshActions>;
} = {}) {
  return (
    <DeparturesTable
      rows={rows}
      query={query}
      total={rows.length}
      totalPages={1}
      tour={{ slug: QUERY.slug, basePriceLabel: '$129.00' }}
      today={today}
      {...actions}
    />
  );
}

function renderTable(options: Parameters<typeof table>[0] = {}) {
  return render(table(options));
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

describe('DeparturesTable — ô hành động sống qua lượt làm mới (review D1)', () => {
  const editLabel = t.edit.actionLabel(vmAt(ROW, '2026-10-01').dates);

  it('lệnh ghi đổi danh tính sau lượt làm mới: nút Edit đang giữ focus vẫn là nút ấy', () => {
    const { rerender } = renderTable();
    const edit = within(bodyRow()).getByRole('button', { name: editLabel });
    edit.focus();
    expect(edit).toHaveFocus();

    rerender(table());

    expect(within(bodyRow()).getByRole('button', { name: editLabel })).toBe(edit);
    expect(edit).toHaveFocus();
  });

  it('hộp Edit đang mở trong ô không biến mất khi lệnh ghi đổi danh tính', async () => {
    const user = userEvent.setup();
    const { rerender } = renderTable();

    await user.click(within(bodyRow()).getByRole('button', { name: editLabel }));
    expect(await screen.findByRole('dialog', { name: t.edit.dialog.title })).toBeInTheDocument();

    rerender(table());
    expect(screen.getByRole('dialog', { name: t.edit.dialog.title })).toBeInTheDocument();
  });
});
