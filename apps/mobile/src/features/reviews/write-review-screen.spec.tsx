import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { WriteReviewScreen, type WriteReviewScreenProps } from './write-review-screen';

const copy = messages.reviews;

function baseProps(overrides: Partial<WriteReviewScreenProps> = {}): WriteReviewScreenProps {
  return {
    copy,
    phase: 'form',
    bookingCode: 'BK-4QP8ZT2M',
    tourTitle: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
    imageUrl: null,
    dateRangeLabel: 'Sat 3 – Tue 6 Oct 2026',
    rating: null,
    onRatingChange: jest.fn(),
    title: '',
    onTitleChange: jest.fn(),
    body: '',
    onBodyChange: jest.fn(),
    canSubmit: false,
    submitting: false,
    errorMessage: null,
    onSubmit: jest.fn(),
    onBack: jest.fn(),
    photos: [],
    maxPhotos: 5,
    photoError: null,
    sheetOpen: false,
    sheetBusy: false,
    sheetError: null,
    onOpenSheet: jest.fn(),
    onCloseSheet: jest.fn(),
    onTakePhoto: jest.fn(),
    onChooseLibrary: jest.fn(),
    onRetryPhoto: jest.fn(),
    onRemovePhoto: jest.fn(),
    ...overrides,
  };
}

describe('WriteReviewScreen — màn đã gửi (R3)', () => {
  it('mở từ chuyến (R1): "Back to my trip" và link "See my reviews"', async () => {
    const onBack = jest.fn();
    const onSeeReviews = jest.fn();
    await renderWithTheme(
      <WriteReviewScreen {...baseProps({ phase: 'submitted', onBack, onSeeReviews })} />,
    );

    expect(screen.getByText(copy.successTitle)).toBeTruthy();
    await fireEvent.press(screen.getByText(copy.backToTrip));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText(copy.seeMyReviews));
    expect(onSeeReviews).toHaveBeenCalledTimes(1);
  });

  // R5 mở từ My reviews: nút chính nói đúng chỗ về, và không có link đẩy thêm một R4 thứ hai.
  it('gửi lại từ R5: nút "Back to my reviews", không có link "See my reviews"', async () => {
    const onBack = jest.fn();
    await renderWithTheme(
      <WriteReviewScreen
        {...baseProps({ phase: 'submitted', onBack, backLabel: copy.backToReviews })}
      />,
    );

    expect(screen.queryByText(copy.backToTrip)).toBeNull();
    expect(screen.queryByText(copy.seeMyReviews)).toBeNull();
    await fireEvent.press(screen.getByText(copy.backToReviews));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
