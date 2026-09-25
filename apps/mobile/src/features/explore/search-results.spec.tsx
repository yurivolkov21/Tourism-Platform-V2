import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { SearchResults, type SearchResultsProps } from './search-results';

function baseProps(overrides: Partial<SearchResultsProps> = {}): SearchResultsProps {
  return {
    destinationsTitle: 'Destinations',
    destinations: [
      { slug: 'ha-noi', imageUrl: null, name: 'Hà Nội', tourCountLabel: '11 tours' },
      { slug: 'ha-long', imageUrl: null, name: 'Hạ Long', tourCountLabel: '4 tours' },
    ],
    toursCountLabel: '6 tours',
    tours: [
      {
        slug: 'ha-giang-loop-4d',
        imageUrl: null,
        title: 'Hà Giang Loop by Easyrider 4D3N',
        locationLabel: 'Hà Giang · 4 days · From $329',
      },
    ],
    onDestinationPress: jest.fn(),
    onTourPress: jest.fn(),
    ...overrides,
  };
}

describe('SearchResults', () => {
  it('vẽ nhóm Destinations (cuộn ngang) rồi nhóm Tours (danh sách dọc)', async () => {
    await renderWithTheme(<SearchResults {...baseProps()} />);

    expect(screen.getByText('Destinations')).toBeTruthy();
    expect(screen.getByText('Hà Nội')).toBeTruthy();
    expect(screen.getByText('11 tours')).toBeTruthy();
    expect(screen.getByText('6 tours')).toBeTruthy();
    expect(screen.getByText('Hà Giang Loop by Easyrider 4D3N')).toBeTruthy();
    expect(screen.getByText('Hà Giang · 4 days · From $329')).toBeTruthy();
  });

  it('bấm thẻ địa danh gọi onDestinationPress đúng slug', async () => {
    const onDestinationPress = jest.fn();
    await renderWithTheme(<SearchResults {...baseProps({ onDestinationPress })} />);

    await fireEvent.press(screen.getByText('Hà Nội'));
    expect(onDestinationPress).toHaveBeenCalledWith('ha-noi');
  });

  it('bấm hàng tour gọi onTourPress đúng slug', async () => {
    const onTourPress = jest.fn();
    await renderWithTheme(<SearchResults {...baseProps({ onTourPress })} />);

    await fireEvent.press(screen.getByText('Hà Giang Loop by Easyrider 4D3N'));
    expect(onTourPress).toHaveBeenCalledWith('ha-giang-loop-4d');
  });

  it('destinations rỗng: không vẽ nhóm Destinations', async () => {
    await renderWithTheme(<SearchResults {...baseProps({ destinations: [] })} />);
    expect(screen.queryByText('Destinations')).toBeNull();
  });

  it('tours rỗng: không vẽ đếm/danh sách tour', async () => {
    await renderWithTheme(
      <SearchResults {...baseProps({ tours: [], toursCountLabel: '0 tours' })} />,
    );
    expect(screen.queryByText('0 tours')).toBeNull();
  });
});
