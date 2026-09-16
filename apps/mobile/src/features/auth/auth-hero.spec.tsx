import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme } from '@/test-utils';
import { AuthHero } from './auth-hero';

const image = { uri: 'https://example.test/anh.jpg' };

describe('AuthHero', () => {
  it('có nút thoát đọc được và nhãn địa danh', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <AuthHero
        image={image}
        place="Ha Giang, Vietnam"
        exit={{ icon: 'x', label: 'Close', onPress }}
      />,
    );

    expect(screen.getByText('Ha Giang, Vietnam')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close'));
    expect(onPress).toHaveBeenCalled();
  });

  it('không truyền nút thoát thì không vẽ nút nào — màn kết quả không cho quay lui', async () => {
    await renderWithTheme(<AuthHero image={image} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('bản thấp dùng cho màn form dài (Create account)', async () => {
    // `ImageBackground` gộp style thành mảng, nên phải phẳng hoá trước khi soi.
    const photoHeight = () =>
      StyleSheet.flatten(screen.getByTestId('auth-hero-photo').props.style)?.height;

    await renderWithTheme(<AuthHero image={image} height="short" />);
    const short = photoHeight();

    screen.unmount();
    await renderWithTheme(<AuthHero image={image} />);

    expect(short).toBeLessThan(photoHeight());
  });
});
