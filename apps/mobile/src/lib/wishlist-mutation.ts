import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { orpc, withMobileAuth } from '@/lib/api/client';

export interface WishlistSetVariables {
  tourId: string;
  wished: boolean;
}

/**
 * Còn lượt `wishlist.set` nào đang bay không (ở BẤT KỲ màn nào — Saved,
 * Explore, tour detail dùng chung một mutation key).
 *
 * N6 (rà 07/10): màn đọc `wishlist.check` rồi ghi thẳng vào state tim lạc
 * quan. Lượt check về GIỮA hai lần bấm nhanh mang trạng thái của lần bấm
 * trước → tim nháy ngược. Màn gọi hàm này trong effect đọc check và bỏ qua
 * dữ liệu khi còn mutation — lượt cuối settle sẽ invalidate nên luôn có một
 * lượt check MỚI về sau đó để chốt trạng thái thật.
 */
export function isWishlistMutating(queryClient: QueryClient): boolean {
  return queryClient.isMutating({ mutationKey: orpc.wishlist.set.mutationKey() }) > 0;
}

/**
 * Mutation `wishlist.set` dùng chung cho mọi màn có tim (N1, rà 07/10).
 *
 * Trước đây mỗi màn truyền `onError`/`onSettled` vào `mutate()`. TanStack v5
 * chỉ chạy callback của `mutate()` cho lượt gọi MỚI NHẤT của observer (và bỏ
 * hẳn khi màn đã unmount) — bấm tim A rồi B thật nhanh mà A hỏng thì không
 * rollback, không báo lỗi; bấm tim rồi back ngay thì không invalidate. Ở đây
 * callback nằm trong OPTIONS của mutation nên chạy cho từng lượt, kể cả sau
 * unmount.
 *
 * `onFailed` nhận đúng biến của lượt hỏng để màn tự trả state lạc quan về
 * `!wished`. Invalidate `wishlist.list` + `wishlist.check` chỉ ở lượt settle
 * CUỐI (lúc chạy `onSettled`, lượt hiện tại vẫn được đếm là đang bay nên
 * ngưỡng là ≤ 1) — invalidate sớm hơn là kéo về trạng thái giữa chừng (N6).
 */
export function useWishlistSetMutation(onFailed: (variables: WishlistSetVariables) => void) {
  const queryClient = useQueryClient();
  // Ref giữ callback MỚI NHẤT — callback trong options đóng băng theo lần
  // render tạo ra lượt mutation, mà màn có thể đã render lại với state mới.
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  return useMutation(
    orpc.wishlist.set.mutationOptions({
      context: withMobileAuth(),
      onError: (_error, variables) => onFailedRef.current(variables),
      onSettled: () => {
        if (queryClient.isMutating({ mutationKey: orpc.wishlist.set.mutationKey() }) > 1) return;
        void queryClient.invalidateQueries({ queryKey: orpc.wishlist.list.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.wishlist.check.key() });
      },
    }),
  );
}
