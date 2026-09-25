import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import { SavedScreen, type SavedStatus } from '@/features/saved/saved-screen';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';

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
  const queryClient = useQueryClient();

  const { saved } = messages.mobile;

  const listQuery = useQuery(
    orpc.wishlist.list.queryOptions({
      input: { page: 1, pageSize: 100 },
      context: withMobileAuth(),
      enabled: signedIn,
    }),
  );
  // Đăng xuất giữa chừng: đừng để danh sách cũ đứng nguyên khi quay lại S3.
  useEffect(() => {
    if (!signedIn) setRemovedIds(new Set());
  }, [signedIn]);
  useEffect(() => {
    if (wishlistError === null) return;
    const id = setTimeout(() => setWishlistError(null), 3000);
    return () => clearTimeout(id);
  }, [wishlistError]);

  const setWishlistMutation = useMutation(
    orpc.wishlist.set.mutationOptions({ context: withMobileAuth() }),
  );

  function handleRemovePress(tourId: string) {
    // Lạc quan (S1): ẩn khỏi danh sách ngay, hỏng thì hiện lại + báo lỗi ngắn.
    setRemovedIds((current) => new Set(current).add(tourId));
    setWishlistMutation.mutate(
      { tourId, wished: false },
      {
        onError: () => {
          setRemovedIds((current) => {
            const next = new Set(current);
            next.delete(tourId);
            return next;
          });
          setWishlistError(messages.wishlist.error);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.wishlist.list.key() }),
      },
    );
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

  const items = (listQuery.data?.items ?? [])
    .filter((item) => !removedIds.has(item.tourId))
    .map((item) => ({
      tourId: item.tourId,
      slug: item.slug,
      imageUrl: item.cover?.url ?? null,
      title: item.title,
      durationLabel: messages.mobile.home.durationDays(item.durationDays),
      priceLabel: formatMoney(item.basePrice, item.currency),
      rating: item.ratingAvg,
      unavailable: item.unavailable,
    }));

  if (!signedIn) {
    return (
      <AuthGateScreen
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
      emptyTitle={saved.empty}
      browseLabel={saved.browse}
      onBrowse={() => router.navigate('/explore')}
      wishlistErrorLabel={wishlistError}
      transformUrl={cloudinaryUrl}
    />
  );
}
