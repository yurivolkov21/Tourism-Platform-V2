import { useCallback, useState } from 'react';

/**
 * Kéo xuống để làm mới: gọi song song mọi `refetch` của màn, giữ vòng quay tới khi tất cả
 * xong. Dùng state riêng thay vì `isRefetching` của react-query — cờ đó cũng bật khi query
 * tự làm mới ngầm (focus, invalidate), làm vòng quay hiện lên dù khách không kéo.
 */
export function usePullToRefresh(refetches: readonly (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // `allSettled`: một nguồn lỗi không được giữ vòng quay mãi; màn tự hiện lỗi của query đó.
      await Promise.allSettled(refetches.map((refetch) => refetch()));
    } finally {
      setRefreshing(false);
    }
  }, [refetches]);

  return { refreshing, onRefresh };
}
