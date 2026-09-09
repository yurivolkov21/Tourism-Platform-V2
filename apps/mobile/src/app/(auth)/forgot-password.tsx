import { messages } from '@tourism/i18n';
import { SCREEN_EDGES_UNDER_HEADER } from '@tourism/mobile-ui';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ForgotPasswordScreen() {
  return (
    <PlaceholderScreen
      edges={SCREEN_EDGES_UNDER_HEADER}
      title={messages.mobile.appShell.titles.forgotPassword}
    />
  );
}
