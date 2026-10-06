import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { AppImage, physicalWidth } from './app-image';

describe('AppImage', () => {
  it('build source.uri qua transformUrl với width đã nhân PixelRatio (mock jest-expo = 2)', async () => {
    const transformUrl = jest.fn((src: string, width: number) => `${src}?w=${width}`);
    await renderWithTheme(
      <AppImage
        source="https://res.cloudinary.com/demo/image/upload/hero.jpg"
        width={320}
        alt="Hero"
        transformUrl={transformUrl}
      />,
    );

    // 320 dp × PixelRatio.get() (2 trong môi trường test) = 640 — xin đúng số
    // pixel VẬT LÝ máy cần vẽ, không phải số dp (phản hồi 27/09: avatar mờ
    // trên máy thật vì trước đây truyền thẳng dp).
    expect(transformUrl).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/hero.jpg',
      640,
    );
    // expo-image (Image.tsx → resolveSources()) LUÔN bọc `source` đơn thành mảng
    // 1 phần tử trước khi đưa xuống native view — đã xác nhận bằng cách đọc
    // source thật đã cài (node_modules/.pnpm/expo-image@57.0.5.../src/utils/resolveSources.tsx),
    // không phải hành vi riêng của mock jest-expo. Assertion khớp shape thật.
    expect(screen.getByLabelText('Hero').props.source).toEqual([
      { uri: 'https://res.cloudinary.com/demo/image/upload/hero.jpg?w=640' },
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

describe('physicalWidth', () => {
  it('nhân dp theo mật độ màn hình rồi làm tròn', () => {
    expect(physicalWidth(320, 2)).toBe(640);
    expect(physicalWidth(101, 1.5)).toBe(152);
  });

  // L2 (review nhánh account): máy 3x xin ảnh rộng 3 lần — mắt thường không phân biệt
  // được 2x với 3x ở ảnh chụp, nhưng số điểm ảnh tải về tăng 2.25 lần.
  it('kẹp mật độ ở 2 — máy 3x không xin ảnh to hơn máy 2x', () => {
    expect(physicalWidth(390, 3)).toBe(780);
    expect(physicalWidth(390, 3.5)).toBe(780);
  });

  it('máy 1x vẫn xin đúng số dp, không phóng lên', () => {
    expect(physicalWidth(390, 1)).toBe(390);
  });
});
