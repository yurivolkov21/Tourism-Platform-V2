import { render, screen, within } from '@testing-library/react';
import type { WishlistItem } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { AccountHub } from './account-hub';

const TODAY = '2026-08-11';
const EMAIL = 'traveller@tourism.test';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T09:00:00.000Z`));
});
afterEach(() => {
  vi.useRealTimers();
});

/** Hub chỉ ĐẾM wishlist chứ không đọc trường nào, nhưng vẫn dựng đúng shape
 *  thật thay vì ép kiểu — ép kiểu thì đổi contract sẽ không làm đỏ ở đây. */
const wish = (id: string): WishlistItem => ({
  tourId: id,
  slug: id,
  title: id,
  basePrice: '100',
  currency: 'USD',
  durationDays: 3,
  ratingAvg: null,
  ratingCount: 0,
  addedAt: '2026-08-01T00:00:00.000Z',
  unavailable: false,
});

function hub(bookings = [] as ReturnType<typeof makeBooking>[], wishlist: WishlistItem[] = []) {
  return render(<AccountHub bookings={bookings} wishlist={wishlist} email={EMAIL} />);
}

describe('AccountHub — ba khối đích', () => {
  it('luôn render đủ ba khối, kể cả tài khoản rỗng', () => {
    // Hub là bản đồ khu account, không phải bảng dữ liệu — nó phải nói được
    // "có những nơi này" ngay cả khi chưa có gì trong đó.
    hub();
    for (const title of ['My trips', 'Saved tours', 'Personal info']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('mỗi khối dẫn tới đúng route của nó', () => {
    hub();
    const href = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href(/My trips/)).toBe('/account/bookings');
    expect(href(/Saved tours/)).toBe('/account/saved');
    expect(href(/Personal info/)).toBe('/account/profile');
  });

  it('KHÔNG khối nào im lặng — cả ba đều có dòng số liệu', () => {
    // Luật "chỗ trống phải được KHAI BÁO là trống". Khối Personal info không
    // có gì để đếm nên nó cõng email; bỏ trống thì đọc như lỗi tải.
    hub([], []);
    expect(screen.getByText('0 trips')).toBeInTheDocument();
    expect(screen.getByText('0 tours')).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
  });

  it('số đếm là số THẬT, và số ít/số nhiều tách bạch', () => {
    hub([makeBooking({ status: 'PAID' })], [wish('a')]);
    expect(screen.getByText('1 trip')).toBeInTheDocument();
    expect(screen.getByText('1 tour')).toBeInTheDocument();
  });

  it('còn chuyến chưa trả tiền → khối Trips đổi sang đếm VIỆC CẦN LÀM', () => {
    // Tổng số booking là con số phù phiếm; "2 awaiting payment" nói được người
    // dùng cần làm gì. Cái sau thắng khi cả hai cùng có nghĩa.
    hub([
      makeBooking({ status: 'PENDING' }),
      makeBooking({ status: 'PENDING', code: 'BK-TESTBBBB' }),
    ]);
    expect(screen.getByText('2 awaiting payment')).toBeInTheDocument();
    expect(screen.queryByText('2 trips')).not.toBeInTheDocument();
  });
});

describe('AccountHub — khối chuyến kế tiếp', () => {
  const paidAhead = () =>
    makeBooking({
      status: 'PAID',
      departureStartDate: '2026-08-23',
      departureEndDate: '2026-08-27',
    });

  it('có chuyến ĐÃ TRẢ TIỀN phía trước → hiện khối, kèm số ngày đếm ngược', () => {
    hub([paidAhead()]);
    expect(screen.getByText('Your next trip')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('days away')).toBeInTheDocument();
  });

  it('chỉ có chuyến CHƯA trả tiền → KHÔNG hiện khối', () => {
    // `nextTrip` cố ý chỉ tính PAID: hứa một chuyến chưa chắc chắn rồi để nó
    // biến mất khi hết hạn thanh toán còn tệ hơn là chưa hứa gì.
    hub([makeBooking({ status: 'PENDING', departureStartDate: '2026-08-23' })]);
    expect(screen.queryByText('Your next trip')).not.toBeInTheDocument();
  });

  it('tài khoản rỗng → không có khối chuyến kế tiếp, ba khối đích vẫn còn', () => {
    hub();
    expect(screen.queryByText('Your next trip')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('khởi hành HÔM NAY và NGÀY MAI có câu riêng, không phải "0 days away"', () => {
    // "0 days away" đọc như một lỗi chứ không như tin vui.
    const { unmount } = hub([makeBooking({ status: 'PAID', departureStartDate: TODAY })]);
    expect(screen.getByText('Departing today')).toBeInTheDocument();
    unmount();
    hub([makeBooking({ status: 'PAID', departureStartDate: '2026-08-12' })]);
    expect(screen.getByText('Departing tomorrow')).toBeInTheDocument();
  });

  it('khối chuyến kế tiếp dẫn thẳng tới trang chi tiết của CHÍNH chuyến đó', () => {
    hub([paidAhead()]);
    const block = screen.getByRole('link', { name: /Your next trip/ });
    expect(block).toHaveAttribute('href', '/account/bookings/BK-TESTAAAA');
    expect(within(block).getByText('Test Tour')).toBeInTheDocument();
  });
});
