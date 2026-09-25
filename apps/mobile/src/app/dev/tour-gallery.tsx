import { Redirect } from 'expo-router';
import { GalleryScreen } from '@/features/dev/gallery-screen';
import { TOUR_DETAIL_GALLERY_ENTRIES } from '@/features/dev/tour-detail-gallery-entries';
import { isDevBuild } from '@/lib/dev-only';

/**
 * Bảng tra các khung của cụm xem tour (P5b-2 T5) — CHỈ mở được trên bản dev.
 * Cùng cổng chặn với `app/dev/gallery.tsx`: route vẫn nằm trong cây (Metro
 * không bỏ được một file route khỏi bundle theo điều kiện), gõ trên bản phát
 * hành thì rơi thẳng về Home.
 */
export default function TourGalleryRoute() {
  if (!isDevBuild()) return <Redirect href="/" />;

  return <GalleryScreen title="Gallery — cụm xem tour" entries={TOUR_DETAIL_GALLERY_ENTRIES} />;
}
