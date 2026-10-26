import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { TourListCard } from './tour-list-card';

describe('TourListCard', () => {
  it('vẽ tiêu đề, vị trí, giá và nhãn "From"', async () => {
    await renderWithTheme(
      <TourListCard
        imageUrl={null}
        imageAlt="Hội An"
        title="Hội An Old Town & Lantern Evening"
        locationLabel="Hội An · 1 day"
        fromLabel="From"
        priceLabel="$39"
        compareAtPriceLabel={null}
        rating={4.8}
        favorited={false}
        favoriteLabel="Save Hội An Old Town & Lantern Evening to your wishlist"
        onFavoritePress={jest.fn()}
        onPress={jest.fn()}
        width={343}
      />,
    );
    expect(screen.getByText('Hội An Old Town & Lantern Evening')).toBeTruthy();
    expect(screen.getByText('Hội An · 1 day')).toBeTruthy();
    expect(screen.getByText('From')).toBeTruthy();
    expect(screen.getByText('$39')).toBeTruthy();
    expect(screen.getByText('4.8')).toBeTruthy();
  });

  it('rating null → không vẽ chip sao', async () => {
    await renderWithTheme(
      <TourListCard
        imageUrl={null}
        imageAlt="Hội An"
        title="Tour"
        locationLabel="Hội An · 1 day"
        fromLabel="From"
        priceLabel="$39"
        compareAtPriceLabel={null}
        rating={null}
        favorited={false}
        favoriteLabel="Save"
        onFavoritePress={jest.fn()}
        onPress={jest.fn()}
        width={343}
      />,
    );
    expect(screen.queryByTestId('tour-list-card-rating')).toBeNull();
  });

  it('có giá gạch thì vẽ compareAtPriceLabel kèm priceLabel', async () => {
    await renderWithTheme(
      <TourListCard
        imageUrl={null}
        imageAlt="Đà Nẵng"
        title="Tour"
        locationLabel="Đà Nẵng · 4 days"
        fromLabel="From"
        priceLabel="$419"
        compareAtPriceLabel="$459"
        rating={4.3}
        favorited={false}
        favoriteLabel="Save"
        onFavoritePress={jest.fn()}
        onPress={jest.fn()}
        width={343}
      />,
    );
    expect(screen.getByText('$459')).toBeTruthy();
    expect(screen.getByText('$419')).toBeTruthy();
  });

  it('bấm thẻ gọi onPress; bấm tim gọi onFavoritePress riêng, không nổi bọt lên onPress', async () => {
    const onPress = jest.fn();
    const onFavoritePress = jest.fn();
    await renderWithTheme(
      <TourListCard
        imageUrl={null}
        imageAlt="Hội An"
        title="Tour"
        locationLabel="Hội An · 1 day"
        fromLabel="From"
        priceLabel="$39"
        compareAtPriceLabel={null}
        rating={4.8}
        favorited={false}
        favoriteLabel="Save Tour to your wishlist"
        onFavoritePress={onFavoritePress}
        onPress={onPress}
        width={343}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Save Tour to your wishlist'));
    expect(onFavoritePress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Tour'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  const base = {
    imageUrl: null,
    imageAlt: 'Hà Giang',
    title: 'Ha Giang Loop',
    locationLabel: 'Ha Giang · 4 days',
    fromLabel: 'From',
    priceLabel: '$480',
    compareAtPriceLabel: null,
    rating: 4.9,
    favorited: false,
    favoriteLabel: 'Save',
    onFavoritePress: jest.fn(),
    onPress: jest.fn(),
    width: 343,
  } as const;

  it('thẻ không khung: không viền, ảnh cao 180 bo 14', async () => {
    await renderWithTheme(<TourListCard {...base} />);

    const card = StyleSheet.flatten(screen.getByLabelText('Ha Giang Loop').props.style);
    expect(card.borderWidth).toBeUndefined();
    expect(card.backgroundColor).toBeUndefined();
  });

  it('có badge thì vẽ đúng một chip badge trên ảnh', async () => {
    await renderWithTheme(<TourListCard {...base} badgeLabel="Popular" />);

    expect(screen.getByTestId('tour-list-card-badge')).toBeTruthy();
    expect(screen.getByText('Popular')).toBeTruthy();
  });

  it('dòng đợt khởi hành: ngày + số chỗ; sắp kín thì số chỗ đổi sang warning-emphasis', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <TourListCard
        {...base}
        departureLabel="Next departure: Nov 3"
        seatsLabel="2 seats left"
        almostFull
      />,
    );

    expect(screen.getByText('Next departure: Nov 3')).toBeTruthy();
    const seats = StyleSheet.flatten(screen.getByTestId('tour-list-card-seats').props.style);
    expect(seats.color).toBe(theme.colors['warning-emphasis']);
  });

  it('còn nhiều chỗ thì số chỗ giữ màu muted', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <TourListCard {...base} departureLabel="Next departure: Nov 3" seatsLabel="8 seats left" />,
    );

    const seats = StyleSheet.flatten(screen.getByTestId('tour-list-card-seats').props.style);
    expect(seats.color).toBe(theme.colors['muted-foreground']);
  });

  it('không có departureLabel thì ẩn dòng đợt', async () => {
    await renderWithTheme(<TourListCard {...base} />);

    expect(screen.queryByTestId('tour-list-card-departure')).toBeNull();
  });

  it('tour đã gỡ: mờ 55%, chip "No longer available", bỏ dòng đợt và chip sao', async () => {
    await renderWithTheme(
      <TourListCard
        {...base}
        unavailable
        unavailableLabel="No longer available"
        departureLabel="Next departure: Nov 3"
      />,
    );

    const card = StyleSheet.flatten(screen.getByLabelText('Ha Giang Loop').props.style);
    expect(card.opacity).toBe(0.55);
    expect(screen.getByText('No longer available')).toBeTruthy();
    expect(screen.queryByTestId('tour-list-card-departure')).toBeNull();
    expect(screen.queryByTestId('tour-list-card-rating')).toBeNull();
  });
});
