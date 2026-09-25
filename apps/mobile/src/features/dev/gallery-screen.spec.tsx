import { screen, userEvent } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { GALLERY_ENTRIES } from './gallery-entries';
import { GalleryScreen } from './gallery-screen';

describe('GalleryScreen', () => {
  it('liệt kê đủ 17 khung của spec §4', async () => {
    await renderWithTheme(
      <GalleryScreen title="Gallery — cụm auth" entries={GALLERY_ENTRIES} />,
      'dark',
    );

    expect(screen.getAllByTestId('gallery-entry')).toHaveLength(GALLERY_ENTRIES.length);
    expect(GALLERY_ENTRIES).toHaveLength(17);
  });

  it('mã khung không trùng nhau — mỗi mã phải chỉ đúng một khung của mockup', () => {
    const ids = GALLERY_ENTRIES.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bấm một dòng thì mở đúng khung đó, bấm đóng thì về danh sách', async () => {
    const view = await renderWithTheme(
      <GalleryScreen title="Gallery — cụm auth" entries={GALLERY_ENTRIES} />,
    );
    const user = userEvent.setup();

    await user.press(view.getByText('Sign in — trống'));

    expect(view.getByText(messages.mobile.auth.signIn.body)).toBeTruthy();
    expect(view.queryByText('Create account — trống')).toBeNull();

    await user.press(view.getByLabelText('Đóng khung đang xem'));

    expect(view.getByText('Create account — trống')).toBeTruthy();
  });
});
