import { messages } from '@tourism/i18n';
import { Button, EmptyState, SCREEN_EDGES_UNDER_HEADER, Screen } from '@tourism/mobile-ui';
import { router } from 'expo-router';

/**
 * URL không khớp route nào. Có nút quay về thay vì để người dùng mắc kẹt —
 * deep link `nexora://` sai đường là chuyện sẽ xảy ra thật.
 *
 * Nút về bằng `dismissTo`: deep link mở màn này chồng lên bộ tab neo sẵn
 * (`unstable_settings.anchor`), và `replace` dựng thêm một bộ tab mới chồng lên
 * bộ đó — back cứng Android lại về bộ cũ thay vì thoát app (review M1).
 */
export default function NotFoundScreen() {
  const { notFound } = messages.mobile.appShell;

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER}>
      <EmptyState title={notFound.title} body={notFound.body}>
        <Button label={notFound.back} onPress={() => router.dismissTo('/')} />
      </EmptyState>
    </Screen>
  );
}
