import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MockTourDeparture } from '@/mocks/types';
import { DepartureStrip } from './departure-strip';

// Ba đợt phủ đúng ba nhánh của `departureStatus`: 2 ghế → limited (ngưỡng cảnh
// báo là ≤3), 0 ghế → sold-out, 12 ghế → available. Đợt hết chỗ nằm ở GIỮA có
// chủ ý: nó là chướng ngại để test điều hướng bàn phím phải nhảy qua.
const DEPARTURES: MockTourDeparture[] = [
  {
    id: 'a',
    startDate: '2026-08-21',
    endDate: '2026-08-22',
    seatsLeft: 2,
    effectivePrice: '175.00',
    compareAtPrice: '236.00',
  },
  {
    id: 'b',
    startDate: '2026-09-18',
    endDate: '2026-09-19',
    seatsLeft: 0,
    effectivePrice: '189.00',
    compareAtPrice: null,
  },
  {
    id: 'c',
    startDate: '2026-10-02',
    endDate: '2026-10-03',
    seatsLeft: 12,
    effectivePrice: '199.00',
    compareAtPrice: null,
  },
];

function renderStrip(props: Partial<React.ComponentProps<typeof DepartureStrip>> = {}): {
  onSelect: ReturnType<typeof vi.fn>;
} {
  const onSelect = vi.fn();
  render(
    <DepartureStrip
      departures={DEPARTURES}
      currency="USD"
      selectedId="a"
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect };
}

describe('DepartureStrip', () => {
  it('đợt đang chọn được đánh dấu aria-pressed', () => {
    renderStrip();
    expect(screen.getByRole('button', { name: /21–22 Aug 2026/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('đợt KHÔNG được chọn có aria-pressed=false, không phải thiếu thuộc tính', () => {
    renderStrip();
    expect(screen.getByRole('button', { name: /2–3 Oct 2026/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('đợt hết chỗ bị vô hiệu hoá và không gọi onSelect', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderStrip();
    const soldOut = screen.getByRole('button', { name: /18–19 Sep 2026/ });
    expect(soldOut).toBeDisabled();
    await user.click(soldOut);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('đợt còn ít ghế hiện cảnh báo kèm CON SỐ chính xác', () => {
    renderStrip();
    expect(screen.getByText('Only 2 seats left')).toBeInTheDocument();
  });

  it('đợt còn nhiều chỗ nói số ghế, không dùng chữ mơ hồ', () => {
    renderStrip();
    expect(screen.getByText('12 seats available')).toBeInTheDocument();
  });

  it('đợt hết chỗ nói thẳng Sold out', () => {
    renderStrip();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });

  it('chọn đợt khác thì gọi onSelect với đúng id', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderStrip();
    await user.click(screen.getByRole('button', { name: /2–3 Oct 2026/ }));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('giá gạch có nhãn đọc được, không chỉ dựa vào line-through', () => {
    renderStrip();
    // line-through là tín hiệu THỊ GIÁC; trình đọc màn hình không phát âm nó nên
    // nghe trần hai con số cạnh nhau là hiểu sai giá nào đang có hiệu lực.
    expect(screen.getByText('was $236')).toBeInTheDocument();
  });

  it('không có đợt nào thì hiện dòng trạng thái thay vì dải rỗng', () => {
    renderStrip({ departures: [], selectedId: undefined });
    expect(screen.getByText(/no departures scheduled/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('DepartureStrip — điều hướng bàn phím', () => {
  // Dải là một toolbar cuộn ngang: mũi tên phải di chuyển giữa các chip CÒN CHỖ
  // và bỏ qua đợt hết chỗ (chip disabled không nhận focus, nên nếu tự quản lý
  // focus mà không lọc thì mũi tên sẽ "mắc" ở đó).
  it('mũi tên phải nhảy sang chip còn chỗ KẾ TIẾP, bỏ qua đợt hết chỗ', async () => {
    const user = userEvent.setup();
    renderStrip();
    const first = screen.getByRole('button', { name: /21–22 Aug 2026/ });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /2–3 Oct 2026/ })).toHaveFocus();
  });

  it('mũi tên trái quay lại chip còn chỗ trước đó', async () => {
    const user = userEvent.setup();
    renderStrip();
    screen.getByRole('button', { name: /2–3 Oct 2026/ }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: /21–22 Aug 2026/ })).toHaveFocus();
  });

  it('End nhảy tới chip còn chỗ cuối, Home về chip còn chỗ đầu', async () => {
    const user = userEvent.setup();
    renderStrip();
    const first = screen.getByRole('button', { name: /21–22 Aug 2026/ });
    first.focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: /2–3 Oct 2026/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
  });

  it('mũi tên ở chip cuối KHÔNG cuộn vòng — dải là dãy có đầu có cuối', async () => {
    const user = userEvent.setup();
    renderStrip();
    const last = screen.getByRole('button', { name: /2–3 Oct 2026/ });
    last.focus();
    await user.keyboard('{ArrowRight}');
    expect(last).toHaveFocus();
  });
});
