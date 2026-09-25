import { messages } from '@tourism/i18n';
import {
  AppText,
  Button,
  EmptyState,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { Link, router } from 'expo-router';
import { View } from 'react-native';
import { isDevBuild } from '@/lib/dev-only';

/**
 * Tab Account. Thân màn vẫn là ô giữ chỗ của template P5a (hồ sơ thật thuộc cụm
 * tabs, chưa dựng), nhưng ĐÃ có đường vào cụm auth: đây là chỗ duy nhất trong
 * vỏ ứng dụng mà khách tự tìm tới khi muốn đăng nhập.
 */
export default function AccountScreen() {
  const theme = useTheme();
  const { titles, placeholder } = messages.mobile.appShell;

  return (
    <Screen edges={SCREEN_EDGES_UNDER_TABS}>
      <AppText variant="title">{titles.account}</AppText>
      <EmptyState title={placeholder.title} body={placeholder.body} />

      <View style={{ gap: theme.spacing(2) }}>
        <Button
          shape="pill"
          label={messages.mobile.auth.signIn.submit}
          onPress={() => router.push('/login')}
        />

        {/* Đường tắt tới bảng tra 17 khung — chỉ dựng ở bản dev, đúng cùng cổng
            với chính route đó. */}
        {isDevBuild() ? (
          <Link href="/dev/gallery" style={{ alignSelf: 'center' }}>
            <AppText variant="caption" tone="link">
              Gallery (dev)
            </AppText>
          </Link>
        ) : null}

        {/* Đường tắt tới bảng tra cụm xem tour (P5b-2 T5) — cùng cổng dev. */}
        {isDevBuild() ? (
          <Link href="/dev/tour-gallery" style={{ alignSelf: 'center' }}>
            <AppText variant="caption" tone="link">
              Tour gallery (dev)
            </AppText>
          </Link>
        ) : null}
      </View>
    </Screen>
  );
}
