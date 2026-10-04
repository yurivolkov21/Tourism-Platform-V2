import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { BookingStatusScreen, type BookingStatusScreenProps } from './booking-status-screen';

function baseProps(overrides: Partial<BookingStatusScreenProps> = {}): BookingStatusScreenProps {
  return {
    icon: 'external-link',
    heading: 'Finish in your browser',
    body: "Complete your payment in the secure browser window - we'll confirm your booking here when you're back.",
    primary: { label: 'Open payment page', onPress: jest.fn() },
    secondary: { label: "I've finished paying", onPress: jest.fn() },
    ...overrides,
  };
}

describe('BookingStatusScreen', () => {
  it('B5 — vẽ tiêu đề, câu phụ và hai nút', async () => {
    await renderWithTheme(<BookingStatusScreen {...baseProps()} />);

    expect(screen.getByText('Finish in your browser')).toBeTruthy();
    expect(screen.getByText('Open payment page')).toBeTruthy();
    expect(screen.getByText("I've finished paying")).toBeTruthy();
  });

  it('bấm nút chính gọi đúng onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <BookingStatusScreen {...baseProps({ primary: { label: 'Open payment page', onPress } })} />,
    );

    await fireEvent.press(screen.getByText('Open payment page'));
    expect(onPress).toHaveBeenCalled();
  });

  it('bấm nút phụ gọi đúng onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <BookingStatusScreen
        {...baseProps({ secondary: { label: "I've finished paying", onPress } })}
      />,
    );

    await fireEvent.press(screen.getByText("I've finished paying"));
    expect(onPress).toHaveBeenCalled();
  });

  it('B6 — primary/secondary null thì không vẽ nút nào', async () => {
    await renderWithTheme(
      <BookingStatusScreen
        {...baseProps({
          icon: 'loader',
          heading: 'Confirming your payment…',
          body: 'This takes a few seconds. Keep the app open.',
          primary: null,
          secondary: null,
        })}
      />,
    );

    expect(screen.getByText('Confirming your payment…')).toBeTruthy();
    expect(screen.queryByText('Open payment page')).toBeNull();
  });

  it('B7 — icon/tiêu đề/câu khác, hai nút Verify again / Open payment page', async () => {
    const onVerifyAgain = jest.fn();
    await renderWithTheme(
      <BookingStatusScreen
        {...baseProps({
          icon: 'clock',
          heading: 'Payment not confirmed yet',
          body: "We haven't received the payment confirmation yet.",
          primary: { label: 'Verify again', onPress: onVerifyAgain },
          secondary: { label: 'Open payment page', onPress: jest.fn() },
        })}
      />,
    );

    await fireEvent.press(screen.getByText('Verify again'));
    expect(onVerifyAgain).toHaveBeenCalled();
  });
});
