import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '@/test-utils';
import { BookingStepProgress } from './booking-parts';

const NAMES = ['Travellers', 'Contact', 'Review', 'Pay'] as const;

describe('BookingStepProgress — hàng tên bước (B4)', () => {
  it('in đủ bốn tên bước dưới vạch', async () => {
    await renderWithTheme(
      <BookingStepProgress step={2} total={4} label="Step 2 of 4" stepNames={NAMES} />,
    );

    for (const name of NAMES) expect(screen.getByText(name)).toBeTruthy();
  });

  it('bước đã qua primary-emphasis, bước hiện tại foreground medium, bước sau muted-foreground', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <BookingStepProgress step={2} total={4} label="Step 2 of 4" stepNames={NAMES} />,
    );

    const past = StyleSheet.flatten(screen.getByText('Travellers').props.style);
    const current = StyleSheet.flatten(screen.getByText('Contact').props.style);
    const next = StyleSheet.flatten(screen.getByText('Review').props.style);
    expect(past.color).toBe(theme.colors['primary-emphasis']);
    expect(current.color).toBe(theme.colors.foreground);
    expect(current.fontWeight).toBe(theme.weight.medium);
    expect(next.color).toBe(theme.colors['muted-foreground']);
  });

  it('không truyền stepNames thì không in hàng tên (tương thích ngược)', async () => {
    await renderWithTheme(<BookingStepProgress step={1} total={4} label="Step 1 of 4" />);

    expect(screen.queryByText('Travellers')).toBeNull();
  });

  it('bước 4 (Pay): ba bước trước primary-emphasis, "Pay" là bước hiện tại', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <BookingStepProgress step={4} total={4} label="Step 4 of 4" stepNames={NAMES} />,
    );

    expect(StyleSheet.flatten(screen.getByText('Review').props.style).color).toBe(
      theme.colors['primary-emphasis'],
    );
    expect(StyleSheet.flatten(screen.getByText('Pay').props.style).color).toBe(
      theme.colors.foreground,
    );
  });
});
