import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { renderWithTheme } from '../test-utils';
import { SwipeToRemove } from './swipe-to-remove';

describe('SwipeToRemove', () => {
  it('hiện nội dung thẻ và nhãn nền phía sau', async () => {
    await renderWithTheme(
      <SwipeToRemove label="Remove" onRemove={() => {}}>
        <Text>Card</Text>
      </SwipeToRemove>,
    );

    expect(screen.getByText('Card')).toBeTruthy();
    expect(screen.getByText('Remove')).toBeTruthy();
  });

  it('vẩy nhanh sang trái thì gọi onRemove; vuốt ngắn và chậm thì không', async () => {
    const onRemove = jest.fn();
    await renderWithTheme(
      <SwipeToRemove label="Remove" onRemove={onRemove}>
        <Text>Card</Text>
      </SwipeToRemove>,
    );
    await fireEvent(screen.getByTestId('swipe-to-remove'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } },
    });
    const pan = getByGestureTestId('swipe-to-remove-pan');

    fireGestureHandler(pan, [
      { translationX: -20, velocityX: -100 },
      { translationX: -30, velocityX: -100 },
    ]);
    expect(onRemove).not.toHaveBeenCalled();

    fireGestureHandler(pan, [
      { translationX: -40, velocityX: -1500 },
      { translationX: -60, velocityX: -1500 },
    ]);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
