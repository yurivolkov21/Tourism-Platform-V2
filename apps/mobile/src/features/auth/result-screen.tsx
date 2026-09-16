import Feather from '@expo/vector-icons/Feather';
import {
  AppText,
  Button,
  type FeatherIconName,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { View } from 'react-native';
import { AuthHero } from './auth-hero';
import { AUTH_PHOTOS } from './auth-media';

export interface ResultScreenProps {
  icon: FeatherIconName;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * Màn "xong việc" dùng chung: đã xác minh email, đã đổi mật khẩu (khung 6a, 6b).
 *
 * Một component cho cả hai vì hai màn chỉ khác icon và chữ — tách đôi là mở
 * đường cho hai bố cục trôi khỏi nhau.
 */
export function ResultScreen({ icon, title, body, actionLabel, onAction }: ResultScreenProps) {
  const theme = useTheme();
  const glow = theme.spacing(24);

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} scrollable={false}>
      <AuthHero image={AUTH_PHOTOS.result} />

      <View style={{ flex: 1, alignItems: 'center', paddingTop: theme.spacing(49) }}>
        <View
          style={{
            width: glow,
            height: glow,
            borderRadius: glow / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
            // Hai vòng sáng quanh icon: bóng đổ của RN không vẽ được vòng như
            // thiết kế, nên dùng viền dày màu primary pha loãng.
            borderWidth: theme.spacing(2.5),
            borderColor: withAlpha(theme.colors.primary, 0.28),
          }}
        >
          <Feather name={icon} size={40} color={theme.colors['primary-foreground']} />
        </View>

        <AppText variant="display" style={{ marginTop: theme.spacing(9), textAlign: 'center' }}>
          {title}
        </AppText>
        <AppText
          tone="muted"
          style={{
            marginTop: theme.spacing(1.5),
            textAlign: 'center',
            maxWidth: theme.spacing(62),
          }}
        >
          {body}
        </AppText>
      </View>

      <Button label={actionLabel} onPress={onAction} />
    </Screen>
  );
}
