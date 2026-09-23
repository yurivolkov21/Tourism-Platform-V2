import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { AppImage } from './app-image';

describe('AppImage', () => {
  it('build source.uri qua transformUrl với đúng width truyền vào', async () => {
    const transformUrl = jest.fn((src: string, width: number) => `${src}?w=${width}`);
    await renderWithTheme(
      <AppImage
        source="https://res.cloudinary.com/demo/image/upload/hero.jpg"
        width={320}
        alt="Hero"
        transformUrl={transformUrl}
      />,
    );

    expect(transformUrl).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/hero.jpg',
      320,
    );
    // expo-image (Image.tsx → resolveSources()) LUÔN bọc `source` đơn thành mảng
    // 1 phần tử trước khi đưa xuống native view — đã xác nhận bằng cách đọc
    // source thật đã cài (node_modules/.pnpm/expo-image@57.0.5.../src/utils/resolveSources.tsx),
    // không phải hành vi riêng của mock jest-expo. Assertion khớp shape thật.
    expect(screen.getByLabelText('Hero').props.source).toEqual([
      { uri: 'https://res.cloudinary.com/demo/image/upload/hero.jpg?w=320' },
    ]);
  });

  it('accessibilityLabel lấy từ prop alt', async () => {
    await renderWithTheme(
      <AppImage
        source="https://res.cloudinary.com/demo/image/upload/hero.jpg"
        width={100}
        alt="Vịnh Hạ Long"
      />,
    );
    expect(screen.getByLabelText('Vịnh Hạ Long')).toBeTruthy();
  });
});
