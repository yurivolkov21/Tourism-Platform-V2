import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import {
  type PostListItemVM,
  PostsListScreen,
  type PostsListScreenProps,
} from './posts-list-screen';

function item(overrides: Partial<PostListItemVM> = {}): PostListItemVM {
  return {
    slug: 'eating-your-way-through-hoi-an',
    title: 'Eating your way through Hoi An',
    excerpt: 'Cao lầu, white rose dumplings and the bánh mì queue worth joining.',
    coverUrl: 'https://res.cloudinary.com/demo/image/upload/hoi-an/hero',
    dateLabel: '24 Jul 2026',
    tagLabels: ['Food'],
    ...overrides,
  };
}

function baseProps(overrides: Partial<PostsListScreenProps> = {}): PostsListScreenProps {
  return {
    status: 'content',
    searchValue: '',
    searchPlaceholder: 'Search stories',
    clearSearchLabel: 'Clear search',
    onChangeSearch: jest.fn(),
    selectedTag: null,
    allTagLabel: 'All',
    tags: [
      { slug: 'food', name: 'Food' },
      { slug: 'nature', name: 'Nature' },
    ],
    onSelectTag: jest.fn(),
    items: [item()],
    onPostPress: jest.fn(),
    hasMore: false,
    loadingMore: false,
    loadMoreLabel: 'Load more',
    onLoadMore: jest.fn(),
    errorTitle: "Couldn't load stories.",
    retryLabel: 'Try again',
    onRetry: jest.fn(),
    emptyTitle: 'No stories yet.',
    emptySearchTitle: 'No stories match "sapa"',
    emptySearchBody: 'Try a shorter word, or browse by topic instead.',
    onClearSearch: jest.fn(),
    ...overrides,
  };
}

describe('PostsListScreen', () => {
  it('G1 — bài đầu vẽ thẻ lớn (tiêu đề + excerpt), bấm gọi onPostPress', async () => {
    const onPostPress = jest.fn();
    await renderWithTheme(<PostsListScreen {...baseProps({ onPostPress })} />);
    expect(screen.getByText('Eating your way through Hoi An')).toBeTruthy();
    expect(
      screen.getByText('Cao lầu, white rose dumplings and the bánh mì queue worth joining.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Eating your way through Hoi An'));
    expect(onPostPress).toHaveBeenCalledWith('eating-your-way-through-hoi-an');
  });

  it('bấm chip tag gọi onSelectTag', async () => {
    const onSelectTag = jest.fn();
    await renderWithTheme(<PostsListScreen {...baseProps({ onSelectTag })} />);
    await fireEvent.press(screen.getByText('Nature'));
    expect(onSelectTag).toHaveBeenCalledWith('nature');
  });

  it('gõ ô tìm gọi onChangeSearch', async () => {
    const onChangeSearch = jest.fn();
    await renderWithTheme(<PostsListScreen {...baseProps({ onChangeSearch })} />);
    fireEvent.changeText(screen.getByPlaceholderText('Search stories'), 'sapa');
    expect(onChangeSearch).toHaveBeenCalledWith('sapa');
  });

  it('G2 — tìm rỗng hiện đúng câu nhắc chuỗi đã gõ + nút Clear search', async () => {
    const onClearSearch = jest.fn();
    await renderWithTheme(
      <PostsListScreen {...baseProps({ items: [], searchValue: 'sapa', onClearSearch })} />,
    );
    expect(screen.getByText('No stories match "sapa"')).toBeTruthy();
    await fireEvent.press(screen.getByText('Clear search'));
    expect(onClearSearch).toHaveBeenCalled();
  });

  it('status="error" hiện errorTitle + nút retry', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(<PostsListScreen {...baseProps({ status: 'error', onRetry })} />);
    expect(screen.getByText("Couldn't load stories.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('hasMore=true hiện nút Load more, bấm gọi onLoadMore', async () => {
    const onLoadMore = jest.fn();
    await renderWithTheme(<PostsListScreen {...baseProps({ hasMore: true, onLoadMore })} />);
    await fireEvent.press(screen.getByText('Load more'));
    expect(onLoadMore).toHaveBeenCalled();
  });

  // N4 (rà 07/10): bấm đúp khi trang kế đang tải từng nhảy trang 1 → 3.
  it('đang tải trang kế thì nút Load more bị khoá, bấm không gọi onLoadMore', async () => {
    const onLoadMore = jest.fn();
    await renderWithTheme(
      <PostsListScreen {...baseProps({ hasMore: true, loadingMore: true, onLoadMore })} />,
    );
    const button = screen.getByRole('button', { name: 'Load more' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  // N5 (rà 07/10): đổi tag/search từng giữ nguyên bài của bộ lọc cũ đến khi data về.
  it('status="loading" vẽ khung chờ, không vẽ bài nào', async () => {
    await renderWithTheme(<PostsListScreen {...baseProps({ status: 'loading' })} />);
    expect(screen.getByTestId('posts-loading')).toBeTruthy();
    expect(screen.queryByText('Eating your way through Hoi An')).toBeNull();
  });

  it('bài thứ hai trở đi vẽ hàng gọn (không excerpt lớn)', async () => {
    await renderWithTheme(
      <PostsListScreen
        {...baseProps({
          items: [
            item({ slug: 'a', title: 'Post A' }),
            item({ slug: 'b', title: 'Post B', excerpt: null }),
          ],
        })}
      />,
    );
    expect(screen.getByText('Post A')).toBeTruthy();
    expect(screen.getByText('Post B')).toBeTruthy();
  });
});
