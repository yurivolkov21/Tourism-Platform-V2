import { act, fireEvent, screen } from '@testing-library/react-native';
import type { Destination } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { HomeScreen } from './home-screen';

const { home } = messages.mobile;

function dest(overrides: Partial<Destination>): Destination {
  return {
    id: 'id',
    slug: 'ha-noi',
    name: 'Hà Nội',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'Capital city.',
    tourCount: 11,
    cover: null,
    ...overrides,
  };
}

const REGIONS = [
  { key: 'Northern Vietnam', label: 'North' },
  { key: 'Central Vietnam', label: 'Central' },
  { key: 'Southern Vietnam', label: 'South' },
];

const NOOP_PROPS = {
  regions: REGIONS,
  selectedRegion: 'Northern Vietnam',
  onSelectRegion: jest.fn(),
  onRetry: jest.fn(),
  onSearchPress: jest.fn(),
  onAvatarPress: jest.fn(),
  onDestinationPress: jest.fn(),
  onSeeAllTours: jest.fn(),
  userName: 'Traveller',
};

describe('HomeScreen', () => {
  it('vẽ userName truyền vào — KHÔNG phải chuỗi "Traveller" cứng', async () => {
    await renderWithTheme(
      <HomeScreen {...NOOP_PROPS} userName="Lan Nguyễn" status="content" destinations={[]} />,
    );
    expect(screen.getByText('Lan Nguyễn')).toBeTruthy();
  });

  it('status="content" vẽ danh sách thẻ địa danh của vùng đang chọn', async () => {
    await renderWithTheme(
      <HomeScreen {...NOOP_PROPS} status="content" destinations={[dest({})]} />,
    );
    expect(screen.getByText('Hà Nội')).toBeTruthy();
  });

  it('status="loading" vẽ khung xám, KHÔNG vẽ thẻ', async () => {
    await renderWithTheme(
      <HomeScreen {...NOOP_PROPS} status="loading" destinations={[dest({})]} />,
    );
    expect(screen.queryByText('Hà Nội')).toBeNull();
  });

  it('sau 3 giây tải mới hiện câu slowServer', async () => {
    jest.useFakeTimers();
    await renderWithTheme(<HomeScreen {...NOOP_PROPS} status="loading" destinations={[]} />);
    expect(screen.queryByText(home.slowServer)).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(home.slowServer)).toBeTruthy();
    jest.useRealTimers();
  });

  it('status="error" hiện câu lỗi + nút retry, KHÔNG hiện empty-state (failed thắng isEmpty)', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(
      <HomeScreen {...NOOP_PROPS} status="error" destinations={[]} onRetry={onRetry} />,
    );
    expect(screen.getByText(home.error)).toBeTruthy();
    expect(screen.queryByText(home.regionEmpty)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: home.retry }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('status="content" nhưng vùng rỗng → hiện regionEmpty + "See all tours"', async () => {
    const onSeeAllTours = jest.fn();
    await renderWithTheme(
      <HomeScreen
        {...NOOP_PROPS}
        status="content"
        destinations={[]}
        onSeeAllTours={onSeeAllTours}
      />,
    );
    expect(screen.getByText(home.regionEmpty)).toBeTruthy();

    await fireEvent.press(screen.getByText(home.seeAllTours));
    expect(onSeeAllTours).toHaveBeenCalled();
  });

  it('bấm đoạn vùng khác gọi onSelectRegion', async () => {
    const onSelectRegion = jest.fn();
    await renderWithTheme(
      <HomeScreen
        {...NOOP_PROPS}
        status="content"
        destinations={[]}
        onSelectRegion={onSelectRegion}
      />,
    );
    await fireEvent.press(screen.getByText('South'));
    expect(onSelectRegion).toHaveBeenCalledWith('Southern Vietnam');
  });
});
