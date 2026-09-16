import { screen } from '@testing-library/react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { FormMessage } from './form-message';
import { withAlpha } from './theme';

describe('FormMessage', () => {
  it('tông lỗi đọc được như một cảnh báo', async () => {
    await renderWithTheme(<FormMessage tone="error">Invalid email or password.</FormMessage>);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Invalid email or password.')).toBeTruthy();
  });

  it('tông lỗi lấy nền và viền suy từ token destructive-emphasis', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(<FormMessage tone="error">Sai rồi</FormMessage>, 'dark');

    const box = screen.getByRole('alert').props.style;
    expect(box.backgroundColor).toBe(withAlpha(theme.colors['destructive-emphasis'], 0.16));
    expect(box.borderColor).toBe(withAlpha(theme.colors['destructive-emphasis'], 0.45));
  });

  it('tông thông tin dùng nền secondary của token', async () => {
    const theme = themeFor('dark');
    await renderWithTheme(
      <FormMessage tone="info">We sent a new code. It expires in 10 minutes.</FormMessage>,
      'dark',
    );

    expect(screen.getByRole('alert').props.style.backgroundColor).toBe(theme.colors.secondary);
    expect(screen.getByText('We sent a new code. It expires in 10 minutes.')).toBeTruthy();
  });
});
