import { messages } from '@tourism/i18n';
import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function TourDetailScreen() {
  // Đọc slug ngay từ template để cây route được kiểm cả phần tham số động —
  // P5b dùng chính giá trị này gọi API.
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { titles } = messages.mobile.appShell;

  return <PlaceholderScreen title={titles.tourDetail} detail={slug} />;
}
