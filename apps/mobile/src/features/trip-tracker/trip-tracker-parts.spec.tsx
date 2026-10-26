import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithTheme, themeFor } from '@/test-utils';
import { RowLink, TripCountCard } from './trip-tracker-parts';

describe('RowLink (D1–D3, thẻ rời)', () => {
  it('hàng đầu bo trên 20, hàng cuối bo dưới 20, nền card, cách nhau 2dp', async () => {
    const theme = themeFor('light');
    await renderWithTheme(
      <>
        <RowLink first icon="briefcase" label="First" caption="c1" onPress={() => {}} />
        <RowLink last icon="map" label="Last" caption="c2" onPress={() => {}} />
      </>,
    );

    const [first, last] = screen.getAllByRole('button');
    const a = StyleSheet.flatten(first?.props.style);
    const b = StyleSheet.flatten(last?.props.style);
    expect(a).toMatchObject({
      borderTopLeftRadius: 20,
      borderBottomLeftRadius: 4,
      marginBottom: 2,
      backgroundColor: theme.colors.card,
    });
    expect(b).toMatchObject({
      borderTopLeftRadius: 4,
      borderBottomLeftRadius: 20,
      marginBottom: 0,
    });
    expect(a.borderBottomWidth).toBeUndefined();
  });
});

describe('TripCountCard', () => {
  it('thẻ Material 3: bo 16, không viền', async () => {
    await renderWithTheme(
      <TripCountCard>
        <Text>đếm ngược</Text>
      </TripCountCard>,
    );

    const style = StyleSheet.flatten(screen.getByText('đếm ngược').parent?.props.style);
    expect(style.borderRadius).toBe(16);
    expect(style.borderWidth).toBeUndefined();
  });
});
