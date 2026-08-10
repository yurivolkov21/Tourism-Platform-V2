import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import { BookingForm } from './booking-form';
import { BookingModes } from './booking-modes';
import type { CheckoutSummaryTour } from './checkout-summary';

// `api.bookings.create` là biên duy nhất của component ra thế giới — mock đúng
// nó, không mock cả `@/lib/api/client`, để phần dựng payload vẫn chạy thật.
const create = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { create: (...args: unknown[]) => create(...args) } },
  withBrowserAuth: () => ({}),
}));

function makeDeparture(over: Partial<DepartureVM> = {}): DepartureVM {
  return {
    id: 'e9000001-0000-4000-8000-000000000001',
    startDate: '2026-09-12',
    endDate: '2026-09-23',
    seatsLeft: 9,
    effectivePrice: '1290.00',
    compareAtPrice: null,
    ...over,
  } as DepartureVM;
}

// Cùng khuôn `makeTour` của `checkout-summary.spec.tsx` — T3 gắn `CheckoutSummary`
// vào form nên form giờ CẦN prop này.
function makeSummaryTour(): CheckoutSummaryTour {
  return {
    title: 'Sapa Highlands Trek',
    cover: null,
    durationDays: 4,
    destinationNames: ['Sapa', 'Lao Cai'],
    ratingAvg: 4.8,
    ratingCount: 126,
  };
}

const BASE = {
  maxGroupSize: 12,
  currency: 'USD',
  defaultName: 'Elena Moreau',
  defaultEmail: 'elena.moreau@example.com',
  summaryTour: makeSummaryTour(),
};

beforeEach(() => {
  create.mockReset();
});

