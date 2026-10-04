import Feather from '@expo/vector-icons/Feather';
import { AppText, SCREEN_EDGES_UNDER_HEADER, Screen, useTheme } from '@tourism/mobile-ui';
import { Pressable, ScrollView, View } from 'react-native';

export interface PersonalDetailsScreenProps {
  name: string;
  email: string;
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  onPasswordPress: () => void;
  deleteAccountLabel: string;
  onDeleteAccountPress: () => void;
}

/**
 * "Personal details" (spec P5b-4 §3, mockup A1 dòng cùng tên) — màn RIÊNG,
 * không phải tấm A3. Name/Email chỉ hiển thị (sửa tên vẫn qua bút chì A1 →
 * A3, không lặp ở đây — mockup không vẽ ô sửa trên màn này). "Delete account"
 * nằm CUỐI màn này, KHÔNG cạnh Sign out ở A1 (mockup caption A7: tránh bấm
 * nhầm việc một chiều). Header NATIVE (Stack default), cùng khuôn
 * `ChangePasswordScreen`.
 */
export function PersonalDetailsScreen({
  name,
  email,
  nameLabel,
  emailLabel,
  passwordLabel,
  onPasswordPress,
  deleteAccountLabel,
  onDeleteAccountPress,
}: PersonalDetailsScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(4),
        }}
      >
        {/* `.kv` mockup: hàng ngang, nhãn trái/giá trị phải, viền dưới mỗi
            hàng (space-between) — KHÔNG xếp chồng label trên value (phản hồi
            27/09). */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: theme.spacing(3),
            paddingVertical: theme.spacing(2.5),
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <AppText variant="subtitle" tone="muted">
            {nameLabel}
          </AppText>
          <AppText variant="label">{name}</AppText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: theme.spacing(3),
            paddingVertical: theme.spacing(2.5),
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <AppText variant="subtitle" tone="muted">
            {emailLabel}
          </AppText>
          <AppText variant="label">{email}</AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onPasswordPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(3),
            paddingVertical: theme.spacing(2.5),
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <AppText variant="subtitle" tone="muted" style={{ flex: 1 }}>
            {passwordLabel}
          </AppText>
          <Feather name="chevron-right" size={18} color={theme.colors['muted-foreground']} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onDeleteAccountPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(3),
            minHeight: 52,
            // Email đã có viền dưới riêng ngay trên — không thêm viền trên ở
            // đây nữa, tránh gạch đôi sát nhau.
            marginTop: theme.spacing(4),
          }}
        >
          <Feather name="trash-2" size={20} color={theme.colors['destructive-emphasis']} />
          <AppText variant="label" style={{ flex: 1, color: theme.colors['destructive-emphasis'] }}>
            {deleteAccountLabel}
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
