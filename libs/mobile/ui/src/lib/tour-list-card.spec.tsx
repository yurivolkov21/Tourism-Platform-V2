import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
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
});