describe('BookingForm', () => {
  it('chọn sẵn đợt CÒN CHỖ đầu tiên, không phải phần tử [0]', () => {
    render(
      <BookingForm
        {...BASE}
        departures={[
          makeDeparture({ id: 'sold-out-first', seatsLeft: 0 }),
          makeDeparture({
            id: 'has-seats',
            seatsLeft: 5,
            startDate: '2026-10-10',
            endDate: '2026-10-21',
          }),
        ]}
      />,
    );
    // Chỉ soi trong DANH SÁCH ĐỢT: nút chọn provider cũng mang aria-pressed nên
    // truy vấn toàn trang sẽ đếm nhầm.
    const rows = screen.getAllByRole('listitem').map((li) => li.querySelector('button'));
    expect(rows[0]).toBeDisabled();
    expect(rows[0]).toHaveAttribute('aria-pressed', 'false');
    expect(rows[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('chạm trần thì nút + tắt và hiện đúng MỘT dòng giải thích', async () => {
    const user = userEvent.setup();
    // Ghế còn (3) nhỏ hơn nhóm tối đa (12) → trần là ghế.
    render(<BookingForm {...BASE} departures={[makeDeparture({ seatsLeft: 3 })]} />);

    const plusAdults = screen.getByRole('button', { name: /Adults \+/ });
    await user.click(plusAdults); // 2
    await user.click(plusAdults); // 3 → chạm trần

    expect(plusAdults).toBeDisabled();
    expect(screen.getByText(/every seat left on this departure/i)).toBeInTheDocument();
  });

  it('email sai shape → hiện lỗi và KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...BASE} departures={[makeDeparture()]} />);

    const email = screen.getByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'elena.moreau@');
    await user.click(screen.getByRole('button', { name: /Continue to payment/i }));

    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByText(/valid name and email/i)).toBeInTheDocument();
  });

  it('hợp lệ → gọi create ĐÚNG payload và bỏ hẳn field optional rỗng', async () => {
    const user = userEvent.setup();
    // `assign` không tồn tại trong jsdom — thay bằng spy để khỏi "Not implemented".
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { assign },
      writable: true,
    });
    create.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.test/cs_1' });

    render(<BookingForm {...BASE} departures={[makeDeparture()]} />);
    await user.click(screen.getByRole('button', { name: /Continue to payment/i }));

    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      departureId: 'e9000001-0000-4000-8000-000000000001',
      numAdults: 1,
      numChildren: 0,
      contactEmail: 'elena.moreau@example.com',
      paymentProvider: 'STRIPE',
    });
    // Chuỗi rỗng KHÔNG được gửi — contract khai `.optional()` kèm min(6)/min(1).
    expect('contactPhone' in payload).toBe(false);
    expect('specialRequests' in payload).toBe(false);
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/cs_1');
  });

  it('API lỗi → giữ NGUYÊN dữ liệu đã nhập, không xoá form', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error('boom'));

    render(<BookingForm {...BASE} departures={[makeDeparture()]} />);
    const name = screen.getByLabelText('Full name');
    await user.clear(name);
    await user.type(name, 'Trần Mai');
    await user.click(screen.getByRole('button', { name: /Continue to payment/i }));

    expect(await screen.findByText(/couldn’t start the payment session/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Trần Mai');
  });

  // T3 — lưới hai cột hướng B: cột trái mở đầu bằng card "Trip details"
  // (đúng nhãn bước hiện tại của step indicator RSC ở `book/page.tsx`), card
  // giữa "Lead traveler", card cuối "Payment method" — đúng copy brief vòng
  // review 1 (Finding 1), khác nhãn `steps.trip`/`steps.payment` của indicator.
  it('ba card đúng heading brief: "Trip details" / "Lead traveler" / "Payment method"', () => {
    render(<BookingForm {...BASE} departures={[makeDeparture()]} />);

    expect(screen.getByRole('heading', { name: 'Trip details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lead traveler' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payment method' })).toBeInTheDocument();
  });

  // Finding 2 (vòng review 1) — dòng "Test mode" cạnh nút submit bị rớt lúc
  // refactor T3. Đây là disclosure quan trọng cho capstone không doanh thu:
  // dùng LẠI đúng key `tourDetail.booking.testMode` đã có (khớp `booking-rail.tsx`),
  // không tạo key mới trùng nghĩa.
  it('hiện dòng "Test mode" ngay dưới nút submit — disclosure sandbox', () => {
    render(<BookingForm {...BASE} departures={[makeDeparture()]} />);

    expect(screen.getByText(messages.tourDetail.booking.testMode)).toBeInTheDocument();
  });

  it('tổng tiền hiển thị TRONG summary card ("Order summary" có mặt)', () => {
    render(<BookingForm {...BASE} departures={[makeDeparture()]} />);

    expect(screen.getByText('Order summary')).toBeInTheDocument();
  });

  it('đổi stepper adults → total trong summary đổi theo', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...BASE} departures={[makeDeparture({ effectivePrice: '1290.00' })]} />);

    // Neo vào ĐÚNG dòng "Total" của summary — không phải giá niêm yết trên
    // hàng đợt khởi hành (hàng đó cũng hiện "$1,290" nhưng KHÔNG đổi theo
    // stepper, vì đó là đơn giá per-adult, không phải tổng).
    const totalRow = screen.getByText('Total').closest('div');
    // 1 người lớn × $1,290 = $1,290 — số ban đầu.
    expect(totalRow).toHaveTextContent('$1,290');

    const plusAdults = screen.getByRole('button', { name: /Adults \+/ });
    await user.click(plusAdults); // 2 người lớn

    // 2 × $1,290 = $2,580.
    expect(totalRow).toHaveTextContent('$2,580');
  });

  // NHÓM 5 (final review) — nhãn nút CTA và dòng "Total" của summary phải
  // CÙNG dùng `computeBookingTotal`: canh cả hai cùng ra MỘT số, không lệch.
  it('nhãn CTA và dòng Total của summary cùng một số tiền (một nguồn — computeBookingTotal)', async () => {
    const user = userEvent.setup();
    render(<BookingForm {...BASE} departures={[makeDeparture({ effectivePrice: '1290.00' })]} />);

    const plusAdults = screen.getByRole('button', { name: /Adults \+/ });
    await user.click(plusAdults); // 2 người lớn → tổng 2 × $1,290 = $2,580.

    const totalRow = screen.getByText('Total').closest('div');
    expect(totalRow).toHaveTextContent('$2,580');
    expect(screen.getByRole('button', { name: /Continue to payment/i })).toHaveTextContent(
      '$2,580',
    );
  });
});

// Finding 4 (vòng review 1) — `BookingModes` nhận `steps` qua prop, chỉ render
// ở nhánh scheduled: mode Private là form hỏi báo giá, không có bước thanh
// toán nên step indicator không có chỗ đứng ở đó.
describe('BookingModes — step indicator chỉ thuộc về nhánh scheduled', () => {
  it('mode private KHÔNG hiện step indicator; mode scheduled (mặc định) CÓ', async () => {
    const user = userEvent.setup();
    render(
      <BookingModes
        tourId="tour-1"
        departures={[makeDeparture()]}
        maxGroupSize={12}
        currency="USD"
        defaultName="Elena Moreau"
        defaultEmail="elena.moreau@example.com"
        summaryTour={makeSummaryTour()}
        steps={<nav aria-label="Booking steps">Payment</nav>}
      />,
    );

    // Mặc định scheduled (còn đợt) — step indicator có mặt.
    expect(screen.getByLabelText('Booking steps')).toBeInTheDocument();

    // Chuyển sang Private — step indicator phải biến mất hoàn toàn, không
    // chỉ ẩn thị giác: `queryByLabelText`, KHÔNG `getByLabelText`.
    await user.click(screen.getByRole('button', { name: /Travel on my own dates/i }));
    expect(screen.queryByLabelText('Booking steps')).not.toBeInTheDocument();
  });
});
