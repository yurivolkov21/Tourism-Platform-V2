import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { ExploreScreen, type ExploreScreenProps } from './explore-screen';

const CATEGORIES = [
  { slug: 'day-tours', name: 'Day Tours' },
  { slug: 'multi-day', name: 'Multi-day Packages' },
];

function baseProps(overrides: Partial<ExploreScreenProps> = {}): ExploreScreenProps {
  return {
    status: 'content',
    title: 'Explore tours',
    searchValue: '',
    searchPlaceholder: 'Search tours or destinations',
    onChangeSearch: jest.fn(),
    onRetry: jest.fn(),
    activeFilterCount: 0,
    onOpenFilters: jest.fn(),
    filtersLabel: 'Filters',
    clearFiltersLabel: 'Clear filters',
    categories: CATEGORIES,
    selectedCategory: null,
    onSelectCategory: jest.fn(),
    allCategoriesLabel: 'All',
    destinationHeader: null,
    onClearDestination: jest.fn(),
    onClearFilters: jest.fn(),
    destinationsTitle: 'Destinations',
    searchDestinations: [],
    onSelectDestination: jest.fn(),
    resultsCountLabel: '2 tours',
    tours: [
      {
        slug: 'hoi-an-lantern-evening',
        imageUrl: null,
        title: 'Hội An Old Town & Lantern Evening',
        locationLabel: 'Hội An · 1 day',
        priceLabel: '$39',
        compareAtPriceLabel: null,
        rating: 4.8,
        favorited: false,
      },
      {
        slug: 'central-heritage-4d',
        imageUrl: null,
        title: 'Central Heritage 4D3N',
        locationLabel: 'Đà Nẵng · 4 days',
        priceLabel: '$419',
        compareAtPriceLabel: '$459',
        rating: 4.3,
        favorited: true,
      },
    ],
    onTourPress: jest.fn(),
    onFavoritePress: jest.fn(),
    fromLabel: 'From',
    favoriteLabelFor: (title: string) => `Save ${title} to your wishlist`,
    emptyTitle: 'No tours match your search.',
    errorTitle: "Couldn't load tours. Check your connection and try again.",
    retryLabel: 'Try again',
    ...overrides,
  };
}

