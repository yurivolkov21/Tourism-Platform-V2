import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { APP_TEXT_VARIANTS, AppText, type AppTextVariant } from './app-text';

const variants = Object.keys(APP_TEXT_VARIANTS) as AppTextVariant[];

describe('AppText', () => {
  it.each(variants)('bậc "%s" lấy ĐÚNG fontSize/lineHeight từ token', async (variant) => {
    const theme = themeFor('light');
    const { step, weight } = APP_TEXT_VARIANTS[variant];
    await renderWithTheme(<AppText variant={variant}>chữ mẫu</AppText>);

    const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
    // KHÔNG `?.`: nếu bậc biến mất thì hai vế cùng `undefined` và test xanh oan.
    expect(style.fontSize).toBe(theme.type[step].fontSize);
    expect(style.lineHeight).toBe(theme.type[step].lineHeight);
    // P5b-1: độ đậm nay nằm trong CHÍNH family (mỗi độ đậm một khuôn chữ của
    // `@expo-google-fonts`), nên style mang `fontFamily` chứ không mang
    // `fontWeight` — đặt cả hai thì Android bôi đậm giả lên khuôn đã đậm.
    const heading = variant === 'display' || variant === 'title';
    expect(style.fontFamily).toBe(heading ? theme.fonts.heading : theme.fonts[weight]);
    expect(style.fontWeight).toBeUndefined();
  });

  // Vòng lặp trên canh việc ÁNH XẠ vai-trò → bậc được nối đúng, nhưng nó vẫn
  // đọc con số từ cùng cầu token. Neo thêm hai bậc bằng SỐ TUYỆT ĐỐI để cả
  // chuỗi tokens.mjs → rn-convert → theme → AppText có một điểm bất động.
  it.each([
    ['display', 30, 36, 'Literata_700Bold'],
    ['body', 16, 24, 'Archivo_400Regular'],
  ] as const)(
    'bậc "%s" ra đúng %idp/%idp và khuôn chữ %s',
    async (variant, size, height, family) => {
      await renderWithTheme(<AppText variant={variant}>chữ mẫu</AppText>);

      const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
      expect(style.fontSize).toBe(size);
      expect(style.lineHeight).toBe(height);
      // Độ đậm nay nằm trong tên khuôn chữ (P5b-1) — neo bằng chính tên đó.
      expect(style.fontFamily).toBe(family);
    },
  );

  it('mặc định là bậc `body`', async () => {
    const theme = themeFor('light');
    await renderWithTheme(<AppText>chữ mẫu</AppText>);

    const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
    expect(style.fontSize).toBe(theme.type.base.fontSize);
  });

  it('màu chữ mặc định là `foreground` của token', async () => {
    await renderWithTheme(<AppText>chữ mẫu</AppText>);

    const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
    expect(style.color).toBe(themeFor('light').colors.foreground);
  });

  it('tone "muted" dùng `muted-foreground`', async () => {
    await renderWithTheme(<AppText tone="muted">chữ mẫu</AppText>);

    const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
    expect(style.color).toBe(themeFor('light').colors['muted-foreground']);
  });

  it('cho phép ghi đè màu qua prop style mà không mất bậc chữ', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <AppText variant="title" style={{ color: theme.colors.primary }}>
        chữ mẫu
      </AppText>,
    );

    const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
    expect(style.color).toBe(theme.colors.primary);
    expect(style.fontSize).toBe(theme.type['2xl']?.fontSize);
  });
});
