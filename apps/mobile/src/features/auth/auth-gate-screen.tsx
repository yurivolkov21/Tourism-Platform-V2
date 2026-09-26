import Feather from '@expo/vector-icons/Feather';
import {
  AppText,
  Button,
  EmptyState,
  type FeatherIconName,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { Pressable, View } from 'react-native';

export interface AuthGateScreenLegalLink {
  label: string;
  icon: FeatherIconName;
  onPress: () => void;
}

export interface AuthGateScreenProps {
  /** A2 riêng: "Account" đứng trên cùng, cùng vị trí tiêu đề của A1 (đăng nhập
      rồi) — khác S3/T3 không có khối này (mockup không vẽ tiêu đề lặp lại ở
      đó). Bỏ trống = không có tiêu đề trang riêng. */
  pageTitle?: string;
  icon: FeatherIconName;
  title: string;
  body: string;
  signInLabel: string;
  createAccountLabel: string;
  onSignIn: () => void;
  onCreateAccount: () => void;
  /** A2 riêng: năm dòng mở trình duyệt ngoài vẫn mở được dù chưa đăng nhập. Bỏ trống = không có khối này (S3). */
  legalLinks?: readonly AuthGateScreenLegalLink[];
}

/**
 * Khối chặn tab dùng chung cho Saved (S3) và Account (A2) — mockup P5b-4 mục
 * "Một khuôn chặn tab cho cả ba" (Trips chờ cụm P5b-3, chưa nối ở đây). KHÁC
 * `AuthGateSheet` (D6): đây thay TOÀN BỘ nội dung tab, không phải sheet nổi
 * lên trong lúc khách đang xem màn khác.
 */
export function AuthGateScreen({
  pageTitle,
  icon,
  title,
  body,
  signInLabel,
  createAccountLabel,
  onSignIn,
  onCreateAccount,
  legalLinks,
}: AuthGateScreenProps) {
  const theme = useTheme();

  return (
    // `SCREEN_EDGES_UNDER_TABS` (chỉ 'top'): cả hai chỗ dùng component này đều
    // nằm DƯỚI tab bar (Saved/Account) — dùng edges mặc định ['top','bottom']
    // sẽ đệm đáy hai lần (safe-area + khoảng tab bar đã chừa).
    // `padded={false}`: mọi khối bên trong đã tự canh `paddingHorizontal`
    // riêng (spacing(4)/(6) tuỳ khối) — `padded` mặc định của `Screen` cộng
    // dồn thêm spacing(5) ngang + spacing(4) dọc lên trên đó, làm `pageTitle`
    // (A2) lệch phải so với tiêu đề cùng kiểu ở `AccountScreen`/`SavedScreen`
    // (cả hai đều `padded={false}` + tự canh, phản hồi 26/09).
    <Screen edges={SCREEN_EDGES_UNDER_TABS} padded={false}>
      {pageTitle === undefined ? null : (
        <View style={{ paddingHorizontal: theme.spacing(6), paddingTop: theme.spacing(3) }}>
          <AppText variant="title">{pageTitle}</AppText>
        </View>
      )}
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
              <Feather name={icon} size={28} color={theme.colors['primary-emphasis']} />
            </View>
          }
          title={title}
          body={body}
          surface={false}
        >
          <View
            style={{ gap: theme.spacing(3), alignSelf: 'stretch', marginTop: theme.spacing(3) }}
          >
            <Button shape="pill" label={signInLabel} onPress={onSignIn} />
            <Button
              shape="pill"
              variant="ghost"
              label={createAccountLabel}
              onPress={onCreateAccount}
            />
          </View>
        </EmptyState>
      </View>
      {legalLinks === undefined || legalLinks.length === 0 ? null : (
        <View style={{ paddingHorizontal: theme.spacing(6), paddingBottom: theme.spacing(6) }}>
          {legalLinks.map((link, index) => (
            <Pressable
              key={link.label}
              accessibilityRole="button"
              onPress={link.onPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(3),
                minHeight: 52,
                // Dòng cuối bỏ viền dưới — khớp mockup (`Terms of service`
                // `border-bottom:none`, không có gì theo sau để cần tách).
                borderBottomWidth: index === legalLinks.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Feather name={link.icon} size={20} color={theme.colors.foreground} />
              <AppText variant="label" style={{ flex: 1 }}>
                {link.label}
              </AppText>
              <Feather name="external-link" size={16} color={theme.colors['muted-foreground']} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
