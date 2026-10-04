import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { BookingReviewScreen, type BookingReviewScreenProps } from './booking-review-screen';

function baseProps(overrides: Partial<BookingReviewScreenProps> = {}): BookingReviewScreenProps {
  return {
    step: 3,
    totalSteps: 3,
    stepLabel: 'Step 3 of 3',
    tripHeading: 'Your trip',
    trip: {
      imageUrl: null,
      title: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
      dateRangeLabel: 'Sat 3 – Tue 6 Oct 2026',
    },
    editTripLabel: 'Edit',
    onEditTrip: jest.fn(),
    travellersTotalLine: '3 travellers × $459',
    priceTotal: '$1,377',
    totalRowLabel: 'Total',
    cancellationNote: 'Free cancellation until Sat 26 Sep',
    paymentMethodHeading: 'Payment method',
    stripeLabel: 'Card — Stripe',
    payPalLabel: 'PayPal',
    paymentProvider: 'STRIPE',
    onSelectProvider: jest.fn(),
    browserNote: "You'll finish payment in your browser, then come back here.",
    totalLabel: 'Total',
    payLabel: 'Pay $1,377',
    onPay: jest.fn(),
    pending: false,
    errorMessage: null,
    ...overrides,
  };
}

describe('BookingReviewScreen', () => {
  it('B4 — vẽ tổng tiền, hạn huỷ miễn phí và cổng đang chọn', async () => {
    await renderWithTheme(<BookingReviewScreen {...baseProps()} />);

    expect(screen.getAllByText('$1,377').length).toBeGreaterThan(0);
    expect(screen.getByText('Free cancellation until Sat 26 Sep')).toBeTruthy();
    expect(screen.getByLabelText('Card — Stripe').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('PayPal').props.accessibilityState.checked).toBe(false);
  });

  it('bấm PayPal gọi onSelectProvider("PAYPAL")', async () => {
    const onSelectProvider = jest.fn();
    await renderWithTheme(<BookingReviewScreen {...baseProps({ onSelectProvider })} />);

    await fireEvent.press(screen.getByLabelText('PayPal'));
    expect(onSelectProvider).toHaveBeenCalledWith('PAYPAL');
  });

  it('bấm Pay gọi onPay', async () => {
    const onPay = jest.fn();
    await renderWithTheme(<BookingReviewScreen {...baseProps({ onPay })} />);

    await fireEvent.press(screen.getByText('Pay $1,377'));
    expect(onPay).toHaveBeenCalled();
  });

  it('B9 — có errorMessage thì in khung lỗi', async () => {
    await renderWithTheme(
      <BookingReviewScreen
        {...baseProps({ errorMessage: 'Sorry — those seats just sold out.' })}
      />,
    );

    expect(screen.getByText('Sorry — those seats just sold out.')).toBeTruthy();
  });

  it('B9 — errorAction in kèm đường link, bấm gọi đúng onPress', async () => {
    const onAction = jest.fn();
    await renderWithTheme(
      <BookingReviewScreen
        {...baseProps({
          errorMessage: 'Sorry — those seats just sold out.',
          errorAction: { label: 'Choose another date', onPress: onAction },
        })}
      />,
    );

    await fireEvent.press(screen.getByText('Choose another date'));
    expect(onAction).toHaveBeenCalled();
  });

  it('không có errorMessage thì không vẽ khung lỗi/đường link', async () => {
    await renderWithTheme(<BookingReviewScreen {...baseProps()} />);

    expect(screen.queryByText('Choose another date')).toBeNull();
  });
});
