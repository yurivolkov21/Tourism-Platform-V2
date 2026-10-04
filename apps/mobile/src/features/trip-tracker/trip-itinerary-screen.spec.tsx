import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { TripItineraryScreen, type TripItineraryScreenProps } from './trip-itinerary-screen';

function baseProps(overrides: Partial<TripItineraryScreenProps> = {}): TripItineraryScreenProps {
  return {
    summaryLabel: '4 days · Đà Nẵng → Hội An → Huế',
    days: [
      {
        dayNumber: 1,
        title: 'Arrival in Đà Nẵng',
        dateLabel: 'Sat 3 Oct',
        lines: [{ kind: 'timed', time: '09:00', text: 'Airport pickup' }],
      },
      {
        dayNumber: 2,
        title: 'A full day in Hội An',
        dateLabel: 'Sun 4 Oct',
        lines: [{ kind: 'plain', text: '6 stops · cooking class' }],
      },
    ],
    initialExpandedDay: 2,
    ...overrides,
  };
}

describe('TripItineraryScreen', () => {
  it('vẽ tóm tắt và tiêu đề mỗi ngày kèm ngày lịch', async () => {
    await renderWithTheme(<TripItineraryScreen {...baseProps()} />);

    expect(screen.getByText('4 days · Đà Nẵng → Hội An → Huế')).toBeTruthy();
    expect(screen.getByText('Arrival in Đà Nẵng')).toBeTruthy();
    expect(screen.getByText('Sat 3 Oct')).toBeTruthy();
    expect(screen.getByText('A full day in Hội An')).toBeTruthy();
  });

  it('mở sẵn đúng ngày truyền vào, dòng của ngày khác không hiện', async () => {
    await renderWithTheme(<TripItineraryScreen {...baseProps()} />);

    expect(screen.getByText('6 stops · cooking class')).toBeTruthy();
    expect(screen.queryByText('Airport pickup')).toBeNull();
  });

  it('bấm ngày 1 thì mở nó ra, đóng ngày 2 lại', async () => {
    await renderWithTheme(<TripItineraryScreen {...baseProps()} />);

    await fireEvent.press(screen.getByText('Arrival in Đà Nẵng'));
    expect(screen.getByText('Airport pickup')).toBeTruthy();
    expect(screen.queryByText('6 stops · cooking class')).toBeNull();
  });

  it('initialExpandedDay = null thì không ngày nào mở', async () => {
    await renderWithTheme(<TripItineraryScreen {...baseProps({ initialExpandedDay: null })} />);

    expect(screen.queryByText('Airport pickup')).toBeNull();
    expect(screen.queryByText('6 stops · cooking class')).toBeNull();
  });
});
