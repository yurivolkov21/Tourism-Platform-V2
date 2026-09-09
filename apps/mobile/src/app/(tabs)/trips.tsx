import { messages } from '@tourism/i18n';
import { SCREEN_EDGES_UNDER_TABS } from '@tourism/mobile-ui';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function TripsScreen() {
  return (
    <PlaceholderScreen
      edges={SCREEN_EDGES_UNDER_TABS}
      title={messages.mobile.appShell.titles.trips}
    />
  );
}
