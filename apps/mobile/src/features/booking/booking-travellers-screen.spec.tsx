import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import {
  BookingTravellersScreen,
  type BookingTravellersScreenProps,
} from './booking-travellers-screen';

function baseProps(
  overrides: Partial<BookingTravellersScreenProps> = {},
): BookingTravellersScreenProps {
  return {
    step: 1,
    totalSteps: 3,
    stepLabel: 'Step 1 of 3',
    tripHeading: 'Your trip',
    trip: {
      imageUrl: null,
      title: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
      dateRangeLabel: 'Sat 3 – Tue 6 Oct 2026',
    },
    editTripLabel: 'Edit',
    onEditTrip: jest.fn(),
    travellersHeading: 'Travellers',
    adultsLabel: 'Adults',
    adultPriceLabel: '$459 each',
    numAdults: 2,
    onDecreaseAdults: jest.fn(),
    onIncreaseAdults: jest.fn(),
    adultsAtMin: false,
    adultsAtCap: false,
    decreaseAdultsLabel: 'Decrease adults',
    increaseAdultsLabel: 'Increase adults',
    childrenLabel: 'Children',
    childrenPriceNote: 'Same price as adults',
    numChildren: 1,
    onDecreaseChildren: jest.fn(),
    onIncreaseChildren: jest.fn(),
    childrenAtCap: false,
    decreaseChildrenLabel: 'Decrease children',
    increaseChildrenLabel: 'Increase children',
    capHintNote: '12 seats left on this date',
    capReachedNote: null,
    totalLabel: '3 travellers × $459',
    totalAmount: '$1,377',
    continueLabel: 'Continue',
    onContinue: jest.fn(),
    ...overrides,
  };
}

describe('BookingTravellersScreen', () => {
  it('B1 — vẽ thẻ chuyến, số khách hiện tại và tổng tiền', async () => {
    await renderWithTheme(<BookingTravellersScreen {...baseProps()} />);

    expect(screen.getByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('12 seats left on this date')).toBeTruthy();
    expect(screen.getByText('$1,377')).toBeTruthy();
    expect(screen.queryByText("That's the most this tour takes — 16 guests.")).toBeNull();
  });

  it('bấm + của Adults gọi onIncreaseAdults', async () => {
    const onIncreaseAdults = jest.fn();
    await renderWithTheme(<BookingTravellersScreen {...baseProps({ onIncreaseAdults })} />);

    await fireEvent.press(screen.getByLabelText('Increase adults'));
    expect(onIncreaseAdults).toHaveBeenCalled();
  });

  it('adultsAtCap → nút + tắt (disabled)', async () => {
    await renderWithTheme(<BookingTravellersScreen {...baseProps({ adultsAtCap: true })} />);

    expect(screen.getByLabelText('Increase adults').props.accessibilityState.disabled).toBe(true);
  });

  it('B2 — chạm trần thì dải nhắc nổi hiện ra', async () => {
    await renderWithTheme(
      <BookingTravellersScreen
        {...baseProps({
          capReachedNote: "That's the most this tour takes — 16 guests.",
          adultsAtCap: true,
        })}
      />,
    );

    expect(screen.getByText("That's the most this tour takes — 16 guests.")).toBeTruthy();
  });

  it('bấm Continue gọi onContinue', async () => {
    const onContinue = jest.fn();
    await renderWithTheme(<BookingTravellersScreen {...baseProps({ onContinue })} />);

    await fireEvent.press(screen.getByText('Continue'));
    expect(onContinue).toHaveBeenCalled();
  });
});
