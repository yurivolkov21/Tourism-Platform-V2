import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { AppImage } from './app-image';

describe('AppImage (apps/mobile)', () => {
  it('gắn sẵn cloudinaryUrl() làm transformUrl — source.uri có segment transform Cloudinary', async () => {
    await renderWithTheme(
      <AppImage
        source="https://res.cloudinary.com/demo/image/upload/v1/tourism/hero"
        width={320}
        alt="Hero"
      />,
    );

    // expo-image bọc `source` đơn thành mảng 1 phần tử (xem app-image.spec.tsx
    // của @tourism/mobile-ui) — khớp đúng shape thật, không phải riêng mock jest.
    expect(screen.getByLabelText('Hero').props.source).toEqual([
      {
        uri: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v1/tourism/hero',
      },
    ]);
  });
});
