import { useQuery } from '@tanstack/react-query';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { MY_REVIEWS_INPUT } from './my-reviews';

/** Một nơi duy nhất khai báo truy vấn `reviews.mine` — R4/R5/R6 dùng chung cache. */
export function useMyReviews() {
  return useQuery(
    orpc.reviews.mine.queryOptions({ input: MY_REVIEWS_INPUT, context: withMobileAuth() }),
  );
}
