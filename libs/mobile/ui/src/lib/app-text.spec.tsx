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
    // Chữ hệ thống mang `fontWeight` và KHÔNG có `fontFamily`; `brand` ngược lại
    // (đặt cả hai thì Android bôi đậm giả — bàn giao mục 7.1).
    if (variant === 'brand') {
      expect(style.fontFamily).toBe(theme.fonts.heading);
      expect(style.fontWeight).toBeUndefined();
    } else {
      expect(style.fontFamily).toBeUndefined();
      expect(style.fontWeight).toBe(theme.weight[weight]);
    }
  });

  // Vòng lặp trên canh việc ÁNH XẠ vai-trò → bậc được nối đúng, nhưng nó vẫn
  // đọc con số từ cùng cầu token. Neo thêm hai bậc bằng SỐ TUYỆT ĐỐI để cả
  // chuỗi tokens.mjs → rn-convert → theme → AppText có một điểm bất động.
  it.each([
    ['display', 30, 36, '400'],
    ['title', 24, 32, '400'],
    ['heading', 16, 24, '500'],
    ['label', 14, 20, '500'],
    ['body', 16, 24, '400'],
    ['caption', 12, 16, '400'],
  ] as const)(
    'bậc "%s" ra đúng %idp/%idp, độ đậm %s, font hệ thống',
    async (variant, size, height, weight) => {
      await renderWithTheme(<AppText variant={variant}>chữ mẫu</AppText>);

      const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
      expect(style.fontSize).toBe(size);
      expect(style.lineHeight).toBe(height);
      expect(style.fontWeight).toBe(weight);
      expect(style.fontFamily).toBeUndefined();
    },
  );

  it('bậc "brand" ra 30/36 với khuôn Literata_700Bold và không có fontWeight', async () => {
    await renderWithTheme(<AppText variant="brand">chữ mẫu</AppText>);

    const style = StyleSheet.flatten(screen.getByText('chữ mẫu').props.style);
    expect(style.fontSize).toBe(30);
    expect(style.lineHeight).toBe(36);
    expect(style.fontFamily).toBe('Literata_700Bold');
    expect(style.fontWeight).toBeUndefined();
  });

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
