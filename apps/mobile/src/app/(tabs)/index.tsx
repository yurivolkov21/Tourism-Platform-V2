import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { exploreEntryParams } from '@/features/explore/explore-entry';
import {
  groupDestinationsByRegion,
  HOME_REGIONS,
} from '@/features/home/group-destinations-by-region';
import { HomeScreen, type HomeStatus } from '@/features/home/home-screen';
import { orpc } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/**
 * Route Home: gọi `catalog.destinations.list`, giữ vùng đang chọn, suy trạng
 * thái tải/lỗi/rỗng — `HomeScreen` chỉ nhận props mà vẽ (ADR-0055 §2).
 */
export default function HomeRoute() {
  const [selectedRegion, setSelectedRegion] = useState<string>(HOME_REGIONS[0]);
  const query = useQuery(orpc.catalog.destinations.list.queryOptions());
  const { regionShort, guestName } = messages.mobile.home;
  const { data: session } = getAuthClient().useSession();

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
      onDestinationPress={(slug) =>
        router.navigate({
          pathname: '/explore',
          params: exploreEntryParams(slug, String(Date.now())),
        })
      }
      onSeeAllTours={() =>
        router.navigate({
          pathname: '/explore',
          params: exploreEntryParams(null, String(Date.now())),
        })
      }
      userName={session?.user.name ?? guestName}
      avatarUrl={session?.user.image ?? null}
      transformUrl={cloudinaryUrl}
    />
  );
}