describe('ExploreScreen', () => {
  it('trạng thái loading: vẽ khung xám, không vẽ danh sách', async () => {
    await renderWithTheme(<ExploreScreen {...baseProps({ status: 'loading' })} />);
    expect(screen.queryByText('Hội An Old Town & Lantern Evening')).toBeNull();
  });

  it('trạng thái error: vẽ câu lỗi + nút thử lại, bấm gọi onRetry', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(<ExploreScreen {...baseProps({ status: 'error', onRetry })} />);

    expect(
      screen.getByText("Couldn't load tours. Check your connection and try again."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('tours rỗng: vẽ empty state kèm nút Clear filters, bấm gọi onClearFilters', async () => {
    const onClearFilters = jest.fn();
    await renderWithTheme(
      <ExploreScreen {...baseProps({ tours: [], resultsCountLabel: '0 tours', onClearFilters })} />,
    );
    expect(screen.getByText('No tours match your search.')).toBeTruthy();

    await fireEvent.press(screen.getByText('Clear filters'));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('vẽ đủ danh sách tour, đếm kết quả, bấm thẻ gọi onTourPress đúng slug', async () => {
    const onTourPress = jest.fn();
    await renderWithTheme(<ExploreScreen {...baseProps({ onTourPress })} />);

    expect(screen.getByText('2 tours')).toBeTruthy();
    await fireEvent.press(screen.getByText('Hội An Old Town & Lantern Evening'));
    expect(onTourPress).toHaveBeenCalledWith('hoi-an-lantern-evening');
  });

  it('bấm tim trên thẻ gọi onFavoritePress đúng slug (E1)', async () => {
    const onFavoritePress = jest.fn();
    await renderWithTheme(<ExploreScreen {...baseProps({ onFavoritePress })} />);

    await fireEvent.press(
      screen.getByLabelText('Save Hội An Old Town & Lantern Evening to your wishlist'),
    );
    expect(onFavoritePress).toHaveBeenCalledWith('hoi-an-lantern-evening');
  });

  it('wishlistErrorLabel: vẽ banner lỗi; mặc định (không truyền) thì không vẽ gì', async () => {
    await renderWithTheme(<ExploreScreen {...baseProps()} />);
    expect(screen.queryByText('Something went wrong.')).toBeNull();

    const { rerender } = await renderWithTheme(
      <ExploreScreen {...baseProps({ wishlistErrorLabel: 'Something went wrong.' })} />,
    );
    expect(screen.getByText('Something went wrong.')).toBeTruthy();

    await rerender(<ExploreScreen {...baseProps({ wishlistErrorLabel: null })} />);
    expect(screen.queryByText('Something went wrong.')).toBeNull();
  });

  it('không có destinationHeader: vẽ hàng chip danh mục, bấm gọi onSelectCategory', async () => {
    const onSelectCategory = jest.fn();
    await renderWithTheme(<ExploreScreen {...baseProps({ onSelectCategory })} />);

    await fireEvent.press(screen.getByText('Day Tours'));
    expect(onSelectCategory).toHaveBeenCalledWith('day-tours');
  });

  it('có destinationHeader: vẽ đầu trang địa danh, ẨN hàng chip danh mục', async () => {
    await renderWithTheme(
      <ExploreScreen
        {...baseProps({
          destinationHeader: {
            name: 'Hội An',
            region: 'Central Vietnam',
            description: 'A UNESCO-listed trading port.',
            imageUrl: null,
          },
        })}
      />,
    );

    // Xuất hiện CẢ ở chip gỡ được lẫn tiêu đề đầu trang — kiểm số lượng thay vì getByText.
    expect(screen.getAllByText('Hội An').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Day Tours')).toBeNull();
  });

  it('bấm chip địa danh gỡ được gọi onClearDestination', async () => {
    const onClearDestination = jest.fn();
    await renderWithTheme(
      <ExploreScreen
        {...baseProps({
          destinationHeader: { name: 'Hội An', region: null, description: null, imageUrl: null },
          onClearDestination,
        })}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Remove Hội An'));
    expect(onClearDestination).toHaveBeenCalled();
  });

  it('nút Filters mang huy hiệu đúng số facet đang bật, bấm gọi onOpenFilters', async () => {
    const onOpenFilters = jest.fn();
    await renderWithTheme(
      <ExploreScreen {...baseProps({ activeFilterCount: 2, onOpenFilters })} />,
    );

    expect(screen.getByText('2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Filters'));
    expect(onOpenFilters).toHaveBeenCalled();
  });

  it('gõ vào ô tìm gọi onChangeSearch', async () => {
    const onChangeSearch = jest.fn();
    await renderWithTheme(<ExploreScreen {...baseProps({ onChangeSearch })} />);

    await fireEvent.changeText(screen.getByPlaceholderText('Search tours or destinations'), 'ha');
    expect(onChangeSearch).toHaveBeenCalledWith('ha');
  });

  it('E2 — ô tìm không rỗng: vẽ kết quả gộp Destinations/Tours, ẨN hàng chip danh mục', async () => {
    const onSelectDestination = jest.fn();
    await renderWithTheme(
      <ExploreScreen
        {...baseProps({
          searchValue: 'ha',
          searchDestinations: [
            { slug: 'ha-noi', imageUrl: null, name: 'Hà Nội', tourCountLabel: '11 tours' },
          ],
          onSelectDestination,
        })}
      />,
    );

    expect(screen.getByText('Destinations')).toBeTruthy();
    expect(screen.getByText('Hà Nội')).toBeTruthy();
    expect(screen.queryByText('Day Tours')).toBeNull();

    await fireEvent.press(screen.getByText('Hà Nội'));
    expect(onSelectDestination).toHaveBeenCalledWith('ha-noi');
  });

  it('E2 — đang tìm mà cả địa danh lẫn tour đều rỗng: vào E5 (không phải màn trắng)', async () => {
    await renderWithTheme(
      <ExploreScreen {...baseProps({ searchValue: 'xyz', searchDestinations: [], tours: [] })} />,
    );

    expect(screen.getByText('No tours match your search.')).toBeTruthy();
  });
});
