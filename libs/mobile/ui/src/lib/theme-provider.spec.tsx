import { render, screen } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from './theme-provider';

// RNTL 14 bỏ React 18 và chuyển API sang bất đồng bộ: `render()` trả Promise,
// chưa `await` thì `screen` còn rỗng ("render function has not been called").
jest.mock('react-native/Libraries/Utilities/useColorScheme');
const mockedUseColorScheme = jest.mocked(useColorScheme);

function Probe() {
  const theme = useTheme();
  return <Text>{`${theme.scheme}|${theme.colors.background}`}</Text>;
}

describe('ThemeProvider', () => {
  beforeEach(() => mockedUseColorScheme.mockReturnValue('light'));

  it('theo useColorScheme của hệ điều hành: sáng ra bảng sáng', async () => {
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText(/^light\|#/)).toBeTruthy();
  });

  it('hệ điều hành đổi sang tối thì theme đổi theo', async () => {
    mockedUseColorScheme.mockReturnValue('dark');
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText(/^dark\|#/)).toBeTruthy();
  });

  it('coi unspecified (hệ chưa báo) là sáng thay vì nổ', async () => {
    mockedUseColorScheme.mockReturnValue('unspecified');
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText(/^light\|#/)).toBeTruthy();
  });

  it('prop `scheme` ép chế độ, bỏ qua hệ điều hành', async () => {
    mockedUseColorScheme.mockReturnValue('light');
    await render(
      <ThemeProvider scheme="dark">
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText(/^dark\|#/)).toBeTruthy();
  });
});

describe('useTheme', () => {
  it('ném lỗi RÕ NGHĨA khi dùng ngoài ThemeProvider', async () => {
    // React in lỗi ra console khi component ném — tắt cho output test sạch.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(render(<Probe />)).rejects.toThrow(/ThemeProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});
