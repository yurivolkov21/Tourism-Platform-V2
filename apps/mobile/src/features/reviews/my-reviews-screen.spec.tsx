import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '@/test-utils';
import {
  type AwaitingReviewTripVM,
  type MyReviewCardVM,
  MyReviewsScreen,
} from './my-reviews-screen';

const copy = messages.reviews.mine;

function card(over: Partial<MyReviewCardVM> & Pick<MyReviewCardVM, 'id'>): MyReviewCardVM {
  return {
    title: null,
    tourTitle: 'Sa Pa Terraces & Homestay Trek 2D1N',
    moderationState: 'pending',
    rejectionCount: 0,
    dateIso: '2026-07-04T03:00:00.000Z',
    ...over,
  };
}

const AWAITING: AwaitingReviewTripVM[] = [
  {
    code: 'BK-HALONG01',
    tourTitle: 'Ha Long Bay Overnight Cruise',
    dateRangeLabel: '8 – 10 Jan 2026',
    imageUrl: null,
  },
];

async function renderList(items: MyReviewCardVM[], awaiting: AwaitingReviewTripVM[] = []) {
  const handlers = {
    onRetract: jest.fn(),
    onRewrite: jest.fn(),
    onWhy: jest.fn(),
    onWriteReview: jest.fn(),
  };
  await renderWithTheme(
    <MyReviewsScreen copy={copy} items={items} awaiting={awaiting} {...handlers} />,
  );
  return handlers;
}

describe('MyReviewsScreen (R4)', () => {
  // Ngày của bài là ngày lịch Việt Nam (ADR-0041 §7): cắt 10 ký tự đầu của
  // mốc thời gian là lấy ngày UTC, bài viết lúc 06:00 giờ Việt Nam lùi một ngày.
  it('bài viết lúc 06:00 giờ Việt Nam mang đúng ngày Việt Nam', async () => {
    await renderList([card({ id: 'p', dateIso: '2026-07-04T23:00:00.000Z' })]);

    expect(screen.getByText('5 Jul 2026')).toBeTruthy();
  });

  it('chờ duyệt và đã rút: có pill trạng thái, không có nút nào', async () => {
    await renderList([
      card({ id: 'p', moderationState: 'pending' }),
      card({ id: 'x', moderationState: 'retracted' }),
    ]);

    expect(screen.getByText(copy.pendingLabel)).toBeTruthy();
    expect(screen.getByText(copy.retractedLabel)).toBeTruthy();
    expect(screen.queryByText(copy.retractAction)).toBeNull();
    expect(screen.queryByText(copy.seeWhy)).toBeNull();
    expect(screen.queryByText(copy.seeWhyFinal)).toBeNull();
  });

  it('đã đăng → rút (R7); bị bác còn lượt → viết lại (R5)', async () => {
    const handlers = await renderList([
      card({ id: 'a', moderationState: 'approved' }),
      card({ id: 'r', moderationState: 'rejected', rejectionCount: 1 }),
    ]);

    await fireEvent.press(screen.getByText(copy.retractAction));
    expect(handlers.onRetract).toHaveBeenCalledWith('a');
    await fireEvent.press(screen.getByText(copy.seeWhy));
    expect(handlers.onRewrite).toHaveBeenCalledWith('r');
  });

  // Mockup R6: hết lượt thì nút sửa biến mất — nhãn không được hứa "rewrite".
  it('bị bác hai lần → chỉ "See why" mở R6, không có lời mời viết lại', async () => {
    const handlers = await renderList([
      card({ id: 'e', moderationState: 'rejected', rejectionCount: 2 }),
    ]);

    expect(screen.queryByText(copy.seeWhy)).toBeNull();
    await fireEvent.press(screen.getByText(copy.seeWhyFinal));
    expect(handlers.onWhy).toHaveBeenCalledWith('e');
    expect(handlers.onRewrite).not.toHaveBeenCalled();
  });

  it('chưa có bài nào: câu trống', async () => {
    await renderList([]);

    expect(screen.getByText(copy.empty)).toBeTruthy();
  });

  // Card "Thêm khối" (15/10): lối thứ ba vào R1 (open-items P5b-5 mục 1).
  it('chuyến đã về chưa có bài: khối đầu màn, mỗi chuyến một nút viết bài gọi đúng mã đơn', async () => {
    const handlers = await renderList([card({ id: 'p' })], AWAITING);

    expect(screen.getByText(copy.awaitingHeading)).toBeTruthy();
    expect(screen.getByText('Ha Long Bay Overnight Cruise')).toBeTruthy();
    expect(screen.getByText('8 – 10 Jan 2026')).toBeTruthy();
    // Có khối chờ viết thì danh sách bài cũng có tiêu đề riêng, không lẫn hai loại thẻ.
    expect(screen.getByText(copy.writtenHeading)).toBeTruthy();

    // Nhiều thẻ cùng chữ "Write a review": trình đọc màn hình nghe kèm tên tour.
    await fireEvent.press(
      screen.getByRole('button', { name: copy.writeReviewFor('Ha Long Bay Overnight Cruise') }),
    );
    expect(handlers.onWriteReview).toHaveBeenCalledWith('BK-HALONG01');
  });

  it('không có chuyến chờ viết: không tiêu đề khối nào, màn giữ như cũ', async () => {
    await renderList([card({ id: 'p' })]);

    expect(screen.queryByText(copy.awaitingHeading)).toBeNull();
    expect(screen.queryByText(copy.writtenHeading)).toBeNull();
  });

  it('có chuyến chờ viết mà chưa có bài nào: khối mời viết rồi câu trống, không tiêu đề danh sách', async () => {
    await renderList([], AWAITING);

    expect(screen.getByText(copy.awaitingHeading)).toBeTruthy();
    expect(screen.getByText(copy.empty)).toBeTruthy();
    expect(screen.queryByText(copy.writtenHeading)).toBeNull();
  });

  // G47 (ADR-0019 AMEND 4): chữ 12dp trên lớp tô success 16% — mực `success` trần chỉ 2,83:1 ở
  // theme sáng, nên pill "Published" dùng token vai mực.
  it.each(['light', 'dark'] as const)(
    'pill đã đăng tô mực success-emphasis (theme %s)',
    async (scheme) => {
      await renderWithTheme(
        <MyReviewsScreen
          copy={copy}
          items={[card({ id: 'a', moderationState: 'approved' })]}
          awaiting={[]}
          onRetract={jest.fn()}
          onRewrite={jest.fn()}
          onWhy={jest.fn()}
          onWriteReview={jest.fn()}
        />,
        scheme,
      );

      expect(StyleSheet.flatten(screen.getByText(copy.publishedLabel).props.style).color).toBe(
        themeFor(scheme).colors['success-emphasis'],
      );
    },
  );
});
