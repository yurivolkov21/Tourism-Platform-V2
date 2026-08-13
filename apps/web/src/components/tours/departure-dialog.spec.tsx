import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  DepartureSelectionProvider,
  useDepartureSelection,
} from '@/components/tours/departure-selection';
import type { DepartureVM } from '@/lib/api/tours';
import { DepartureDialog } from './departure-dialog';

const DEPARTURES: DepartureVM[] = [
  {
    id: 'd1',
    startDate: '2026-09-14',
    endDate: '2026-09-17',
    seatsLeft: 6,
    effectivePrice: '329.00',
    compareAtPrice: '369.00',
  },
  {
    id: 'd2',
    startDate: '2026-09-28',
    endDate: '2026-10-01',
    seatsLeft: 0,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 'd3',
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    seatsLeft: 3,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
] as unknown as DepartureVM[];

/** Nút mở modal — modal KHÔNG nhận prop `open`, nó đọc context. */
function OpenButton() {
  const { openAllDates } = useDepartureSelection();
  return (
    <button type="button" onClick={openAllDates}>
      MỞ
    </button>
  );
}

function Harness({ children }: { children?: ReactNode }) {
  return (
    <DepartureSelectionProvider departures={DEPARTURES}>
      <OpenButton />
      <DepartureDialog
        tourTitle="Hà Giang Loop"
        currency="USD"
        durationDays={4}
        maxGroupSize={10}
      />
      {children}
    </DepartureSelectionProvider>
  );
}

async function open() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'MỞ' }));
  return user;
}

describe('DepartureDialog', () => {
  it('nhóm theo tháng, mỗi đợt một hàng đủ ngày · ghế · giá', async () => {
    await open();
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    // Khoảng ngày xuất hiện HAI lần — ở hàng và ở chân modal (chân nhắc lại đợt
    // đang chọn, đúng như wireframe) — nên phải khoanh vùng thay vì getByText.
    const row = screen.getByRole('button', { name: /Mon, 14 Sep →/ });
    expect(row).toHaveTextContent('Mon, 14 Sep → Thu, 17 Sep');
    expect(row).toHaveTextContent('6 of 10 seats left · 4 days');
  });

  it('đợt hết chỗ: mờ, KHÔNG bấm được, ghi "Sold out"', async () => {
    await open();
    expect(screen.getByText('Sold out · 4 days')).toBeInTheDocument();
    const rows = screen.getAllByRole('button', { name: /Sep →/ });
    const soldOut = rows.find((r) => r.textContent?.includes('Sold out'));
    expect(soldOut).toBeDisabled();
  });

  it('ô lọc "only open" giấu đợt hết chỗ', async () => {
    const user = await open();
    expect(screen.getByText('Sold out · 4 days')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /only show dates with seats left/i }));
    expect(screen.queryByText('Sold out · 4 days')).toBeNull();
  });

  it('lọc tới mức không còn đợt nào thì nói rõ là do bộ lọc', async () => {
    const user = userEvent.setup();
    render(
      <DepartureSelectionProvider departures={[DEPARTURES[1] as DepartureVM]}>
        <OpenButton />
        <DepartureDialog
          tourTitle="Hà Giang Loop"
          currency="USD"
          durationDays={4}
          maxGroupSize={10}
        />
      </DepartureSelectionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'MỞ' }));
    await user.click(screen.getByRole('checkbox', { name: /only show dates/i }));
    expect(screen.getByText('No departures match this filter.')).toBeInTheDocument();
  });

  it('chọn một đợt thì ĐÓNG modal ngay và đồng bộ ra ngoài', async () => {
    // Bấm xong mà modal còn mở là người dùng phải tự đi tìm nút đóng — và họ
    // không biết cú bấm vừa rồi đã ăn hay chưa.
    function Probe() {
      const { selectedId } = useDepartureSelection();
      return <p>ĐANG CHỌN: {selectedId}</p>;
    }
    const user = userEvent.setup();
    render(<Harness>{<Probe />}</Harness>);
    await user.click(screen.getByRole('button', { name: 'MỞ' }));
    await user.click(screen.getByRole('button', { name: /Mon, 12 Oct →/ }));

    expect(screen.getByText('ĐANG CHỌN: d3')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dòng phụ nói TÊN TOUR, không phải nhãn breadcrumb', async () => {
    await open();
    expect(screen.getByText('Hà Giang Loop · 4 days · max 10 guests')).toBeInTheDocument();
  });

  it('chân modal nhắc lại đợt đang chọn kèm giá', async () => {
    await open();
    const foot = screen.getByTestId('dlg-foot');
    expect(foot).toHaveTextContent('Mon, 14 Sep → Thu, 17 Sep');
    expect(foot).toHaveTextContent('$329');
  });

  it('giá gạch của ĐỢT hiện cạnh giá, không phải giá gốc của tour', async () => {
    await open();
    const row = screen.getByRole('button', { name: /Mon, 14 Sep →/ });
    expect(row).toHaveTextContent('$329');
    expect(row).toHaveTextContent('$369');
  });
});
