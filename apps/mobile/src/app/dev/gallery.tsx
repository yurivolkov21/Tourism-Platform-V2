import { Redirect } from 'expo-router';
import { GALLERY_ENTRIES } from '@/features/dev/gallery-entries';
import { GalleryScreen } from '@/features/dev/gallery-screen';
import { isDevBuild } from '@/lib/dev-only';

/**
 * Bảng tra các khung của cụm auth — CHỈ mở được trên bản dev.
 *
 * Route vẫn nằm trong cây (Metro không có cách nào bỏ một file route khỏi bundle
 * theo điều kiện), nên cổng đặt ngay ở đây: bản phát hành mà gõ `nexora://dev/gallery`
 * thì rơi thẳng về Home, không thấy gì.
 */
export default function GalleryRoute() {
  if (!isDevBuild()) return <Redirect href="/" />;

  return <GalleryScreen title="Gallery — cụm auth" entries={GALLERY_ENTRIES} />;
}
