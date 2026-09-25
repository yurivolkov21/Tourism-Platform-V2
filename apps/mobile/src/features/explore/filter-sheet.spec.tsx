import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { FilterSheet, type SortKey } from './filter-sheet';
import { EMPTY_TOUR_FILTERS } from './tour-filters';

const REGIONS = [
  { key: 'Northern Vietnam', label: 'North' },
  { key: 'Central Vietnam', label: 'Central' },
  { key: 'Southern Vietnam', label: 'South' },
];
const DURATIONS = [
  { key: '1' as const, label: '1 day' },
  { key: '2-3' as const, label: '2–3 days' },
  { key: '4+' as const, label: '4+ days' },
];
const PRICES = [
  { key: '<100' as const, label: 'Under $100' },
  { key: '100-300' as const, label: '$100–300' },
  { key: '300+' as const, label: 'Over $300' },
];
const DIFFICULTIES = [
  { key: 'EASY' as const, label: 'Easy' },
  { key: 'MODERATE' as const, label: 'Moderate' },
  { key: 'CHALLENGING' as const, label: 'Challenging' },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'priceAsc', label: 'Price: low to high' },
  { key: 'priceDesc', label: 'Price: high to low' },
  { key: 'durationAsc', label: 'Duration: short to long' },
];

function baseProps() {
  return {
    visible: true,
    onClose: jest.fn(),
    regionOptions: REGIONS,
    durationOptions: DURATIONS,
    priceOptions: PRICES,
    difficultyOptions: DIFFICULTIES,
    sortOptions: SORTS,
    filters: EMPTY_TOUR_FILTERS,
    onChangeFilters: jest.fn(),
    sort: 'newest' as SortKey,
    onChangeSort: jest.fn(),
    resultCount: 7,
    onClearAll: jest.fn(),
    labels: {
      title: 'Filters',
      clearAll: 'Clear all',
      regionTitle: 'Region',
      durationTitle: 'Duration',
      priceTitle: 'Price',
      difficultyTitle: 'Difficulty',
      sortTitle: 'Sort by',
      allRegions: 'All',
      showResults: (n: number) => `Show ${n} ${n === 1 ? 'result' : 'results'}`,
    },
  };
}

describe('FilterSheet', () => {
  it('visible=false không vẽ nội dung', async () => {
    await renderWithTheme(<FilterSheet {...baseProps()} visible={false} />);
    expect(screen.queryByText('Filters')).toBeNull();
  });

  it('bấm chip vùng gọi onChangeFilters với đúng region đã chọn', async () => {
    const onChangeFilters = jest.fn();
    await renderWithTheme(<FilterSheet {...baseProps()} onChangeFilters={onChangeFilters} />);

    await fireEvent.press(screen.getByText('Central'));
    expect(onChangeFilters).toHaveBeenCalledWith({
      ...EMPTY_TOUR_FILTERS,
      regions: ['Central Vietnam'],
    });
  });

  it('bấm lại chip vùng đang chọn thì gỡ (về All)', async () => {
    const onChangeFilters = jest.fn();
    await renderWithTheme(
      <FilterSheet
        {...baseProps()}
        filters={{ ...EMPTY_TOUR_FILTERS, regions: ['Central Vietnam'] }}
        onChangeFilters={onChangeFilters}
      />,
    );

    await fireEvent.press(screen.getByText('Central'));
    expect(onChangeFilters).toHaveBeenCalledWith(EMPTY_TOUR_FILTERS);
  });

  it('bấm chip sort gọi onChangeSort, KHÔNG gỡ được (luôn đúng một sort)', async () => {
    const onChangeSort = jest.fn();
    await renderWithTheme(<FilterSheet {...baseProps()} onChangeSort={onChangeSort} />);

    await fireEvent.press(screen.getByText('Price: low to high'));
    expect(onChangeSort).toHaveBeenCalledWith('priceAsc');
  });

  it('nút chính hiện đúng số kết quả và gọi onClose khi bấm (bộ lọc đã áp dụng tức thì)', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<FilterSheet {...baseProps()} onClose={onClose} resultCount={7} />);

    const cta = screen.getByText('Show 7 results');
    await fireEvent.press(cta);
    expect(onClose).toHaveBeenCalled();
  });

  it('bấm "Clear all" gọi onClearAll', async () => {
    const onClearAll = jest.fn();
    await renderWithTheme(<FilterSheet {...baseProps()} onClearAll={onClearAll} />);

    await fireEvent.press(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});
