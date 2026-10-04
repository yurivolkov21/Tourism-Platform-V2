import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { TripsScreen, type TripsScreenProps } from './trips-screen';

const STATUS_LABEL = (status: TripsScreenProps['items'][number]['status']) =>
  messages.mobile.trips.status[status] ?? status;

function baseProps(overrides: Partial<TripsScreenProps> = {}): TripsScreenProps {
  return {
    status: 'content',
    title: 'Your trips',
    hasAnyTrips: true,
    window: 'all',
    onChangeWindow: jest.fn(),
    chipAllLabel: 'All',
    chipUpcomingLabel: 'Upcoming',
    chipPastLabel: 'Past',
    items: [
      {
        code: 'BK-4QP8ZT2M',
        status: 'PAID',
        pillTone: 'paid',
        imageUrl: null,
        title: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
        dateRangeLabel: 'Sat 3 – Tue 6 Oct 2026',
        departureStartDate: '2026-10-03',
        departureEndDate: '2026-10-06',
        travellersLabel: '3 travellers',
        amountLabel: '$1,377',
      },
      {
        code: 'BK-9TR2WK5C',
        status: 'PENDING',
        pillTone: 'pending',
        imageUrl: null,
        title: 'Hạ Long Bay Overnight Cruise 2D1N',
        dateRangeLabel: 'Sat 17 – Sun 18 Oct 2026',
        departureStartDate: '2026-10-17',
        departureEndDate: '2026-10-18',
        travellersLabel: '2 travellers',
        amountLabel: '$370',
      },
    ],
    statusLabel: STATUS_LABEL,
    onTripPress: jest.fn(),
    finishPaymentLabel: 'Finish payment',
    errorTitle: "Couldn't load your bookings.",
    retryLabel: 'Try again',
    onRetry: jest.fn(),
    emptyTitle: 'No trips yet — your bookings will show up here.',
    browseLabel: 'Browse tours',
    onBrowse: jest.fn(),
    ...overrides,
  };
}

describe('TripsScreen', () => {
  it('T1 — vẽ nhãn trạng thái, mã, tổng tiền của từng chuyến', async () => {
    await renderWithTheme(<TripsScreen {...baseProps()} />);

    expect(screen.getByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('Payment due')).toBeTruthy();
    expect(screen.getByText('$1,377')).toBeTruthy();
    expect(screen.getByText('BK-9TR2WK5C')).toBeTruthy();
  });

  it('chỉ chuyến PENDING mới có đường "Finish payment"', async () => {
    await renderWithTheme(<TripsScreen {...baseProps()} />);

    expect(screen.getAllByText('Finish payment')).toHaveLength(1);
  });

  it('bấm một thẻ gọi onTripPress đúng mã', async () => {
    const onTripPress = jest.fn();
    await renderWithTheme(<TripsScreen {...baseProps({ onTripPress })} />);

    await fireEvent.press(screen.getByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N'));
    expect(onTripPress).toHaveBeenCalledWith('BK-4QP8ZT2M');
  });

  it('bấm chip Upcoming gọi onChangeWindow("upcoming")', async () => {
    const onChangeWindow = jest.fn();
    await renderWithTheme(<TripsScreen {...baseProps({ onChangeWindow })} />);

    await fireEvent.press(screen.getByText('Upcoming'));
    expect(onChangeWindow).toHaveBeenCalledWith('upcoming');
  });

  it('trạng thái loading: không vẽ danh sách hay chip', async () => {
    await renderWithTheme(<TripsScreen {...baseProps({ status: 'loading' })} />);

    expect(screen.queryByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N')).toBeNull();
    expect(screen.queryByText('All')).toBeNull();
  });

  it('trạng thái error: vẽ câu lỗi + nút thử lại, bấm gọi onRetry', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(<TripsScreen {...baseProps({ status: 'error', onRetry })} />);

    expect(screen.getByText("Couldn't load your bookings.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('T2 — chưa từng có chuyến: KHÔNG vẽ chip, vẽ nút Browse tours', async () => {
    const onBrowse = jest.fn();
    await renderWithTheme(
      <TripsScreen {...baseProps({ hasAnyTrips: false, items: [], onBrowse })} />,
    );

    expect(screen.getByText('No trips yet — your bookings will show up here.')).toBeTruthy();
    expect(screen.queryByText('All')).toBeNull();
    await fireEvent.press(screen.getByText('Browse tours'));
    expect(onBrowse).toHaveBeenCalled();
  });
});
