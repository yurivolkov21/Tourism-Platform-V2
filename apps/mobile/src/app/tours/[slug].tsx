import { SCREEN_EDGES_UNDER_HEADER } from '@tourism/mobile-ui';
import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function TourDetailScreen() {
  // Đọc slug ngay từ template để cây route được kiểm cả phần tham số động —
  // P5b dùng chính giá trị này gọi API.
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return <PlaceholderScreen edges={SCREEN_EDGES_UNDER_HEADER} detail={slug} />;
}
