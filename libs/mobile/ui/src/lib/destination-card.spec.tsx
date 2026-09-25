import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { DestinationCard } from './destination-card';

const BASE_PROPS = {
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/hanoi.jpg',
  imageAlt: 'Hà Nội',
  name: 'Hà Nội',
  regionLabel: 'Northern Vietnam',
  description: "Vietnam's capital for over a thousand years.",
  tourCountLabel: '11 tours',
  eyebrow: 'Recommended',
  goToLabel: 'Go to Hà Nội',
  onPress: jest.fn(),
  width: 264,
  height: 370,
};

describe('DestinationCard', () => {
  it('vẽ chip số tour, eyebrow, tên, vùng và mô tả', async () => {
    await renderWithTheme(<DestinationCard {...BASE_PROPS} />);

    expect(screen.getByText('11 tours')).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText('Hà Nội')).toBeTruthy();
    expect(screen.getByText('Northern Vietnam')).toBeTruthy();
    expect(screen.getByText(BASE_PROPS.description)).toBeTruthy();
  });

  it('bấm thẻ hoặc nút mũi tên đều mở đúng địa danh', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<DestinationCard {...BASE_PROPS} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Hà Nội' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Go to Hà Nội' }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('mô tả rỗng thì không vẽ dòng mô tả', async () => {
    await renderWithTheme(<DestinationCard {...BASE_PROPS} description="" />);
    expect(screen.queryByText(BASE_PROPS.description)).toBeNull();
    expect(screen.getByText('Hà Nội')).toBeTruthy();
  });

  it('imageUrl null vẫn vẽ được, không vỡ layout', async () => {
    await renderWithTheme(<DestinationCard {...BASE_PROPS} imageUrl={null} />);
    expect(screen.getByText('Hà Nội')).toBeTruthy();
  });

  it('regionLabel rỗng thì không vẽ ghim vùng', async () => {
    await renderWithTheme(<DestinationCard {...BASE_PROPS} regionLabel="" />);
    expect(screen.queryByText('Northern Vietnam')).toBeNull();
    expect(screen.getByText('Hà Nội')).toBeTruthy();
  });

  it('gọi transformUrl với đúng bề rộng thẻ khi có ảnh', async () => {
    const transformUrl = jest.fn((src: string) => src);
    await renderWithTheme(<DestinationCard {...BASE_PROPS} transformUrl={transformUrl} />);
    expect(transformUrl).toHaveBeenCalledWith(BASE_PROPS.imageUrl, BASE_PROPS.width);
  });
});
