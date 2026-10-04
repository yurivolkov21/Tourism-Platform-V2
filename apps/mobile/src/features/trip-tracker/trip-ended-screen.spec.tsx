import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { TripEndedScreen, type TripEndedScreenProps } from './trip-ended-screen';

function baseProps(overrides: Partial<TripEndedScreenProps> = {}): TripEndedScreenProps {
  return {
    welcomeBackLabel: 'Welcome back',
    summary: 'You finished Central Heritage on Tue 6 Oct 2026.',
    stats: [
      { value: 4, label: 'days' },
      { value: 3, label: 'places' },
      { value: 3, label: 'travellers' },
    ],
    reviewed: false,
    howWasItTitle: 'How was it?',
    howWasItBody: 'Your review helps the next traveller pick this route.',
    writeReviewLabel: 'Write a review',
    onWriteReviewPress: jest.fn(),
    reviewedLabel: 'You reviewed this trip',
    bookingDetailsRow: {
      label: 'Booking details',
      caption: 'BK-001 · $1,377 paid',
      onPress: jest.fn(),
    },
    whereToNextRow: { label: 'Where to next?', caption: 'Tours near Huế', onPress: jest.fn() },
    ...overrides,
  };
}

describe('TripEndedScreen', () => {
  it('chưa viết review: vẽ khối How was it + nút Write a review', async () => {
    await renderWithTheme(<TripEndedScreen {...baseProps()} />);

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('How was it?')).toBeTruthy();
    expect(screen.getByText('Write a review')).toBeTruthy();
    expect(screen.queryByText('You reviewed this trip')).toBeNull();
  });

  it('bấm Write a review gọi onWriteReviewPress', async () => {
    const onWriteReviewPress = jest.fn();
    await renderWithTheme(<TripEndedScreen {...baseProps({ onWriteReviewPress })} />);

    await fireEvent.press(screen.getByText('Write a review'));
    expect(onWriteReviewPress).toHaveBeenCalled();
  });

  it('đã viết review: ẨN khối How was it/nút, hiện câu đã đánh giá', async () => {
    await renderWithTheme(<TripEndedScreen {...baseProps({ reviewed: true })} />);

    expect(screen.getByText('You reviewed this trip')).toBeTruthy();
    expect(screen.queryByText('How was it?')).toBeNull();
    expect(screen.queryByText('Write a review')).toBeNull();
  });

  it('vẽ ba số thống kê và hai row-link, bấm được', async () => {
    const onPress = jest.fn();
    const props = baseProps();
    props.whereToNextRow.onPress = onPress;
    await renderWithTheme(<TripEndedScreen {...props} />);

    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('places')).toBeTruthy();
    await fireEvent.press(screen.getByText('Where to next?'));
    expect(onPress).toHaveBeenCalled();
  });
});
