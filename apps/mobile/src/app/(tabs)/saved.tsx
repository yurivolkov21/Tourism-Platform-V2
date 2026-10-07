import { useInfiniteQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import { pruneRemovedIds } from '@/features/saved/removed-ids';
import { SavedScreen, type SavedStatus } from '@/features/saved/saved-screen';
import { flattenWishlistPages, nextWishlistPage } from '@/features/saved/wishlist-pages';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';
import { useWishlistSetMutation } from '@/lib/wishlist-mutation';

/**
 * Route Saved (S1–S3, mục 2 spec P5b-4). Chưa đăng nhập → `AuthGateScreen`
 * (S3), KHÔNG gọi `wishlist.list` (query tắt qua `enabled`). Bỏ lưu là thao
 * tác lạc quan — cùng khuôn D6/E1 (`tours/[slug].tsx`, `explore.tsx`): ẩn
 * NGAY khỏi danh sách, hỏng thì hiện lại + báo lỗi ngắn.
 */
export default function SavedRoute() {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
  const [wishlistError, setWishlistError] = useState<string | null>(null);

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);

  const { saved } = messages.mobile;

  // L5: contract kẹp `pageSize` ở 100 nên phải tải nhiều trang — xin trang 1
  // rồi effect bên dưới tự kéo nốt, để danh sách và bộ đếm phủ ĐỦ wishlist.
  const listQuery = useInfiniteQuery(
    orpc.wishlist.list.infiniteOptions({
      input: (page: number) => ({ page, pageSize: 100 }),
      initialPageParam: 1,
      getNextPageParam: nextWishlistPage,
      context: withMobileAuth(),
      enabled: signedIn,
    }),
  );
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = listQuery;
  // Không lật trang tiếp khi trang trước vừa hỏng — không thì effect gọi lại
  // ngay, thành vòng lặp request. Khách bấm Retry (refetch) là thử lại.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  const serverItems = useMemo(() => flattenWishlistPages(listQuery.data?.pages), [listQuery.data]);
  // Đăng xuất giữa chừng: đừng để danh sách cũ đứng nguyên khi quay lại S3.
  useEffect(() => {
    if (!signedIn) setRemovedIds(new Set());
  }, [signedIn]);
  // F4: mỗi lần list mới về, bỏ khỏi tập ẩn những id server đã xác nhận vắng —
  // không thì lưu lại tour đó ở chỗ khác vẫn bị ẩn ở đây.
  // Chỉ dọn khi đã tải HẾT trang: id nằm ở trang chưa về không có nghĩa là
  // server đã bỏ nó.
  const allPagesLoaded = listQuery.data !== undefined && !hasNextPage;
  useEffect(() => {
    if (allPagesLoaded) {
      setRemovedIds((current) => pruneRemovedIds(current, serverItems));
    }
  }, [allPagesLoaded, serverItems]);
  useEffect(() => {
    if (wishlistError === null) return;
    const id = setTimeout(() => setWishlistError(null), 3000);
    return () => clearTimeout(id);
  }, [wishlistError]);

  // N1: rollback + invalidate nằm trong hook dùng chung, chạy cho TỪNG lượt —
  // gỡ A rồi B nhanh mà A hỏng thì A vẫn hiện lại. Hook invalidate cả
  // `wishlist.check` vì Explore/tour detail mount sẵn song song đọc query riêng.
  const setWishlistMutation = useWishlistSetMutation(({ tourId }) => {
    setRemovedIds((current) => {
      const next = new Set(current);
      next.delete(tourId);
      return next;
    });
    setWishlistError(messages.wishlist.error);
  });

  function handleRemovePress(tourId: string) {
    // Lạc quan (S1): ẩn khỏi danh sách ngay, hỏng thì hiện lại + báo lỗi ngắn.
    setRemovedIds((current) => new Set(current).add(tourId));
    setWishlistMutation.mutate({ tourId, wished: false });
  }

  function recordReturn() {
    setPendingReturn({ path: '/(tabs)/saved' });
  }

  const status: SavedStatus = !signedIn
    ? 'content'
    : listQuery.isPending
      ? 'loading'
      : listQuery.isError
        ? 'error'
        : 'content';

  const items = serverItems
    .filter((item) => !removedIds.has(item.tourId))
    .map((item) => ({
      tourId: item.tourId,
      slug: item.slug,
      imageUrl: item.cover?.url ?? null,
      title: item.title,
      // Cùng khuôn ExploreScreen ("Hội An · 1 day") — `destinationName` null
      // (tour chưa gắn địa danh, không nên xảy ra ở dữ liệu thật) rơi về chỉ
      // số ngày, không in dấu `·` treo.
      locationLabel:
        item.destinationName === null
          ? messages.mobile.home.durationDays(item.durationDays)
          : `${item.destinationName} · ${messages.mobile.home.durationDays(item.durationDays)}`,
      priceLabel: formatMoney(item.basePrice, item.currency),
      rating: item.ratingAvg,
      unavailable: item.unavailable,
    }));

  if (!signedIn) {
    return (
      <AuthGateScreen
        pageTitle={saved.title}
        icon="heart"
        title={messages.mobile.authPrompts.savedGateTitle}
        body={messages.mobile.authPrompts.savedGateBody}
        signInLabel={messages.mobile.authPrompts.signIn}
        createAccountLabel={messages.mobile.authPrompts.createAccount}
        onSignIn={() => {
          recordReturn();
          router.navigate('/login');
        }}
        onCreateAccount={() => {
          recordReturn();
          router.navigate('/register');
        }}
      />
    );
  }

  return (
    <SavedScreen
      status={status}
      title={saved.title}
      items={items}
      onTourPress={(slug) => router.navigate(`/tours/${slug}`)}
      onRemovePress={handleRemovePress}
      removeLabel={saved.removeLabel}
      unavailableLabel={saved.unavailable}
      fromLabel={messages.mobile.home.from}
      errorTitle={saved.error}
      retryLabel={saved.retry}
      onRetry={() => void listQuery.refetch()}
      countLabel={status === 'content' && items.length > 0 ? saved.count(items.length) : null}
      emptyTitle={saved.empty}
      browseLabel={saved.browse}
      onBrowse={() => router.navigate('/explore')}
      wishlistErrorLabel={wishlistError}
      transformUrl={cloudinaryUrl}
    />
  );
}
