import { messages } from '@tourism/i18n';
import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function BookingDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { titles } = messages.mobile.appShell;

  return <PlaceholderScreen title={titles.bookingDetail} detail={code} />;
}
