import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  type PostListItemVM,
  PostsListScreen,
  type PostsListStatus,
} from '@/features/posts/posts-list-screen';
import { formatReviewDate } from '@/features/tour-detail/reviews';
import { orpc } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/**
 * Route G1/G2 (spec P5b-4 §6) — "Travel stories", KHÔNG cần đăng nhập.
 * `search`/`tag` đi thẳng qua `posts.list` (API), KHÔNG lọc ở máy — danh sách
 * có phân trang nên lọc ở máy chỉ thấy trang đang tải (đúng bài học đã ghi
 * ở vòng thiết kế `/blog` của web).
 */
export default function PostsListRoute() {
  const { posts } = messages.mobile;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PostListItemVM[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  // Debounce 300ms sau nhịp gõ cuối (spec §"ô tìm debounce 300ms qua API").
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Đổi tag/search → về trang 1, KHÔNG cộng dồn kết quả cũ. Thân effect không
  // ĐỌC hai biến này — chúng chỉ là TRIGGER (reset-on-change), biome đọc nhầm
  // thành "dư dependency".
  // biome-ignore lint/correctness/useExhaustiveDependencies: xem giải thích trên.
  useEffect(() => {
    setPage(1);
  }, [search, selectedTag]);

  const listQuery = useQuery(
    orpc.posts.list.queryOptions({
      input: {
        page,
        sort: 'publishedAt',
        order: 'desc',
        ...(selectedTag === null ? {} : { tag: selectedTag }),
        ...(search === '' ? {} : { search }),
      },
    }),
  );
  const tagsQuery = useQuery(orpc.posts.tags.queryOptions());

  useEffect(() => {
    if (listQuery.data === undefined) return;
    const data = listQuery.data;
    const vms: PostListItemVM[] = data.items.map((item) => ({
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt,
      coverUrl: item.cover?.url ?? null,
      dateLabel: formatReviewDate(item.publishedAt),
      tagLabels: item.tags.slice(0, 2).map((t) => t.name),
    }));
    setItems((prev) => (page === 1 ? vms : [...prev, ...vms]));
    setTotalPages(data.totalPages);
  }, [listQuery.data, page]);

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
      hasMore={page < totalPages}
      loadMoreLabel={posts.loadMore}
      onLoadMore={() => setPage((p) => p + 1)}
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
