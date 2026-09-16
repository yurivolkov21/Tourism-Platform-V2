import { screen } from '@testing-library/react-native';
import { renderWithTheme, themeFor } from '@/test-utils';
import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  it('vẽ hai viên kim cương: viên sau màu primary, viên trước màu foreground', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<BrandMark />, 'dark');

    const [back, front] = screen.getAllByTestId('brand-diamond');

    expect(back?.props.style).toMatchObject({ backgroundColor: theme.colors.primary });
    expect(front?.props.style).toMatchObject({ backgroundColor: theme.colors.foreground });
  });

  it('bản lớn to hơn bản thường', async () => {
    await renderWithTheme(<BrandMark size="lg" />);
    const large = screen.getAllByTestId('brand-diamond')[0]?.props.style.width;

    await screen.unmount();
    await renderWithTheme(<BrandMark />);
    const small = screen.getAllByTestId('brand-diamond')[0]?.props.style.width;

    expect(large).toBeGreaterThan(small);
  });
});
