import Feather from '@expo/vector-icons/Feather';
import { AppText, BottomSheet, Button, useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';

export interface AuthGateSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  signInLabel: string;
  createAccountLabel: string;
  onSignIn: () => void;
  onCreateAccount: () => void;
}

/**
 * Tấm mời đăng nhập (D6, bản vẽ 18/09) — thay vì nhảy thẳng sang màn Sign in,
 * để khách không mất chỗ đang xem. Dùng chung cho MỌI nút tim (E1/E4/D1) —
 * component nhận `title`/`body` qua prop, không cứng chữ wishlist ở đây, dù
 * lượt này (T5) mới có D1 gọi tới.
 */
export function AuthGateSheet({
  visible,
  onClose,
  title,
  body,
  signInLabel,
  createAccountLabel,
  onSignIn,
  onCreateAccount,
}: AuthGateSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Chừa chỗ cho tay nắm: `BottomSheet` vẽ nó `position:absolute` cao
          `spacing(8)`=32dp, mà tấm chỉ đệm `spacing(4)`=16dp — thiếu dòng này
          thì ô icon đè lên tay nắm (phản hồi 25/09). Cùng con số với
          `FilterSheet`, không phải số tuỳ hứng. */}
      <View style={{ alignItems: 'center', gap: theme.spacing(1), paddingTop: theme.spacing(5) }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.base * 2,
            backgroundColor: theme.colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing(2),
          }}
        >
          <Feather name="heart" size={26} color={theme.colors['primary-emphasis']} />
        </View>
        <AppText variant="heading" style={{ textAlign: 'center' }}>
          {title}
        </AppText>
        <AppText variant="subtitle" tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      </View>
      <View style={{ marginTop: theme.spacing(6), gap: theme.spacing(3) }}>
        <Button shape="pill" label={signInLabel} onPress={onSignIn} />
        <Button shape="pill" variant="ghost" label={createAccountLabel} onPress={onCreateAccount} />
      </View>
    </BottomSheet>
  );
}
