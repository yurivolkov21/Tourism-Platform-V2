import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import { BookingWizard } from './booking-wizard';
import type { CheckoutSummaryTour } from './checkout-summary';

/**
 * Spec của wizard 4 bước — kế thừa `booking-form.spec.tsx` (xoá 19/08 cùng
 * `BookingForm`).
 *
 * Chín trong mười một `it()` của file cũ chuyển sang đây hoặc sang spec của
 * từng bước; hai cái còn lại chết theo thiết kế: "ba card đúng heading brief"
 * (giờ là bốn màn, không phải ba card chồng nhau) và "mode private KHÔNG hiện
 * step indicator" (công tắc mode đã gỡ, nhánh private sang `/enquire`).
 * Đối chiếu từng cái TRƯỚC khi xoá là chủ đích: xoá một file test là cách dễ
 * nhất để tổng số test vẫn tăng mà độ phủ lại tụt.
 */
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
  durationDays: 4,
  defaultName: 'Elena Moreau',
  defaultEmail: 'elena.moreau@example.com',
  summaryTour: makeSummaryTour(),
  included: ['English-speaking guide', 'Bottled water'],
  excluded: ['Travel insurance'],
};

const tw = messages.booking.wizard;

function renderWizard(departures: DepartureVM[] = [makeDeparture()]) {
  return render(<BookingWizard {...BASE} departures={departures} />);
}

/** Bấm Continue của thanh chân. */
async function clickContinue(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: tw.continue }));
}

beforeEach(() => {
  create.mockReset();
});

describe('BookingWizard — điều hướng bước', () => {
  it('mở ra ở bước Dates, và CHỈ thân bước đó có mặt', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: tw.dates.heading })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: tw.review.heading })).toBeNull();
    expect(screen.queryByRole('heading', { name: tw.pay.heading })).toBeNull();
  });

  it('chọn sẵn đợt CÒN CHỖ đầu tiên, không phải phần tử [0]', () => {
    renderWizard([
      makeDeparture({ id: 'sold-out', seatsLeft: 0 }),
      makeDeparture({ id: 'open-one', seatsLeft: 4 }),
    ]);
    const open = screen.getAllByRole('button', { pressed: true });
    expect(open).toHaveLength(1);
  });

  it('chưa chọn đợt thì Continue KHÔNG sang bước 2, và hiện lỗi tại chỗ', async () => {
    const user = userEvent.setup();
    renderWizard([makeDeparture({ seatsLeft: 0 })]);
    await clickContinue(user);
    expect(screen.getByRole('heading', { name: tw.dates.heading })).toBeInTheDocument();
    expect(screen.getByText(messages.booking.errors.MISSING_DEPARTURE)).toBeInTheDocument();
  });

  /** Đây là bất biến đắt nhất của wizard: state sống ở vỏ, bốn thân bước không
   *  tự giữ gì. Hỏng chỗ này thì khách đi tới bước 3 rồi quay lại là mất trắng
   *  những gì đã gõ — và lỗi chỉ lộ khi có người bấm Back. */
  it('Back giữ NGUYÊN dữ liệu đã nhập ở bước trước', async () => {
    const user = userEvent.setup();
    renderWizard();
    await clickContinue(user);

    const phone = screen.getByLabelText(messages.booking.form.contactPhone);
    await user.type(phone, '0901234567');
    expect(phone).toHaveValue('0901234567');

    await clickContinue(user);
    expect(screen.getByRole('heading', { name: tw.review.heading })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: tw.back }));
    expect(screen.getByLabelText(messages.booking.form.contactPhone)).toHaveValue('0901234567');
  });

  it('email sai shape → chặn ở bước Travellers và KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    renderWizard();
    await clickContinue(user);

    const email = screen.getByLabelText(messages.booking.form.contactEmail);
    await user.clear(email);
    await user.type(email, 'khong-phai-email');
    await clickContinue(user);

    expect(screen.getByRole('heading', { name: tw.travellers.heading })).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('link Edit ở bước Review đưa về ĐÚNG bước cần sửa', async () => {
    const user = userEvent.setup();
    renderWizard();
    await clickContinue(user);
    await clickContinue(user);

    const editLinks = screen.getAllByRole('button', { name: tw.review.edit });
    await user.click(editLinks[0] as HTMLElement);
    expect(screen.getByRole('heading', { name: tw.dates.heading })).toBeInTheDocument();
  });
});

describe('BookingWizard — tiền và submit', () => {
  /** Khoanh vào CHÍNH cột tóm tắt (`<aside>` → role `complementary`): giá cũng
   *  in trên thẻ đợt ở bước 1, nên tìm khắp trang thì `$1,290` khớp hai nơi và
   *  test không còn nói được là dòng Total có đúng hay không. */
  it('cột tóm tắt có mặt ở MỌI bước, và tổng đổi theo số người', async () => {
    const user = userEvent.setup();
    renderWizard();
    const rail = () => within(screen.getByRole('complementary'));
    expect(rail().getByText(messages.checkoutSummary.heading)).toBeInTheDocument();
    expect(rail().getByText(messages.checkoutSummary.totalLabel)).toBeInTheDocument();

    // Thêm TRẺ EM chứ không phải người lớn: 1 lớn + 1 trẻ = $2,580 trong khi
    // dòng đơn giá vẫn $1,290, nên $2,580 chỉ khớp đúng dòng Total. Cộng người
    // lớn thì dòng "Adults × 2" cũng thành $2,580 và test lại đo trúng hai chỗ.
    await clickContinue(user);
    await user.click(screen.getByRole('button', { name: `${messages.booking.form.children} +` }));
    expect(rail().getByText('$2,580')).toBeInTheDocument();
    expect(rail().getByText(messages.checkoutSummary.heading)).toBeInTheDocument();
  });

  /** Nhãn nút Pay và dòng Total phải là MỘT nguồn (`computeBookingTotal`) —
   *  hai phép tính song song là hai cơ hội nói hai con số khác nhau. */
  it('nhãn nút Pay mang đúng số tiền của dòng Total', async () => {
    const user = userEvent.setup();
    renderWizard();
    await clickContinue(user);
    await clickContinue(user);
    await clickContinue(user);
    expect(screen.getByRole('button', { name: tw.payCta('$1,290') })).toBeInTheDocument();
  });

  it('đi hết 4 bước → gọi create ĐÚNG payload, bỏ hẳn field optional rỗng', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.test/s/1' });
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { assign }, writable: true });

    renderWizard();
    await clickContinue(user);
    await clickContinue(user);
    await clickContinue(user);
    await user.click(screen.getByRole('button', { name: tw.payCta('$1,290') }));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toEqual({
      departureId: 'e9000001-0000-4000-8000-000000000001',
      numAdults: 1,
      numChildren: 0,
      contactName: 'Elena Moreau',
      contactEmail: 'elena.moreau@example.com',
      paymentProvider: 'STRIPE',
    });
  });

  it('API lỗi → giữ NGUYÊN dữ liệu, hiện lỗi, không rời bước Pay', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error('bang'));

    renderWizard();
    await clickContinue(user);
    const phone = screen.getByLabelText(messages.booking.form.contactPhone);
    await user.type(phone, '0901234567');
    await clickContinue(user);
    await clickContinue(user);
    await user.click(screen.getByRole('button', { name: tw.payCta('$1,290') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.booking.errors.CHECKOUT_FAILED,
    );
    await user.click(screen.getByRole('button', { name: tw.back }));
    await user.click(screen.getByRole('button', { name: tw.back }));
    expect(screen.getByLabelText(messages.booking.form.contactPhone)).toHaveValue('0901234567');
  });
});
