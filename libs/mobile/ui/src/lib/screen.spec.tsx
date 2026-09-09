import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { Screen } from './screen';

// `Screen` có HAI tầng: khung ngoài (nền + vùng an toàn) mang `testID` của
// người gọi, vùng nội dung (đệm + cuộn) mang hậu tố `-content`.
const frame = () => screen.getByTestId('screen');
const content = () => screen.getByTestId('screen-content');

describe('Screen', () => {
  it('phủ nền bằng màu `background` của token, không phải màu viết tay', async () => {
    await renderWithTheme(
      <Screen testID="screen">
        <Text>nội dung</Text>
      </Screen>,
    );

    const style = StyleSheet.flatten(frame().props.style);
    expect(style.backgroundColor).toBe(themeFor('light').colors.background);
    expect(style.flex).toBe(1);
  });

  it('đổi sang chế độ tối thì nền đổi theo token tối', async () => {
    await renderWithTheme(<Screen testID="screen" />, 'dark');

    const style = StyleSheet.flatten(frame().props.style);
    expect(style.backgroundColor).toBe(themeFor('dark').colors.background);
  });

  // `SafeAreaView` chuẩn hoá `edges` thành bản đồ chế độ, nên assert vào đó là
  // đọc được giá trị HIỆU LỰC: `additive` = có cộng inset, `off` = không.
  it('mặc định cộng vùng an toàn cả hai cạnh — cho màn không header, không tab', async () => {
    await renderWithTheme(<Screen testID="screen" />);

    expect(frame().props.edges).toEqual({
      top: 'additive',
      bottom: 'additive',
      left: 'off',
      right: 'off',
    });
  });

  // Bản canh của lỗi cộng inset HAI LẦN: màn nằm dưới header của navigator thì
  // header đã ăn `insets.top`, cộng thêm 'top' là ~63dp dải trắng chết. Test
  // đòi cạnh top phải THỰC SỰ `off`, không chỉ là "prop có được truyền".
  it('`edges` truyền vào tắt được đúng cạnh navigator đã lo', async () => {
    await renderWithTheme(<Screen testID="screen" edges={['bottom']} />);

    expect(frame().props.edges).toEqual({
      top: 'off',
      bottom: 'additive',
      left: 'off',
      right: 'off',
    });
  });

  it('mặc định cuộn được, và đệm nằm TRONG vùng cuộn', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Screen testID="screen" />);

    const style = StyleSheet.flatten(content().props.contentContainerStyle);
    expect(style.paddingHorizontal).toBe(theme.spacing(5));
    expect(style.paddingVertical).toBe(theme.spacing(4));
    // Không có `flexGrow` thì nội dung ngắn không phủ hết màn và mọi layout
    // dựa trên `flex` bên trong co lại bằng chiều cao chữ.
    expect(style.flexGrow).toBe(1);
  });

  it('`scrollable={false}` trả về khung tĩnh, đệm nằm ở style thường', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<Screen testID="screen" scrollable={false} />);

    expect(content().props.contentContainerStyle).toBeUndefined();
    const style = StyleSheet.flatten(content().props.style);
    expect(style.paddingHorizontal).toBe(theme.spacing(5));
    expect(style.flex).toBe(1);
  });

  it('`padded={false}` bỏ đệm cho màn có nội dung tràn mép', async () => {
    await renderWithTheme(<Screen testID="screen" padded={false} />);

    const style = StyleSheet.flatten(content().props.contentContainerStyle);
    expect(style.paddingHorizontal).toBeUndefined();
  });

  it('render được con của nó', async () => {
    await renderWithTheme(
      <Screen>
        <Text>xin chào</Text>
      </Screen>,
    );

    expect(screen.getByText('xin chào')).toBeTruthy();
  });
});
