import { screen, userEvent } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { GalleryScreen } from './gallery-screen';
import { TOUR_DETAIL_GALLERY_ENTRIES } from './tour-detail-gallery-entries';

describe('TOUR_DETAIL_GALLERY_ENTRIES', () => {
  it('mã khung không trùng nhau', () => {
    const ids = TOUR_DETAIL_GALLERY_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('liệt kê đủ khung trong GalleryScreen', async () => {
    await renderWithTheme(
      <GalleryScreen title="Gallery — cụm xem tour" entries={TOUR_DETAIL_GALLERY_ENTRIES} />,
    );
    expect(screen.getAllByTestId('gallery-entry')).toHaveLength(TOUR_DETAIL_GALLERY_ENTRIES.length);
  });

  it('mở được khung Dates (đã chọn một đợt), bấm đóng thì về danh sách', async () => {
    const view = await renderWithTheme(
      <GalleryScreen title="Gallery — cụm xem tour" entries={TOUR_DETAIL_GALLERY_ENTRIES} />,
    );
    const user = userEvent.setup();

    await user.press(view.getByText('Chi tiết — Dates (đã chọn một đợt)'));
    expect(view.getByText('Sat 3 – Tue 6 Oct')).toBeTruthy();
    expect(view.getByText('Book now')).toBeTruthy();

    await user.press(view.getByLabelText('Đóng khung đang xem'));
    expect(view.getByText('Chi tiết — Overview')).toBeTruthy();
  });

  it('mở được khung Trình xem ảnh, bấm X của nó rồi bấm nút thoát gallery mới về danh sách', async () => {
    const view = await renderWithTheme(
      <GalleryScreen title="Gallery — cụm xem tour" entries={TOUR_DETAIL_GALLERY_ENTRIES} />,
    );
    const user = userEvent.setup();

    await user.press(view.getByText('Trình xem ảnh'));
    expect(view.getByText('1 / 3')).toBeTruthy();

    await user.press(view.getByLabelText('Close photos'));
    await user.press(view.getByLabelText('Đóng khung đang xem'));
    expect(view.getByText('Chi tiết — Overview')).toBeTruthy();
  });

  it('mở được khung tấm mời đăng nhập (D6)', async () => {
    const view = await renderWithTheme(
      <GalleryScreen title="Gallery — cụm xem tour" entries={TOUR_DETAIL_GALLERY_ENTRIES} />,
    );
    const user = userEvent.setup();

    await user.press(view.getByText('Khách bấm tim khi chưa đăng nhập'));
    expect(view.getByText('Save tours you love')).toBeTruthy();
  });
});
