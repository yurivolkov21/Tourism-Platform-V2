import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { parseMarkdown } from '@/features/posts/markdown';
import {
  PostDetailScreen,
  type PostDetailStatus,
  type RelatedTourVM,
} from '@/features/posts/post-detail-screen';
import { formatReviewDate, reviewAuthorInitials } from '@/features/tour-detail/reviews';
import { orpc } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/format-money';
import { openExternalPath } from '@/lib/open-external-path';

/**
 * Route G3/G4 (spec P5b-4 §6) — chi tiết bài viết, KHÔNG cần đăng nhập.
 * `content` markdown qua `parseMarkdown` (thuần, test riêng ở `markdown.spec.ts`).
 * Nút "mở trên web" ghép `EXPO_PUBLIC_WEB_URL` + `/blog/{slug}` (đường web
 * thật của bài — `apps/web/src/app/(site)/blog/[slug]/page.tsx`).
 */
export default function PostDetailRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { posts, home } = messages.mobile;
  const { difficultyLabels } = messages.toursPage;

  const query = useQuery(
    orpc.posts.bySlug.queryOptions({ input: { slug }, enabled: slug !== undefined }),
  );

  const blocks = useMemo(
    () => (query.data === undefined ? [] : parseMarkdown(query.data.content)),
    [query.data],
  );

  const status: PostDetailStatus = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : 'content';

  const relatedTours: RelatedTourVM[] = (query.data?.relatedTours ?? []).map((tour) => ({
    slug: tour.slug,
    title: tour.title,
    imageUrl: tour.cover?.url ?? null,
    durationLabel:
      tour.difficulty === null
        ? home.durationDays(tour.durationDays)
        : `${home.durationDays(tour.durationDays)} · ${difficultyLabels[tour.difficulty]}`,
    priceLabel: formatMoney(tour.priceFrom, tour.currency),
  }));

  return (
    <PostDetailScreen
      status={status}
      coverUrl={query.data?.cover?.url ?? null}
      title={query.data?.title ?? ''}
      tagLabels={(query.data?.tags ?? []).map((t) => t.name)}
      authorName={query.data?.author.name ?? null}
      authorInitials={reviewAuthorInitials(query.data?.author.name ?? null)}
      dateLabel={query.data === undefined ? '' : formatReviewDate(query.data.publishedAt)}
      blocks={blocks}
      relatedTours={relatedTours}
      relatedToursTitle={posts.relatedToursTitle}
      readOnWebLabel={posts.readOnWeb(new URL(env().webUrl).host)}
      onReadOnWeb={() => openExternalPath(`/blog/${slug}`)}
      onBack={() => router.back()}
      backLabel={posts.back}
      onTourPress={(tourSlug) => router.push(`/tours/${tourSlug}`)}
      errorTitle={posts.errorDetail}
      retryLabel={posts.retry}
      onRetry={() => void query.refetch()}
      transformUrl={cloudinaryUrl}
    />
  );
}
