import { useQuery, useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { exploreEntryParams } from '@/features/explore/explore-entry';
import { prefetchExplore } from '@/features/explore/explore-prefetch';
import {
  groupDestinationsByRegion,
  HOME_REGIONS,
} from '@/features/home/group-destinations-by-region';
import { HomeScreen, type HomeStatus } from '@/features/home/home-screen';
import { useNotifications } from '@/features/notifications/use-notifications';
import { orpc } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { withReplayOnFocus } from '@/lib/replay-on-focus';

/**
 * Route Home: gọi `catalog.destinations.list`, giữ vùng đang chọn, suy trạng
 * thái tải/lỗi/rỗng — `HomeScreen` chỉ nhận props mà vẽ (ADR-0055 §2).
 */
function HomeRoute() {
  const [selectedRegion, setSelectedRegion] = useState<string>(HOME_REGIONS[0]);
  const query = useQuery(orpc.catalog.destinations.list.queryOptions());
  const queryClient = useQueryClient();
  // Home xong thì tải sẵn Explore ở nền: người dùng mở tab Explore là có thẻ ngay.
  useEffect(() => {
    prefetchExplore(queryClient);
  }, [queryClient]);
  const { regionShort, guestName } = messages.mobile.home;
  const { data: session } = getAuthClient().useSession();
  const notifications = useNotifications();

  const groups = groupDestinationsByRegion(query.data ?? []);
  const selectedGroup = groups.find((g) => g.region === selectedRegion);

  const status: HomeStatus = query.isPending ? 'loading' : query.isError ? 'error' : 'content';

  return (
    <HomeScreen
      status={status}
      regions={HOME_REGIONS.map((region) => ({
        key: region,
        // Nhãn hiển thị rút gọn ("North") cho chữ xoay dọc còn đọc được; trình
        // đọc màn hình vẫn nghe tên vùng ĐẦY ĐỦ.
        label: regionShort[region] ?? region,
        accessibilityLabel: region,
      }))}
      selectedRegion={selectedRegion}
      onSelectRegion={setSelectedRegion}
      destinations={selectedGroup?.destinations ?? []}
      onRetry={() => void query.refetch()}
      onSearchPress={() => router.navigate('/explore')}
      onAvatarPress={() => router.navigate('/account')}
      // F5 — luôn gửi `destination` tường minh kèm nonce `nav` mới: "See all"
      // phải bỏ lọc cũ, bấm lại cùng điểm đến phải áp lại (`explore-entry.ts`).
      onDestinationPress={(slug) => {
        prefetchExplore(queryClient, slug);
        router.navigate({
          pathname: '/explore',
          params: exploreEntryParams(slug, String(Date.now())),
        });
      }}
      onSeeAllTours={() =>
        router.navigate({
          pathname: '/explore',
          params: exploreEntryParams(null, String(Date.now())),
        })
      }
      userName={session?.user.name ?? guestName}
      avatarUrl={session?.user.image ?? null}
      transformUrl={cloudinaryUrl}
      notifications={
        notifications.signedIn
          ? {
              unreadCount: notifications.unreadCount,
              label: messages.mobile.notifications.bellLabel(notifications.unreadCount),
              onPress: () => router.push('/notifications'),
            }
          : undefined
      }
    />
  );
}

export default withReplayOnFocus(HomeRoute);
