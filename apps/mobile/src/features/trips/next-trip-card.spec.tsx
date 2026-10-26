import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme } from '@/test-utils';
import { NextTripCard, type NextTripVM } from './next-trip-card';

const VM: NextTripVM = {
  code: 'TRP-1',
  imageUrl: null,
  title: 'Ha Giang Loop',
  kicker: 'Departing in',
  headline: '12 days',
  subLabel: 'Nov 3 – 7 · 2 travellers',
  ctaLabel: 'View trip',
};

describe('NextTripCard (B5)', () => {
  it('vẽ kicker, số lớn, tên tour, dòng phụ và "View trip"', async () => {
    await renderWithTheme(<NextTripCard trip={VM} onPress={() => {}} />);

    expect(screen.getByText('Departing in')).toBeTruthy();
    expect(screen.getByText('12 days')).toBeTruthy();
    expect(screen.getByText('Ha Giang Loop')).toBeTruthy();
    expect(screen.getByText('Nov 3 – 7 · 2 travellers')).toBeTruthy();
    expect(screen.getByText('View trip')).toBeTruthy();
  });

  it('số lớn dùng biến thể brand (Literata)', async () => {
    await renderWithTheme(<NextTripCard trip={VM} onPress={() => {}} />);

    const style = StyleSheet.flatten(screen.getByText('12 days').props.style);
    expect(style.fontFamily).toBe('Literata_700Bold');
  });

  it('bấm thẻ gọi onPress với mã đơn', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<NextTripCard trip={VM} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: /Ha Giang Loop/ }));

    expect(onPress).toHaveBeenCalledWith('TRP-1');
  });
});
