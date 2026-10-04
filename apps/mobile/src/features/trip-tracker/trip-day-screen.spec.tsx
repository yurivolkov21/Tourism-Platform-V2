import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { TripDayScreen, type TripDayScreenProps } from './trip-day-screen';

function baseProps(overrides: Partial<TripDayScreenProps> = {}): TripDayScreenProps {
  return {
    onTourNowLabel: 'On tour now',
    dateLabel: 'Sun 4 Oct',
    dayTitle: 'A full day in Hội An',
    progressPercent: 50,
    dayOfTotalLabel: 'Day 2 of 4',
    endsOnLabel: 'Ends Tue 6 Oct',
    todayLabel: 'Today',
    lines: [
      { time: '08:00', text: 'Drive to Hội An, check in', state: 'done' },
      { time: '11:00', text: 'Cooking class', state: 'active' },
      { time: '12:30', text: 'Lunch', state: 'upcoming' },
    ],
    nextDayRow: { label: 'Tomorrow · Day 3', caption: 'Over the pass', onPress: jest.fn() },
    tripNotesRow: {
      label: 'Trip notes',
      caption: "What to bring, what's included",
      onPress: jest.fn(),
    },
    bookingDetailsRow: {
      label: 'Booking details',
      caption: 'BK-001 · 3 travellers',
      onPress: jest.fn(),
    },
    contactLabel: 'Contact us',
    onContactPress: jest.fn(),
    ...overrides,
  };
}

describe('TripDayScreen', () => {
  it('vẽ tiêu đề ngày, mốc giờ và ba row-link', async () => {
    await renderWithTheme(<TripDayScreen {...baseProps()} />);

    expect(screen.getByText('A full day in Hội An')).toBeTruthy();
    expect(screen.getByText('Cooking class')).toBeTruthy();
    expect(screen.getByText('Tomorrow · Day 3')).toBeTruthy();
    expect(screen.getByText('Trip notes')).toBeTruthy();
    expect(screen.getByText('Booking details')).toBeTruthy();
  });

  it('vắng nextDayRow (ngày cuối) thì không vẽ hàng đó', async () => {
    await renderWithTheme(<TripDayScreen {...baseProps({ nextDayRow: undefined })} />);

    expect(screen.queryByText('Tomorrow · Day 3')).toBeNull();
  });

  it('bấm Contact us gọi onContactPress', async () => {
    const onContactPress = jest.fn();
    await renderWithTheme(<TripDayScreen {...baseProps({ onContactPress })} />);

    await fireEvent.press(screen.getByText('Contact us'));
    expect(onContactPress).toHaveBeenCalled();
  });

  it('bấm hàng Booking details gọi đúng onPress', async () => {
    const onPress = jest.fn();
    const props = baseProps();
    props.bookingDetailsRow.onPress = onPress;
    await renderWithTheme(<TripDayScreen {...props} />);

    await fireEvent.press(screen.getByText('Booking details'));
    expect(onPress).toHaveBeenCalled();
  });
});
