import { screen, userEvent } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { InfoState } from './info-state';

describe('InfoState', () => {
  it('in icon, tiêu đề, mô tả và nút đi tiếp', async () => {
    const onAction = jest.fn();
    const view = await renderWithTheme(
      <InfoState
        icon="link"
        title="This link isn't working"
        body="Request a fresh one and we'll get you back on board."
        actionLabel="Request a new link"
        onAction={onAction}
      />,
      'dark',
    );

    expect(view.getByText("This link isn't working")).toBeTruthy();
    expect(view.getByText("Request a fresh one and we'll get you back on board.")).toBeTruthy();

    await userEvent.setup().press(view.getByText('Request a new link'));

    expect(onAction).toHaveBeenCalled();
  });

  it('không truyền nút thoát thì chỉ còn đúng một nút trên màn', async () => {
    await renderWithTheme(
      <InfoState
        icon="mail"
        title="Check your inbox"
        body="On its way."
        actionLabel="Back"
        onAction={() => {}}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('có dòng phụ thì in dưới mô tả', async () => {
    await renderWithTheme(
      <InfoState
        icon="mail"
        title="Check your inbox"
        body="On its way."
        footnote="Sent to lan@example.com"
        actionLabel="Back"
        onAction={() => {}}
        exit={{ icon: 'arrow-left', label: 'Back', onPress: () => {} }}
      />,
    );

    expect(screen.getByText('Sent to lan@example.com')).toBeTruthy();
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });
});
