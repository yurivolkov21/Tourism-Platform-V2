import type { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Dimensions, PixelRatio } from 'react-native';
import { orpc } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { tourGallery } from './tour-gallery';

/** Mật độ tối đa khi xin ảnh — khớp `physicalWidth` của `AppImage`. */
const MAX_DENSITY = 2;

/**
 * Tải sẵn chi tiết tour trong lúc màn đang chuyển, rồi tải luôn ảnh bìa đầu tiên đúng cỡ
 * mà hero sẽ xin — trang đích hiện nội dung và ảnh ngay thay vì skeleton.
 */
export function prefetchTour(queryClient: QueryClient, slug: string) {
  const options = orpc.catalog.tours.bySlug.queryOptions({ input: { slug } });
  void queryClient.prefetchQuery(options).then(() => {
    const tour = queryClient.getQueryData(options.queryKey);
    const cover = tour === undefined ? undefined : tourGallery(tour.media)[0];
    if (cover === undefined) return;
    const width = Math.round(
      Dimensions.get('window').width * Math.min(PixelRatio.get(), MAX_DENSITY),
    );
    void Image.prefetch(cloudinaryUrl(cover.url, width));
  });
}
