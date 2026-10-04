import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { TripUpcomingScreen, type TripUpcomingScreenProps } from './trip-upcoming-screen';

function upcomingProps(overrides: Partial<TripUpcomingScreenProps> = {}): TripUpcomingScreenProps {
  return {
    countdownLabel: 'Departing in',
    countdownValue: '12 days',
    subtitle: 'Sat 3 – Tue 6 Oct 2026 · 3 travellers',
    progressPercent: 18,
    bottomBarLabel: 'Booking details',
    onBottomBarPress: jest.fn(),
    upcoming: {
      bookedLabel: 'Booked 21 Sep',
      departureFooterLabel: 'Departure 3 Oct',
      milestones: [
        {
          state: 'done',
          icon: 'check',
          title: 'Booking confirmed',
          caption: '21 Sep 2026 · BK-001',
        },
        { state: 'done', icon: 'check', title: 'Paid in full', caption: '21 Sep 2026 · $1,377' },
        {
          state: 'now',
          icon: 'shield',
          title: 'Free cancellation until Sat 26 Sep',
          caption: '5 days left',
        },
        {
          state: 'upcoming',
          icon: 'flag',
          title: 'Departure · Sat 3 Oct',
          caption: 'Arrival pickup',
        },
      ],
      getReadyLabel: 'Get ready',
      whatToBringRow: { label: 'What to bring', caption: 'Pack light', onPress: jest.fn() },
      itineraryRow: { label: 'Your itinerary', caption: 'Đà Nẵng → Huế', onPress: jest.fn() },
      includedRow: { label: "What's included", caption: 'Hotels, transfers', onPress: jest.fn() },
    },
    ...overrides,
  };
}

function imminentProps(overrides: Partial<TripUpcomingScreenProps> = {}): TripUpcomingScreenProps {
  return {
    countdownLabel: 'Departing',
    countdownValue: 'Tomorrow',
    subtitle: 'Sat 3 Oct 2026 · 3 travellers',
    progressPercent: 92,
    bottomBarLabel: 'Full trip notes',
    onBottomBarPress: jest.fn(),
    imminent: {
      meetingNote: { title: 'Arrival pickup at Đà Nẵng Airport', body: 'Day 1 starts here.' },
      packingChecklistLabel: 'Packing checklist',
      items: [
        { text: 'ID or passport', checked: false },
        { text: 'Travel insurance', checked: true },
      ],
      onToggle: jest.fn(),
      ticksNoteLabel: 'Ticks are kept on this phone only.',
    },
    ...overrides,
  };
}

describe('TripUpcomingScreen — mặt P1 (upcoming)', () => {
  it('vẽ đếm ngược, rail mốc và ba lối Get ready', async () => {
    await renderWithTheme(<TripUpcomingScreen {...upcomingProps()} />);

    expect(screen.getByText('12 days')).toBeTruthy();
    expect(screen.getByText('Booking confirmed')).toBeTruthy();
    expect(screen.getByText('Paid in full')).toBeTruthy();
    expect(screen.getByText('What to bring')).toBeTruthy();
    expect(screen.getByText('Your itinerary')).toBeTruthy();
    expect(screen.getByText("What's included")).toBeTruthy();
    expect(screen.queryByText('Packing checklist')).toBeNull();
  });

  it('bấm hàng "Your itinerary" gọi đúng onPress của hàng đó', async () => {
    const onPress = jest.fn();
    const props = upcomingProps();
    if (props.upcoming === undefined) throw new Error('test setup: thiếu `upcoming`');
    props.upcoming.itineraryRow.onPress = onPress;
    await renderWithTheme(<TripUpcomingScreen {...props} />);

    await fireEvent.press(screen.getByText('Your itinerary'));
    expect(onPress).toHaveBeenCalled();
  });

  it('bấm nút đáy gọi onBottomBarPress', async () => {
    const onBottomBarPress = jest.fn();
    await renderWithTheme(<TripUpcomingScreen {...upcomingProps({ onBottomBarPress })} />);

    await fireEvent.press(screen.getByText('Booking details'));
    expect(onBottomBarPress).toHaveBeenCalled();
  });
});

describe('TripUpcomingScreen — mặt P2 (imminent)', () => {
  it('vẽ chỗ gặp và checklist, KHÔNG vẽ rail/Get ready', async () => {
    await renderWithTheme(<TripUpcomingScreen {...imminentProps()} />);

    expect(screen.getByText('Tomorrow')).toBeTruthy();
    expect(screen.getByText('Arrival pickup at Đà Nẵng Airport')).toBeTruthy();
    expect(screen.getByText('Packing checklist')).toBeTruthy();
    expect(screen.getByText('ID or passport')).toBeTruthy();
    expect(screen.getByText('Ticks are kept on this phone only.')).toBeTruthy();
    expect(screen.queryByText('Get ready')).toBeNull();
  });

  it('bấm một dòng checklist gọi onToggle với đúng chữ dòng đó', async () => {
    const onToggle = jest.fn();
    const props = imminentProps();
    if (props.imminent === undefined) throw new Error('test setup: thiếu `imminent`');
    props.imminent.onToggle = onToggle;
    await renderWithTheme(<TripUpcomingScreen {...props} />);

    await fireEvent.press(screen.getByText('ID or passport'));
    expect(onToggle).toHaveBeenCalledWith('ID or passport');
  });

  it('meetingNote null thì không vẽ hộp chỗ gặp', async () => {
    const props = imminentProps();
    if (props.imminent === undefined) throw new Error('test setup: thiếu `imminent`');
    props.imminent.meetingNote = null;
    await renderWithTheme(<TripUpcomingScreen {...props} />);

    expect(screen.queryByText('Day 1 starts here.')).toBeNull();
  });
});
