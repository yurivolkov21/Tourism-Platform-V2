import {
  AppImage,
  AppText,
  FadeIn,
  type FeatherIconName,
  Icon,
  LargeTitleHeader,
  ListGroup,
  ListRow,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
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
  /** Tiêu đề lớn đầu màn (F1, mockup vòng 4). */
  title: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Chữ cái đầu tên+họ (`reviewAuthorInitials`) — hiện khi chưa có `avatarUrl`. */
  initials: string;
  editNameLabel: string;
  onEditName: () => void;
  /** A4 — bấm avatar mở tấm chọn nguồn ảnh (ADR-0040 AMEND 5). */
  avatarEditLabel: string;
  onEditAvatar: () => void;
  /** Nhóm đầu (hồ sơ, đánh giá, bài viết) — đúng thứ tự hiển thị. */
  menuItems: readonly AccountMenuItem[];
  /** Nhãn nhóm "Help & policies" và năm dòng mở trình duyệt ngoài bên dưới nó. */
  linksLabel: string;
  linkItems: readonly AccountMenuItem[];
  signOutLabel: string;
  onSignOutPress: () => void;
  transformUrl?: (source: string, width: number) => string;
}

const AVATAR_SIZE = 56;

/**
 * A1 (spec P5b-4 §3) — đã đăng nhập. S3/A2 (chưa đăng nhập) là `AuthGateScreen`
 * riêng, dựng ở route theo `signedIn`, KHÔNG vẽ ở đây.
 */
export function AccountScreen({
  title,
  name,
  email,
  avatarUrl,
  initials,
  editNameLabel,
  onEditName,
  avatarEditLabel,
  onEditAvatar,
  menuItems,
  linksLabel,
  linkItems,
  signOutLabel,
  onSignOutPress,
  transformUrl,
}: AccountScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={SCREEN_EDGES_UNDER_TABS} padded={false}>
      <ScrollView
        style={{ backgroundColor: theme.surfaces.grouped }}
        // Chừa đáy để thẻ Sign out không dính thanh tab khi cuộn hết.
        contentContainerStyle={{ paddingBottom: theme.spacing(6) }}
      >
        <LargeTitleHeader title={title} />
        <View style={{ paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3) }}>
          {/* F1 — ô hồ sơ là MỘT thẻ (nền card, bo 20) như hàng đầu danh sách Cài đặt Android 16. */}
          <FadeIn>
            <View
              testID="account-profile-card"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(4),
                minHeight: 76,
                padding: theme.spacing(4),
                borderRadius: 20,
                backgroundColor: theme.colors.card,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={avatarEditLabel}
                onPress={onEditAvatar}
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
                      fontWeight: theme.weight.semibold,
                      fontSize: 20,
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
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={editNameLabel}
                onPress={onEditName}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing(2),
                  minWidth: 0,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    variant="title"
                    numberOfLines={1}
                    style={{ fontSize: 20, lineHeight: 25, fontWeight: theme.weight.semibold }}
                  >
                    {name}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {email}
                  </AppText>
                </View>
                <Icon name="chevron-right" size={24} color={theme.colors['muted-foreground']} />
              </Pressable>
            </View>
          </FadeIn>

          <View style={{ marginTop: theme.spacing(5), gap: theme.spacing(5) }}>
            <FadeIn index={1}>
              <ListGroup>
                {menuItems.map((item) => (
                  <ListRow
                    key={item.key}
                    icon={item.icon}
                    title={item.label}
                    onPress={item.onPress}
                  />
                ))}
              </ListGroup>
            </FadeIn>
            <FadeIn index={2}>
              <ListGroup label={linksLabel}>
                {linkItems.map((item) => (
                  <ListRow
                    key={item.key}
                    icon={item.icon}
                    title={item.label}
                    external
                    onPress={item.onPress}
                  />
                ))}
              </ListGroup>
            </FadeIn>
            <FadeIn index={3}>
              <ListGroup>
                <ListRow title={signOutLabel} destructive onPress={onSignOutPress} />
              </ListGroup>
            </FadeIn>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
