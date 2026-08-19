import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import type { BookingFormState } from '@/lib/booking-form';
import { StepDates } from './step-dates';
import { StepPay } from './step-pay';
import { StepReview } from './step-review';
import { StepTravellers } from './step-travellers';

/**
 * Spec của bốn thân bước. Kế thừa ba `it()` từ `booking-form.spec.tsx` (xoá
 * 19/08) — chạm trần số người, disclosure test-mode, đợt hết chỗ — cộng những
 * bất biến chỉ sinh ra khi form tách thành bốn màn.
 */
const DEPARTURE: DepartureVM = {
  id: 'dep-open',
  startDate: '2026-09-12',
  endDate: '2026-09-23',
  seatsLeft: 9,
  effectivePrice: '1290.00',
  compareAtPrice: null,
};

const STATE: BookingFormState = {
  departureId: 'dep-open',
  numAdults: 1,
  numChildren: 0,
  contactName: 'Elena Moreau',
  contactEmail: 'elena.moreau@example.com',
  contactPhone: '',
  specialRequests: '',
  paymentProvider: 'STRIPE',
};

const SHARED = { state: STATE, errors: {}, set: vi.fn(), selected: DEPARTURE, currency: 'USD' };

describe('StepDates', () => {
  it('đợt hết chỗ vẫn HIỆN nhưng không bấm được', () => {
    render(
      <StepDates
        {...SHARED}
        departures={[DEPARTURE, { ...DEPARTURE, id: 'dep-full', seatsLeft: 0 }]}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(1);
  });

  it('bấm một đợt thì báo lên trên bằng set(departureId)', async () => {
    const user = userEvent.setup();
    const set = vi.fn();
    render(
      <StepDates
        {...SHARED}
        set={set}
        departures={[DEPARTURE, { ...DEPARTURE, id: 'dep-two', seatsLeft: 5 }]}
      />,
    );
    await user.click(screen.getAllByRole('button')[1] as HTMLElement);
    expect(set).toHaveBeenCalledWith('departureId', 'dep-two');
  });
});

describe('StepTravellers', () => {
  /** Trẻ em tính CÙNG giá người lớn (quyết định 19/08 — không làm cột giá
   *  riêng). Giao diện phải nói ra; im lặng thì khách chỉ phát hiện lúc nhìn
   *  tổng tiền, đúng lúc tệ nhất để ngạc nhiên. */
  it('nói rõ trẻ em tính cùng giá người lớn khi chưa chạm trần', () => {
    render(<StepTravellers {...SHARED} maxGroupSize={12} />);
    expect(screen.getByText(messages.booking.wizard.travellers.childRateNote)).toBeInTheDocument();
  });

  it('chạm trần vì hết ghế → nút + tắt và đổi sang đúng câu giải thích ghế', () => {
    render(
      <StepTravellers
        {...SHARED}
        state={{ ...STATE, numAdults: 4 }}
        selected={{ ...DEPARTURE, seatsLeft: 4 }}
        maxGroupSize={12}
      />,
    );
    expect(screen.getByText(messages.booking.form.capBySeats)).toBeInTheDocument();
    expect(screen.queryByText(messages.booking.wizard.travellers.childRateNote)).toBeNull();
    const plus = screen.getByRole('button', { name: `${messages.booking.form.adults} +` });
    expect(plus).toBeDisabled();
  });
});

describe('StepReview', () => {
  const REVIEW = {
    ...SHARED,
    durationDays: 4,
    onEdit: vi.fn(),
  };

  it('không có ô nhập nào — đây là màn đọc lại', () => {
    render(<StepReview {...REVIEW} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});

describe('StepPay', () => {
  it('hiện disclosure test-mode', () => {
    render(<StepPay {...SHARED} />);
    expect(screen.getByText(messages.booking.wizard.pay.testModeNote)).toBeInTheDocument();
  });

  it('đúng HAI lựa chọn, và Stripe đang được chọn', () => {
    render(<StepPay {...SHARED} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent(
      messages.booking.form.stripe,
    );
  });

  /**
   * CHỐT CHẶN cho quyết định của user (19/08): bước này CHỈ chọn nhà cung cấp,
   * số thẻ gõ trên trang của Stripe/PayPal. Mẫu ReUI gốc có sẵn khối
   * Name-on-card / Card-number / CVC và nó rất dễ bị chép lại ở một lần sửa
   * sau — test này làm việc đó gãy ngay thay vì lặng lẽ trôi qua review.
   */
  it('TUYỆT ĐỐI không có ô nhập nào ở bước thanh toán', () => {
    const { container } = render(<StepPay {...SHARED} />);
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0);
  });
});
