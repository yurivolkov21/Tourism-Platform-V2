import {
  ListGroup,
  ListRow,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { ScrollView, View } from 'react-native';

export interface PersonalDetailsScreenProps {
  name: string;
  email: string;
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  deleteAccountLabel: string;
  /** Hàng Name có mũi tên: mở tấm sửa tên (A3). */
  onNamePress: () => void;
  /** Hàng Password có mũi tên: mở màn đổi mật khẩu (A6). */
  onPasswordPress: () => void;
  onDeleteAccountPress: () => void;
}

/** Giá trị che của hàng Password — không phải mật khẩu thật, chỉ báo "đã đặt". */
const PASSWORD_MASK = '••••••••';

/**
 * "Personal details" (F2) — danh sách thẻ rời không icon: Name và Password có giá trị ở cuối
 * hàng kèm mũi tên (sửa được), Email chỉ để đọc; Delete account là hàng chữ màu lỗi ở khối riêng,
 * KHÔNG cạnh Sign out (tránh bấm nhầm việc một chiều). Header NATIVE (Stack default).
 */
export function PersonalDetailsScreen({
  name,
  email,
  nameLabel,
  emailLabel,
  passwordLabel,
  deleteAccountLabel,
  onNamePress,
  onPasswordPress,
  onDeleteAccountPress,
}: PersonalDetailsScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false}>
      <ScrollView
        style={{ backgroundColor: theme.surfaces.grouped }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(4),
          paddingTop: theme.spacing(4),
        }}
      >
        <View style={{ gap: theme.spacing(5) }}>
          <ListGroup>
            <ListRow title={nameLabel} value={name} onPress={onNamePress} />
            <ListRow title={emailLabel} value={email} />
            <ListRow title={passwordLabel} value={PASSWORD_MASK} onPress={onPasswordPress} />
          </ListGroup>
          <ListGroup>
            <ListRow title={deleteAccountLabel} destructive onPress={onDeleteAccountPress} />
          </ListGroup>
        </View>
      </ScrollView>
    </Screen>
  );
}
