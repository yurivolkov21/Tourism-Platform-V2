import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { SavedScreen, type SavedScreenProps } from './saved-screen';

function baseProps(overrides: Partial<SavedScreenProps> = {}): SavedScreenProps {
  return {
    status: 'content',
    title: 'Saved tours',
    items: [
      {
        tourId: 'tour-1',
        slug: 'hoi-an-lantern-evening',
        imageUrl: null,
        title: 'Hội An Old Town & Lantern Evening',
        locationLabel: 'Hội An · 1 day',
        priceLabel: '$39',
        rating: 4.8,
        unavailable: false,
      },
      {
        tourId: 'tour-2',
        slug: 'mai-chau-cycling-2d',
        imageUrl: null,
        title: 'Mai Châu Valley Cycling 2D1N',
        locationLabel: 'Mai Châu · 2 days',
        priceLabel: '$99',
        rating: 4.5,
        unavailable: true,
      },
    ],
    onTourPress: jest.fn(),
    onRemovePress: jest.fn(),
    removeLabel: 'Remove from saved',
    unavailableLabel: 'No longer available',
    fromLabel: 'From',
    errorTitle: "Couldn't load your saved tours.",
    retryLabel: 'Try again',
    onRetry: jest.fn(),
    countLabel: '2 tours',
    emptyTitle: 'Nothing saved yet — tap the heart on any tour.',
    browseLabel: 'Browse tours',
    onBrowse: jest.fn(),
    ...overrides,
  };
}

describe('SavedScreen', () => {
  it('trạng thái loading: vẽ khung xám, không vẽ danh sách', async () => {
    await renderWithTheme(<SavedScreen {...baseProps({ status: 'loading' })} />);
    expect(screen.queryByText('Hội An Old Town & Lantern Evening')).toBeNull();
  });

  it('trạng thái error: vẽ câu lỗi + nút thử lại, bấm gọi onRetry', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(<SavedScreen {...baseProps({ status: 'error', onRetry })} />);

    expect(screen.getByText("Couldn't load your saved tours.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('rỗng (S2): vẽ empty state kèm nút Browse tours, bấm gọi onBrowse', async () => {
    const onBrowse = jest.fn();
    await renderWithTheme(<SavedScreen {...baseProps({ items: [], onBrowse })} />);

    expect(screen.getByText('Nothing saved yet — tap the heart on any tour.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Browse tours'));
    expect(onBrowse).toHaveBeenCalled();
  });

  it('S1: vẽ hai thẻ, thẻ unavailable mang nhãn "No longer available"', async () => {
    await renderWithTheme(<SavedScreen {...baseProps()} />);

    expect(screen.getByText('Hội An Old Town & Lantern Evening')).toBeTruthy();
    expect(screen.getByText('Mai Châu Valley Cycling 2D1N')).toBeTruthy();
    expect(screen.getByText('No longer available')).toBeTruthy();
  });

  it('countLabel: vẽ dòng đếm dưới tiêu đề khi có; ẩn khi null (S2)', async () => {
    const { rerender } = await renderWithTheme(<SavedScreen {...baseProps()} />);
    expect(screen.getByText('2 tours')).toBeTruthy();

    await rerender(<SavedScreen {...baseProps({ items: [], countLabel: null })} />);
    expect(screen.queryByText('2 tours')).toBeNull();
  });

  it('bấm tim trên thẻ gọi onRemovePress đúng tourId', async () => {
    const onRemovePress = jest.fn();
    const [firstItem] = baseProps().items;
    await renderWithTheme(
      <SavedScreen {...baseProps({ items: firstItem ? [firstItem] : [], onRemovePress })} />,
    );

    await fireEvent.press(screen.getByLabelText('Remove from saved'));
    expect(onRemovePress).toHaveBeenCalledWith('tour-1');
  });

  it('bấm thẻ available gọi onTourPress; thẻ unavailable không bấm vào được', async () => {
    const onTourPress = jest.fn();
    await renderWithTheme(<SavedScreen {...baseProps({ onTourPress })} />);

    await fireEvent.press(screen.getByLabelText('Hội An Old Town & Lantern Evening'));
    expect(onTourPress).toHaveBeenCalledWith('hoi-an-lantern-evening');

    onTourPress.mockClear();
    await fireEvent.press(screen.getByLabelText('Mai Châu Valley Cycling 2D1N'));
    expect(onTourPress).not.toHaveBeenCalled();
  });

  it('có wishlistErrorLabel: vẽ băng lỗi ngắn trên đầu danh sách', async () => {
    await renderWithTheme(
      <SavedScreen {...baseProps({ wishlistErrorLabel: "Couldn't remove tour. Try again." })} />,
    );
    expect(screen.getByText("Couldn't remove tour. Try again.")).toBeTruthy();
  });
});
