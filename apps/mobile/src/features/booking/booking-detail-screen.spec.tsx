import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { BookingDetailScreen, type BookingDetailScreenProps } from './booking-detail-screen';

function baseProps(overrides: Partial<BookingDetailScreenProps> = {}): BookingDetailScreenProps {
  return {
    trip: { imageUrl: null, title: 'Central Heritage 4D3N', dateRangeLabel: 'Sat 3 – Tue 6 Oct' },
    pillLabel: 'Paid',
    pillTone: 'paid',
    note: { tone: 'success', icon: 'shield', title: 'Free cancellation until Sat 26 Sep' },
    rows: [
      { label: 'Booking code', value: 'BK-4QP8ZT2M' },
      { label: 'Travellers', value: '2 adults · 1 child' },
      { label: 'Total paid', value: '$1,377', emphasis: true },
    ],
    primaryAction: null,
    secondaryAction: { label: 'Cancel booking', onPress: jest.fn() },
    ...overrides,
  };
}

describe('BookingDetailScreen', () => {
  it('T4 — vẽ pill, thẻ chuyến, note và các hàng kv', async () => {
    await renderWithTheme(<BookingDetailScreen {...baseProps()} />);

    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('Central Heritage 4D3N')).toBeTruthy();
    expect(screen.getByText('Free cancellation until Sat 26 Sep')).toBeTruthy();
    expect(screen.getByText('BK-4QP8ZT2M')).toBeTruthy();
    expect(screen.getByText('$1,377')).toBeTruthy();
  });

  it('bấm nút phụ (Cancel booking) gọi onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <BookingDetailScreen
        {...baseProps({ secondaryAction: { label: 'Cancel booking', onPress } })}
      />,
    );

    fireEvent.press(screen.getByText('Cancel booking'));
    expect(onPress).toHaveBeenCalled();
  });

  it('T5 — nút chính "Pay" và nút phụ "Cancel this booking" cùng hiện', async () => {
    const onPay = jest.fn();
    await renderWithTheme(
      <BookingDetailScreen
        {...baseProps({
          pillLabel: 'Payment due',
          pillTone: 'pending',
          note: {
            tone: 'warning',
            icon: 'alert-circle',
            title: 'Payment not finished',
            body: 'Your seats are held until you pay. Finish now to confirm them.',
          },
          rows: [
            { label: 'Booking code', value: 'BK-9TR2WK5C' },
            { label: 'Total due', value: '$370', emphasis: true },
          ],
          primaryAction: { label: 'Pay $370', onPress: onPay },
          secondaryAction: { label: 'Cancel this booking', onPress: jest.fn() },
        })}
      />,
    );

    fireEvent.press(screen.getByText('Pay $370'));
    expect(onPay).toHaveBeenCalled();
    expect(screen.getByText('Cancel this booking')).toBeTruthy();
  });

  it('T8 (terminal) — không nút nào vẫn vẽ được, "Browse tours" đứng một mình', async () => {
    await renderWithTheme(
      <BookingDetailScreen
        {...baseProps({
          pillLabel: 'Refunded',
          pillTone: 'muted',
          note: {
            tone: 'success',
            icon: 'refresh-cw',
            title: '$238 refunded on 12 Aug 2026',
            body: 'Back on your card within 5–10 business days, depending on your bank.',
          },
          rows: [
            { label: 'Booking code', value: 'BK-1HD7VN3P' },
            { label: 'Cancelled on', value: '12 Aug 2026' },
          ],
          primaryAction: { label: 'Browse tours', onPress: jest.fn() },
          secondaryAction: null,
        })}
      />,
    );

    expect(screen.getByText('Browse tours')).toBeTruthy();
    expect(screen.queryByText('Cancel booking')).toBeNull();
  });
});
