import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  type PostListItemVM,
  PostsListScreen,
  type PostsListStatus,
} from '@/features/posts/posts-list-screen';
import { formatReviewDate } from '@/features/tour-detail/reviews';
import { orpc } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/** Trang kế cần tải, `undefined` khi đã hết (quy ước `getNextPageParam`). */
function nextPostsPage(last: { page: number; totalPages: number }): number | undefined {
  return last.page < last.totalPages ? last.page + 1 : undefined;
}

/**
 * Route G1/G2 (spec P5b-4 §6) — "Travel stories", KHÔNG cần đăng nhập.
 * `search`/`tag` đi thẳng qua `posts.list` (API), KHÔNG lọc ở máy — danh sách
 * có phân trang nên lọc ở máy chỉ thấy trang đang tải (đúng bài học đã ghi
 * ở vòng thiết kế `/blog` của web).
 *
 * N4/N5 (rà 07/10): trước đây route tự giữ `page` + tự nối `items` qua effect.
 * Bấm đúp Load more nhảy 1 → 3 (trang 2 về cache nhưng không bao giờ được nối),
 * và đổi tag/search vẫn hiện bài bộ lọc cũ. `useInfiniteQuery` đưa bộ lọc vào
 * query key: đổi lọc là sang cache khác (về `isPending` → khung chờ), các trang
 * luôn thuộc ĐÚNG bộ lọc hiện tại, và `isFetchingNextPage` khoá nút Load more.
 */
export default function PostsListRoute() {
  const { posts } = messages.mobile;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Debounce 300ms sau nhịp gõ cuối (spec §"ô tìm debounce 300ms qua API").
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const listQuery = useInfiniteQuery(
    orpc.posts.list.infiniteOptions({
      input: (page: number) => ({
        page,
        sort: 'publishedAt',
        order: 'desc',
        ...(selectedTag === null ? {} : { tag: selectedTag }),
        ...(search === '' ? {} : { search }),
      }),
      initialPageParam: 1,
      getNextPageParam: nextPostsPage,
    }),
  );
  const tagsQuery = useQuery(orpc.posts.tags.queryOptions());

  const items = useMemo<PostListItemVM[]>(
    () =>
      (listQuery.data?.pages ?? []).flatMap((data) =>
        data.items.map((item) => ({
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt,
          coverUrl: item.cover?.url ?? null,
          dateLabel: formatReviewDate(item.publishedAt),
          tagLabels: item.tags.slice(0, 2).map((t) => t.name),
        })),
      ),
    [listQuery.data],
  );

  const status: PostsListStatus = listQuery.isPending
    ? 'loading'
    : listQuery.isError
      ? 'error'
      : 'content';

  return (
    <PostsListScreen
      status={status}
      searchValue={searchInput}
      searchPlaceholder={posts.searchPlaceholder}
      clearSearchLabel={posts.clearSearch}
      onChangeSearch={setSearchInput}
      selectedTag={selectedTag}
      allTagLabel={posts.allTag}
      // `posts.tags` toàn cục, KHÔNG in `count` (toàn cục, sai ngay sau khi lọc).
      tags={(tagsQuery.data ?? []).map((tag) => ({ slug: tag.slug, name: tag.name }))}
      onSelectTag={setSelectedTag}
      items={items}
      onPostPress={(slug) => router.push(`/posts/${slug}`)}
      hasMore={listQuery.hasNextPage}
      loadingMore={listQuery.isFetchingNextPage}
      loadMoreLabel={posts.loadMore}
      onLoadMore={() => {
        // Chặn thêm một lớp ngoài nút đã khoá: TanStack mặc định HUỶ lượt đang
        // tải để bắt đầu lượt mới khi gọi chồng.
        if (!listQuery.isFetchingNextPage) void listQuery.fetchNextPage();
      }}
      errorTitle={posts.error}
      retryLabel={posts.retry}
      onRetry={() => void listQuery.refetch()}
      emptyTitle={posts.emptyTitle}
      emptySearchTitle={posts.emptySearchTitle(search)}
      emptySearchBody={posts.emptySearchBody}
      onClearSearch={() => setSearchInput('')}
      transformUrl={cloudinaryUrl}
    />
  );
}
