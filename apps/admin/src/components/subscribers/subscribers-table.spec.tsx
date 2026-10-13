import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { formatCalendarDate, formatDateRange } from '@/lib/bookings-view';
import { EXPORT_MAX_ROWS } from '@/lib/export-pages';
import { parseSubscribersSearchParams, type SubscribersQuery } from '@/lib/subscribers-query';
import type { SubscriberRowVM } from '@/lib/subscribers-view';
import { SubscribersTable } from './subscribers-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/subscribers',
  useSearchParams: () => new URLSearchParams(),
}));

const t = messages.admin.subscribers.list;

describe('SubscribersTable — nút Export', () => {
  it('nằm TRONG ô tiêu đề cột Actions, nên không đè chữ của cột nào', () => {
    render(
      <SubscribersTable
        rows={[
          {
            id: '5b1a0000-0000-4000-8000-000000000001',
            email: 'reader@example.com',
            source: 'Footer',
            subscribed: '1 Oct 2026',
            confirmed: '1 Oct 2026',
            unsubscribed: 'Still subscribed',
            isActive: true,
          },
        ]}
        query={parseSubscribersSearchParams({})}
        sources={[]}
        total={1}
        totalPages={1}
        unsubscribe={vi.fn()}
      />,
    );

    const header = screen.getByRole('columnheader', { name: new RegExp(t.columns.actions) });
    expect(within(header).getByRole('link', { name: t.exportExcel })).toBeInTheDocument();
  });
});

function rowVM(n: number, email: string): SubscriberRowVM {
  return {
    id: `5b1a0000-0000-4000-8000-00000000000${n}`,
    email,
    source: 'Footer',
    subscribed: '1 Oct 2026',
    confirmed: '1 Oct 2026',
    unsubscribed: 'Still subscribed',
    isActive: true,
  };
}

const ROWS = [rowVM(1, 'ada@example.com'), rowVM(2, 'bo@example.com')];
const ACTIVE: SubscribersQuery = { page: 1, limit: 20, active: true };

function view(props: { rows?: SubscriberRowVM[]; query?: SubscribersQuery; total?: number } = {}) {
  const { rows = ROWS, query = ACTIVE, total = rows.length } = props;
  return render(
    <SubscribersTable
      rows={rows}
      query={query}
      sources={[]}
      total={total}
      totalPages={1}
      unsubscribe={vi.fn()}
    />,
  );
}

/** Nút export là một `<a>` thật (tải file), nên tìm theo role link. */
function exportLink(name: string) {
  return screen.getByRole('link', { name: new RegExp(name) });
}

/**
 * G43: cột ô tích theo khuôn `/bookings` (spec 01/09). Việc chọn KHOÁ trong trang đang xem,
 * nên bảng phải tự đặt lại tích khi query đổi, và href xuất mang `id` chứ không mang email.
 */
describe('SubscribersTable — chọn hàng để export (G43)', () => {
  it('chưa tích gì: nút xuất CẢ TẬP đang lọc, URL không mang page/limit', () => {
    view();

    expect(exportLink(t.exportExcel)).toHaveAttribute('href', '/subscribers/export');
  });

  it('tích một hàng: nhãn đếm đúng, URL mang `sel` là id cùng phạm vi trang — không có email', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('ada@example.com') }));

    const link = exportLink(t.exportSelected(1));
    expect(link).toHaveAttribute(
      'href',
      `/subscribers/export?page=1&limit=20&sel=${ROWS[0]?.id ?? ''}`,
    );
    expect(link.getAttribute('href')).not.toContain('example.com');
  });

  it('checkbox tiêu đề chọn CẢ TRANG, bấm lại thì bỏ hết; tích lẻ là trạng thái MỘT PHẦN', async () => {
    const user = userEvent.setup();
    view();
    const all = screen.getByRole('checkbox', { name: t.selectAllRows });

    await user.click(all);
    expect(exportLink(t.exportSelected(2))).toBeInTheDocument();
    await user.click(all);
    expect(exportLink(t.exportExcel)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('bo@example.com') }));
    expect(all).toHaveAttribute('aria-checked', 'mixed');
    // Ô MỘT PHẦN vẽ dấu gạch: dấu tích không nền (bản trước) đọc thành "đã chọn hết", đúng
    // cái nhầm mà trạng thái một phần sinh ra để tránh.
    expect(all.querySelector('.lucide-minus')).not.toBeNull();
    expect(all.querySelector('.lucide-check')).toBeNull();
  });

  it('query đổi (sang trang, lọc ngày) thì ĐẶT LẠI tích', async () => {
    const user = userEvent.setup();
    const { rerender } = view();
    await user.click(screen.getByRole('checkbox', { name: t.selectRow('ada@example.com') }));
    expect(exportLink(t.exportSelected(1))).toBeInTheDocument();

    rerender(
      <SubscribersTable
        rows={ROWS}
        query={{ ...ACTIVE, from: '2026-10-01' }}
        sources={[]}
        total={2}
        totalPages={1}
        unsubscribe={vi.fn()}
      />,
    );

    expect(exportLink(t.exportExcel)).toHaveAttribute(
      'href',
      '/subscribers/export?from=2026-10-01',
    );
    expect(screen.getByRole('checkbox', { name: t.selectRow('ada@example.com') })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('vượt trần export: nút TẮT khi xuất cả tập, nhưng có tích thì vẫn bấm được', async () => {
    const user = userEvent.setup();
    view({ total: EXPORT_MAX_ROWS + 1 });
    expect(screen.queryByRole('link', { name: new RegExp(t.exportExcel) })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('ada@example.com') }));

    expect(exportLink(t.exportSelected(1))).toBeInTheDocument();
  });
});

