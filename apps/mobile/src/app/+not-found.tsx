import { messages } from '@tourism/i18n';
import { Button, EmptyState, SCREEN_EDGES_UNDER_HEADER, Screen } from '@tourism/mobile-ui';
import { router } from 'expo-router';

/**
 * URL không khớp route nào. Có nút quay về thay vì để người dùng mắc kẹt —
 * deep link `nexora://` sai đường là chuyện sẽ xảy ra thật.
 */
export default function NotFoundScreen() {
  const { notFound } = messages.mobile.appShell;

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER}>
      <EmptyState title={notFound.title} body={notFound.body}>
        <Button label={notFound.back} onPress={() => router.replace('/')} />
      </EmptyState>
    </Screen>
  );
}
