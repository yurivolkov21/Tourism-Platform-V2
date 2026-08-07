import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import { BookingForm } from './booking-form';

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

const BASE = {
  maxGroupSize: 12,
  currency: 'USD',
  defaultName: 'Elena Moreau',
  defaultEmail: 'elena.moreau@example.com',
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
});
