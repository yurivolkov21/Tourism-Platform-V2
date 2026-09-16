import { screen, userEvent } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { OnboardingScreen, type OnboardingScreenProps } from './onboarding-screen';

const copy = messages.mobile.onboarding;

const base: OnboardingScreenProps = {
  index: 0,
  onNext: jest.fn(),
  onSkip: jest.fn(),
  onStart: jest.fn(),
  onSignIn: jest.fn(),
};

describe('OnboardingScreen', () => {
  it.each([[0], [1]])('khung 1b/1c — trang %i có Skip, ba chấm và nút đi tiếp', async (index) => {
    const page = copy.pages[index];
    await renderWithTheme(<OnboardingScreen {...base} index={index} />, 'dark');

    expect(screen.getByText(copy.skip)).toBeTruthy();
    expect(screen.getByText(page?.title ?? '')).toBeTruthy();
    expect(screen.getByText(page?.place ?? '')).toBeTruthy();
    expect(screen.getByLabelText(copy.next)).toBeTruthy();
    expect(screen.getByTestId('onboarding-dots')).toBeTruthy();
  });

  it('khung 1d — trang cuối đổi sang hai nút và bỏ Skip', async () => {
    await renderWithTheme(<OnboardingScreen {...base} index={2} />, 'dark');

    expect(screen.getByText(copy.start)).toBeTruthy();
    expect(screen.getByText(copy.haveAccount)).toBeTruthy();
    expect(screen.queryByText(copy.skip)).toBeNull();
    expect(screen.queryByLabelText(copy.next)).toBeNull();
  });

  it('mỗi trang dùng đúng ảnh của trang đó', async () => {
    const view = await renderWithTheme(<OnboardingScreen {...base} index={1} />);

    expect(view.getByTestId('onboarding-photo').props.source).toBeDefined();
  });

  it('bấm Skip và bấm nút đi tiếp đều báo ra ngoài', async () => {
    const onSkip = jest.fn();
    const onNext = jest.fn();
    const view = await renderWithTheme(
      <OnboardingScreen {...base} onSkip={onSkip} onNext={onNext} />,
    );

    const user = userEvent.setup();
    await user.press(view.getByText(copy.skip));
    await user.press(view.getByLabelText(copy.next));

    expect(onSkip).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });

  it('trang cuối: hai nút gọi đúng hai hàm khác nhau', async () => {
    const onStart = jest.fn();
    const onSignIn = jest.fn();
    const view = await renderWithTheme(
      <OnboardingScreen {...base} index={2} onStart={onStart} onSignIn={onSignIn} />,
    );

    const user = userEvent.setup();
    await user.press(view.getByText(copy.start));
    await user.press(view.getByText(copy.haveAccount));

    expect(onStart).toHaveBeenCalled();
    expect(onSignIn).toHaveBeenCalled();
  });
});
