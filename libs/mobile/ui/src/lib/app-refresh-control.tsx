import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useTheme } from './theme-provider';

export type AppRefreshControlProps = RefreshControlProps;

/**
 * Vòng quay kéo-để-làm-mới tô theo token (Android `colors`/nền, iOS `tintColor`) — truyền vào
 * `refreshControl` của `ScrollView`. Màn chỉ vẽ; route giữ `refreshing` và gọi refetch.
 *
 * PHẢI chuyển tiếp mọi prop (`{...props}`): trên Android, `ScrollView` `cloneElement` chính
 * phần tử này và nhét ScrollView vào làm `children` (kèm `style`). Bỏ rơi `children` là cả danh
 * sách biến mất — đo trên máy 20/10, Explore/Saved/Trips trắng trơn.
 */
export function AppRefreshControl(props: AppRefreshControlProps) {
  const theme = useTheme();

  return (
    <RefreshControl
      colors={[theme.colors['primary-emphasis']]}
      progressBackgroundColor={theme.colors.card}
      tintColor={theme.colors['primary-emphasis']}
      {...props}
    />
  );
}
