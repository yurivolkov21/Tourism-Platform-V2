import Feather from '@expo/vector-icons/Feather';
import {
  AppImage,
  AppText,
  type FeatherIconName,
  IconButton,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

export interface AccountMenuItem {
  key: string;
  icon: FeatherIconName;
  label: string;
  /** `true` = dòng mở trình duyệt ngoài (icon `external-link` thay `chevron-right`). */
  external?: boolean;
  onPress: () => void;
}

export interface AccountScreenProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Chữ cái đầu tên+họ (`reviewAuthorInitials`) — hiện khi chưa có `avatarUrl`. */
  initials: string;
  editNameLabel: string;
  onEditName: () => void;
  /** Đúng thứ tự hiển thị — mockup A1 đọc theo TẦN SUẤT, không theo bảng chữ cái. */
  menuItems: readonly AccountMenuItem[];
  signOutLabel: string;
  onSignOutPress: () => void;
  transformUrl?: (source: string, width: number) => string;
  /** Khe cuối ScrollView (đường tắt dev-only) — `Screen` bên trong đây chiếm
      `flex:1` toàn màn nên bất cứ gì cần hiện PHẢI nằm trong ScrollView này,
      không phải sibling của `<AccountScreen>` ở route (mất tích, không lỗi). */
  footer?: ReactNode;
}

const AVATAR_SIZE = 72;

/**
 * A1 (spec P5b-4 §3) — đã đăng nhập. S3/A2 (chưa đăng nhập) là `AuthGateScreen`
 * riêng, dựng ở route theo `signedIn`, KHÔNG vẽ ở đây.
 */
export function AccountScreen({
  name,
  email,
  avatarUrl,
  initials,
  editNameLabel,
  onEditName,
  menuItems,
  signOutLabel,
  onSignOutPress,
  transformUrl,
  footer,
}: AccountScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={SCREEN_EDGES_UNDER_TABS} padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing(6) }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(4),
            paddingTop: theme.spacing(3),
          }}
        >
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {avatarUrl === null ? (
              <AppText
                style={{
                  color: theme.colors['secondary-foreground'],
                  fontFamily: theme.fonts.semibold,
                  fontSize: 24,
                }}
              >
                {initials}
              </AppText>
            ) : (
              <AppImage
                source={avatarUrl}
                width={AVATAR_SIZE}
                alt={name}
                transformUrl={transformUrl}
                fill
              />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="title" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {email}
            </AppText>
          </View>
          <IconButton icon="edit-2" accessibilityLabel={editNameLabel} onPress={onEditName} />
        </View>

        <View style={{ marginTop: theme.spacing(6) }}>
          {menuItems.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={item.onPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(3),
                minHeight: 52,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Feather name={item.icon} size={20} color={theme.colors.foreground} />
              <AppText variant="label" style={{ flex: 1 }}>
                {item.label}
              </AppText>
              <Feather
                name={item.external === true ? 'external-link' : 'chevron-right'}
                size={item.external === true ? 16 : 18}
                color={theme.colors['muted-foreground']}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onSignOutPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(3),
            minHeight: 52,
            marginTop: theme.spacing(3),
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingTop: theme.spacing(3),
          }}
        >
          <Feather name="log-out" size={20} color={theme.colors['destructive-emphasis']} />
          <AppText variant="label" style={{ flex: 1, color: theme.colors['destructive-emphasis'] }}>
            {signOutLabel}
          </AppText>
        </Pressable>

        {footer === undefined ? null : (
          <View style={{ marginTop: theme.spacing(6), gap: theme.spacing(2) }}>{footer}</View>
        )}
      </ScrollView>
    </Screen>
  );
}
