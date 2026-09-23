import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithTheme } from '../test-utils';
import { BottomSheet } from './bottom-sheet';

describe('BottomSheet', () => {
  it('visible=false không vẽ children', async () => {
    await renderWithTheme(
      <BottomSheet visible={false} onClose={jest.fn()}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('Filters')).toBeNull();
  });

  it('visible=true vẽ children', async () => {
    await renderWithTheme(
      <BottomSheet visible onClose={jest.fn()}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Filters')).toBeTruthy();
  });

  it('bấm backdrop gọi onClose', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <BottomSheet visible onClose={onClose}>
        <Text>Filters</Text>
      </BottomSheet>,
    );
    await fireEvent.press(screen.getByTestId('bottom-sheet-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
