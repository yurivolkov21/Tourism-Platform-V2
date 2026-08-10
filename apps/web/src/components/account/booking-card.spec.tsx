import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingCard } from './booking-card';

describe('BookingCard', () => {
  it('render tiêu đề tour + tổng tiền + link tới trang detail', () => {
    render(<BookingCard booking={makeBooking({ status: 'PENDING', paidAt: null })} />);
    expect(screen.getByText('Test Tour')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/account/bookings/BK-TESTAAAA');
  });

  it('nhãn trạng thái lấy từ MỘT nguồn `booking.list.status`, đủ cả năm', () => {
    // Nhãn là thứ mang nghĩa; màu chỉ phụ hoạ. Test canh CHỮ chứ không canh
    // class, vì chữ mới là thứ người dùng và trình đọc màn hình nhận được.
    for (const [status, label] of [
      ['PENDING', 'Awaiting payment'],
      ['PAID', 'Paid'],
      ['CANCELLED', 'Cancelled'],
      ['REFUNDED', 'Refunded'],
      ['PARTIALLY_REFUNDED', 'Partially refunded'],
    ] as const) {
      const { unmount } = render(<BookingCard booking={makeBooking({ status })} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('KHÔNG dùng pill `text-warning`/`text-success` nữa — chúng rớt WCAG', () => {
    // Redesign 11/08 bỏ `TONE_CLASS`. Lý do đo được, không phải đổi gu:
    // `bg-warning/10 text-warning` cho ra 1.90:1 trên nền ở chế độ SÁNG, tức
    // "Awaiting payment" gần như vô hình đúng lúc nó cần được nhìn thấy nhất.
    // Test này chặn việc ai đó "khôi phục màu cho dễ nhìn" mà không đo lại.
    const { container } = render(<BookingCard booking={makeBooking({ status: 'PENDING' })} />);
    expect(container.innerHTML).not.toContain('text-warning');
    expect(container.innerHTML).not.toContain('text-success');
    expect(container.innerHTML).not.toContain('text-destructive-emphasis');
  });

  it('trạng thái CÒN VIỆC nổi hơn trạng thái đã yên — không chỉ khác nhau ở màu', () => {
    // Kênh phân biệt là ĐỘ ĐẬM của chữ (`font-medium` + `foreground`), dùng
    // được cả khi người dùng không phân biệt được màu.
    const { unmount } = render(<BookingCard booking={makeBooking({ status: 'PENDING' })} />);
    expect(screen.getByText('Awaiting payment').className).toContain('text-foreground');
    unmount();
    render(<BookingCard booking={makeBooking({ status: 'PAID' })} />);
    expect(screen.getByText('Paid').className).toContain('text-muted-foreground');
  });

  it('KHÔNG còn nhãn "View details" — cả dòng đã là link, nói lại chỉ tốn chỗ', () => {
    render(<BookingCard booking={makeBooking()} />);
    expect(screen.queryByText(/view details/i)).not.toBeInTheDocument();
  });

  it('có trẻ em → travellers hiện cả người lớn và trẻ em', () => {
    render(
      <BookingCard
        booking={makeBooking({ status: 'PENDING', paidAt: null, numAdults: 2, numChildren: 1 })}
      />,
    );
    expect(screen.getByText(/2 adults, 1 child/)).toBeInTheDocument();
  });
});

describe('BookingCard — gợi ý ngày kết thúc (chỉ nhóm "đang đi")', () => {
  const TODAY = '2026-08-04';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('MẶC ĐỊNH không hiện — ở nhóm khác nó gây hiểu nhầm', () => {
    // Chuyến chưa khởi hành mà ghi "ends in 3 days" thì người đọc tưởng sắp
    // hết hạn thứ gì đó.
    render(<BookingCard booking={makeBooking({ departureEndDate: '2026-08-07' })} />);
    expect(screen.queryByText(/ends in/)).not.toBeInTheDocument();
  });

  it('bật cờ → "ends in N days"', () => {
    render(<BookingCard booking={makeBooking({ departureEndDate: '2026-08-07' })} showEndsHint />);
    expect(screen.getByText(/ends in 3 days/)).toBeInTheDocument();
  });

  it('kết thúc hôm nay và ngày mai có câu riêng', () => {
    const { unmount } = render(
      <BookingCard booking={makeBooking({ departureEndDate: TODAY })} showEndsHint />,
    );
    expect(screen.getByText(/ends today/)).toBeInTheDocument();
    unmount();
    render(<BookingCard booking={makeBooking({ departureEndDate: '2026-08-05' })} showEndsHint />);
    expect(screen.getByText(/ends tomorrow/)).toBeInTheDocument();
  });
});
