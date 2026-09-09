import { messages } from '@tourism/i18n';
import { SCREEN_EDGES_UNDER_TABS } from '@tourism/mobile-ui';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AccountScreen() {
  return (
    <PlaceholderScreen
      edges={SCREEN_EDGES_UNDER_TABS}
      title={messages.mobile.appShell.titles.account}
    />
  );
}