/**
 * G24: cột là hằng của module, mọi thứ ô cần từ bảng đi qua context. Lượt `router.refresh()` chở
 * xuống một `unsubscribe` MỚI (Flight giải mã server action thành closure mới mỗi lần), và ở tab
 * Active thì `total` cũng giảm vì hàng vừa huỷ rời danh sách. Cột còn đổi danh tính theo một
 * trong hai thứ ấy thì mọi ô bị dựng lại: focus rơi về `<body>`, hộp đang mở ở hàng khác biến mất.
 */
describe('SubscribersTable — ô Actions sống qua lượt làm mới (G24)', () => {
  const tu = messages.admin.subscribers.unsubscribe;

  function table(total: number) {
    return (
      <SubscribersTable
        rows={ROWS}
        query={ACTIVE}
        sources={[]}
        total={total}
        totalPages={1}
        unsubscribe={vi.fn()}
      />
    );
  }

  it('unsubscribe đổi danh tính: nút Unsubscribe đang giữ focus vẫn là nút ấy', () => {
    const { rerender } = render(table(2));
    const button = screen.getByRole('button', { name: tu.actionLabel('ada@example.com') });
    button.focus();
    expect(button).toHaveFocus();

    rerender(table(2));

    expect(screen.getByRole('button', { name: tu.actionLabel('ada@example.com') })).toBe(button);
    expect(button).toHaveFocus();
  });

  it('hộp đang mở ở một hàng không biến mất khi lượt làm mới đổi `total` và `unsubscribe`', async () => {
    const user = userEvent.setup();
    const { rerender } = render(table(3));

    await user.click(screen.getByRole('button', { name: tu.actionLabel('bo@example.com') }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Hàng thứ ba vừa huỷ ở tab khác: tab Active còn hai hàng.
    rerender(table(2));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('SubscribersTable — ô rỗng khi lọc ngày (G43)', () => {
  it('không lọc ngày: câu rỗng cũ, không có nút nào', () => {
    view({ rows: [], total: 0 });

    expect(screen.getByText(t.empty)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t.showAllDates })).not.toBeInTheDocument();
  });

  it('đang lọc ngày: nói thẳng khoảng ngày và mở lối về mọi ngày, GIỮ tab và từ khoá', () => {
    view({
      rows: [],
      total: 0,
      query: { ...ACTIVE, active: false, search: 'ada', from: '2026-09-01', to: '2026-09-30' },
    });

    expect(
      screen.getByText(t.emptyInRange(formatDateRange('2026-09-01', '2026-09-30'))),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.showAllDates })).toHaveAttribute(
      'href',
      '/subscribers?active=false&q=ada',
    );
  });

  it('khoảng một đầu dùng câu "on or after" / "on or before", không phải "between"', () => {
    const { unmount } = view({ rows: [], total: 0, query: { ...ACTIVE, from: '2026-09-01' } });
    expect(screen.getByText(t.emptyFrom(formatCalendarDate('2026-09-01')))).toBeInTheDocument();
    unmount();

    view({ rows: [], total: 0, query: { ...ACTIVE, to: '2026-09-30' } });
    expect(screen.getByText(t.emptyTo(formatCalendarDate('2026-09-30')))).toBeInTheDocument();
  });
});
