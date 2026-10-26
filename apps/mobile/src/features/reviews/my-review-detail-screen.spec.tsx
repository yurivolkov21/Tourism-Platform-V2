import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import {
  MyReviewDetailScreen,
  type MyReviewDetailScreenProps,
  type MyReviewDetailVM,
} from './my-review-detail-screen';

const copy = messages.reviews.mine;

function vm(over: Partial<MyReviewDetailVM> = {}): MyReviewDetailVM {
  return {
    moderationState: 'approved',
    dateIso: '2026-07-04T03:00:00.000Z',
    rating: 4,
    title: 'Loved the terraces',
    body: 'A light jacket, real shoes, and patience. The terraces reward all three.',
    tourTitle: 'Sa Pa Terraces & Homestay Trek 2D1N',
    tourImageUrl: null,
    moderationNote: null,
    photos: [],
    ...over,
  };
}

function props(over: Partial<MyReviewDetailScreenProps> = {}): MyReviewDetailScreenProps {
  return {
    copy,
    viewerCloseLabel: 'Close',
    viewerCounterFor: (i, n) => `${i} / ${n}`,
    review: vm(),
    nextStep: 'retract',
    onRetract: jest.fn(),
    onRewrite: jest.fn(),
    onWhy: jest.fn(),
    onOpenTour: jest.fn(),
    ...over,
  };
}

describe('MyReviewDetailScreen', () => {
  it('vẽ trạng thái, sao, tiêu đề, nội dung và tên tour', async () => {
    await renderWithTheme(<MyReviewDetailScreen {...props()} />);
    expect(screen.getByText(copy.publishedLabel)).toBeTruthy();
    expect(screen.getByLabelText(copy.ratingLabel(4))).toBeTruthy();
    expect(screen.getByText('Loved the terraces')).toBeTruthy();
    expect(screen.getByText(/real shoes, and patience/)).toBeTruthy();
    expect(screen.getByText('Sa Pa Terraces & Homestay Trek 2D1N')).toBeTruthy();
  });

  it('đã đăng: hàng Retract bấm được', async () => {
    const onRetract = jest.fn();
    await renderWithTheme(<MyReviewDetailScreen {...props({ onRetract })} />);
    await fireEvent.press(screen.getByText(copy.retractAction));
    expect(onRetract).toHaveBeenCalled();
  });

  it('bị bác còn lượt: hiện lý do và hàng sửa; hết lượt: hàng xem lý do', async () => {
    const onRewrite = jest.fn();
    await renderWithTheme(
      <MyReviewDetailScreen
        {...props({
          review: vm({
            moderationState: 'rejected',
            moderationNote: 'Please drop the phone number.',
          }),
          nextStep: 'rewrite',
          onRewrite,
        })}
      />,
    );
    expect(screen.getByText(copy.whyHeading)).toBeTruthy();
    expect(screen.getByText('Please drop the phone number.')).toBeTruthy();
    await fireEvent.press(screen.getByText(copy.seeWhy));
    expect(onRewrite).toHaveBeenCalled();
  });

  it('chờ duyệt (nextStep none): không có hàng hành động, không có khối lý do', async () => {
    await renderWithTheme(
      <MyReviewDetailScreen
        {...props({ review: vm({ moderationState: 'pending' }), nextStep: 'none' })}
      />,
    );
    expect(screen.queryByText(copy.retractAction)).toBeNull();
    expect(screen.queryByText(copy.whyHeading)).toBeNull();
  });

  // Cùng luật `formatFullDate` của danh sách: ngày lịch Việt Nam. Cắt `slice(0, 10)` là lấy ngày
  // UTC — bài gửi lúc 03:30 sáng 20/10 giờ VN (20:30 UTC ngày 19) từng hiện "19 Oct".
  it('ngày gửi in theo lịch Việt Nam, không theo ngày UTC', async () => {
    await renderWithTheme(
      <MyReviewDetailScreen {...props({ review: vm({ dateIso: '2026-10-19T20:30:00.000Z' }) })} />,
    );
    expect(screen.getByText('20 Oct 2026')).toBeTruthy();
    expect(screen.queryByText('19 Oct 2026')).toBeNull();
  });

  it('bấm khối tour gọi onOpenTour', async () => {
    const onOpenTour = jest.fn();
    await renderWithTheme(<MyReviewDetailScreen {...props({ onOpenTour })} />);
    await fireEvent.press(screen.getByLabelText('Sa Pa Terraces & Homestay Trek 2D1N'));
    expect(onOpenTour).toHaveBeenCalled();
  });
});
