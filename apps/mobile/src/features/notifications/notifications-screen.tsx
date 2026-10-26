import {
  AppImage,
  AppText,
  Button,
  EmptyState,
  FadeIn,
  Icon,
  PressableScale,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  Skeleton,
  useTheme,
} from '@tourism/mobile-ui';
import { ScrollView, View } from 'react-native';
import type { NotificationRowVM } from './notification-copy';

export type NotificationsStatus = 'loading' | 'error' | 'content';

export interface NotificationsScreenProps {
  status: NotificationsStatus;
  rows: readonly NotificationRowVM[];
  unreadCount: number;
  markAllLabel: string;
  onMarkAllRead: () => void;
  onRowPress: (id: string) => void;
  /** Nhãn đọc màn hình thêm vào dòng chưa đọc. */
  unreadLabel: string;
  emptyTitle: string;
  emptyBody: string;
  errorTitle: string;
  retryLabel: string;
  onRetry: () => void;
  transformUrl?: (source: string, width: number) => string;
}

const TILE = 56;

/**
 * Màn Notifications: danh sách thông báo suy ra từ đơn và review (spec 2026-10-25). MÀN CHỈ VẼ — dữ liệu,
 * đã đọc và điều hướng nằm ở route `app/notifications.tsx`.
 */
export function NotificationsScreen({
  status,
  rows,
  unreadCount,
  markAllLabel,
  onMarkAllRead,
  onRowPress,
  unreadLabel,
  emptyTitle,
  emptyBody,
  errorTitle,
  retryLabel,
  onRetry,
  transformUrl,
}: NotificationsScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false} scrollable={false}>
      {status === 'loading' ? (
        <View style={{ padding: theme.spacing(4), gap: theme.spacing(3) }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 80, borderRadius: theme.radius.base * 2 }} />
          ))}
        </View>
      ) : status === 'error' ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
          <EmptyState title={errorTitle} surface={false}>
            <Button label={retryLabel} onPress={onRetry} shape="pill" />
          </EmptyState>
        </View>
      ) : rows.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
          <EmptyState
            icon={
              <View
                style={{
                  width: theme.spacing(16),
                  height: theme.spacing(16),
                  borderRadius: theme.radius.base * 2,
                  backgroundColor: theme.colors.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="bell" size={28} color={theme.colors['primary-emphasis']} />
              </View>
            }
            title={emptyTitle}
            body={emptyBody}
            surface={false}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing(4),
            paddingTop: theme.spacing(2),
            paddingBottom: theme.spacing(6),
          }}
        >
          {unreadCount === 0 ? null : (
            <View style={{ alignItems: 'flex-end', paddingBottom: theme.spacing(2) }}>
              <AppText
                variant="label"
                tone="link"
                accessibilityRole="button"
                onPress={onMarkAllRead}
                suppressHighlighting
              >
                {markAllLabel}
              </AppText>
            </View>
          )}
          {rows.map((row, index) => (
            <FadeIn key={row.id} index={index} style={{ paddingBottom: theme.spacing(3) }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${row.title}. ${row.body}${row.unread ? `. ${unreadLabel}` : ''}`}
                onPress={() => onRowPress(row.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing(3),
                  padding: theme.spacing(3),
                  borderRadius: theme.radius.base * 2,
                  backgroundColor: theme.colors.card,
                }}
              >
                <View
                  style={{
                    width: TILE,
                    height: TILE,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: theme.colors.secondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {row.imageUrl === null ? (
                    <Icon name={row.icon} size={24} color={theme.colors['primary-emphasis']} />
                  ) : (
                    <AppImage
                      source={row.imageUrl}
                      width={TILE}
                      alt=""
                      transformUrl={transformUrl}
                      fill
                    />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText
                    variant="label"
                    numberOfLines={2}
                    style={{
                      fontWeight: row.unread ? theme.weight.semibold : theme.weight.medium,
                    }}
                  >
                    {row.title}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {row.body}
                  </AppText>
                </View>
                {row.unread ? (
                  <View
                    testID="notification-unread-dot"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: theme.colors['primary-emphasis'],
                    }}
                  />
                ) : null}
              </PressableScale>
            </FadeIn>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
