import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '@/test-utils';
import { type MyReviewCardVM, MyReviewsScreen } from './my-reviews-screen';

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

async function renderList(items: MyReviewCardVM[]) {
  const handlers = { onRetract: jest.fn(), onRewrite: jest.fn(), onWhy: jest.fn() };
  await renderWithTheme(<MyReviewsScreen copy={copy} items={items} {...handlers} />);
  return handlers;
}

describe('MyReviewsScreen (R4)', () => {
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

  // G47 (ADR-0019 AMEND 4): chữ 12dp trên lớp tô success 16% — mực `success` trần chỉ 2,83:1 ở
  // theme sáng, nên pill "Published" dùng token vai mực.
  it.each(['light', 'dark'] as const)(
    'pill đã đăng tô mực success-emphasis (theme %s)',
    async (scheme) => {
      await renderWithTheme(
        <MyReviewsScreen
          copy={copy}
          items={[card({ id: 'a', moderationState: 'approved' })]}
          onRetract={jest.fn()}
          onRewrite={jest.fn()}
          onWhy={jest.fn()}
        />,
        scheme,
      );

      expect(StyleSheet.flatten(screen.getByText(copy.publishedLabel).props.style).color).toBe(
        themeFor(scheme).colors['success-emphasis'],
      );
    },
  );
});
