import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { BookingSuccessScreen, type BookingSuccessScreenProps } from './booking-success-screen';

function baseProps(overrides: Partial<BookingSuccessScreenProps> = {}): BookingSuccessScreenProps {
  return {
    heroImageUrl: null,
    heading: "You're going!",
    subtitle: 'Confirmation is on its way to lan.nguyen@example.com',
    bookingCodeLabel: 'Booking code',
    bookingCode: 'BK-4QP8ZT2M',
    tourTitle: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
    travellersLabel: '3 travellers',
    dateRangeLabel: 'Sat 3 – Tue 6 Oct 2026',
    totalAmount: '$1,377',
    viewBookingLabel: 'View booking',
    onViewBooking: jest.fn(),
    browseToursLabel: 'Browse more tours',
    onBrowseTours: jest.fn(),
    ...overrides,
  };
}

describe('BookingSuccessScreen', () => {
  it('B8 — vẽ mã booking, tiêu đề và tổng tiền', async () => {
    await renderWithTheme(<BookingSuccessScreen {...baseProps()} />);

    expect(screen.getByText("You're going!")).toBeTruthy();
    expect(screen.getByText('BK-4QP8ZT2M')).toBeTruthy();
    expect(screen.getByText('$1,377')).toBeTruthy();
  });

  it('bấm "View booking" gọi onViewBooking', async () => {
    const onViewBooking = jest.fn();
    await renderWithTheme(<BookingSuccessScreen {...baseProps({ onViewBooking })} />);

    await fireEvent.press(screen.getByText('View booking'));
    expect(onViewBooking).toHaveBeenCalled();
  });

  it('bấm "Browse more tours" gọi onBrowseTours', async () => {
    const onBrowseTours = jest.fn();
    await renderWithTheme(<BookingSuccessScreen {...baseProps({ onBrowseTours })} />);

    await fireEvent.press(screen.getByText('Browse more tours'));
    expect(onBrowseTours).toHaveBeenCalled();
  });
});
