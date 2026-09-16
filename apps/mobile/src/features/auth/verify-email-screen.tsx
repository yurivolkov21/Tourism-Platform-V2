import { OTP_LENGTH } from '@tourism/core';
import { messages } from '@tourism/i18n';
import {
  AppText,
  Button,
  FormMessage,
  IconButton,
  OtpInput,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { Pressable, View } from 'react-native';
import { formatCountdown } from './use-countdown';

export interface VerifyEmailScreenProps {
  email: string;
  /** `signup`: vừa tự đăng ký. `blocked`: bị Sign in đẩy sang vì chưa xác minh. */
  reason: 'signup' | 'blocked';
  otp: string;
  fieldErrors: { otp?: string };
  formMessage: { tone: 'error' | 'info'; text: string } | null;
  pending: boolean;
  /** Số giây còn lại trước khi được gửi lại mã; 0 là mở. */
  remaining: number;
  onChangeOtp: (next: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
}

/**
 * Màn Verify email (khung 4a, 4b, 4c). Không có ảnh đầu trang: màn này là một
 * việc duy nhất, ảnh chỉ làm loãng.
 *
 * Lý do bị chuyển sang đây nói bằng PHỤ ĐỀ chứ không bằng một dải riêng — dải
 * riêng là kênh 3, dành cho màn hết đường dùng; ở đây khách vẫn gõ mã được.
 */
export function VerifyEmailScreen({
  email,
  reason,
  otp,
  fieldErrors,
  formMessage,
  pending,
  remaining,
  onChangeOtp,
  onSubmit,
  onResend,
  onBack,
}: VerifyEmailScreenProps) {
  const theme = useTheme();
  const copy = messages.mobile.auth.verifyEmail;
  const invalid = fieldErrors.otp !== undefined;

  return (
    <Screen padded={false}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(2),
          paddingBottom: theme.spacing(6),
        }}
      >
        <View style={{ alignSelf: 'flex-start' }}>
          <IconButton
            icon="arrow-left"
            accessibilityLabel={messages.mobile.auth.back}
            onPress={onBack}
          />
        </View>

        <AppText variant="display" style={{ marginTop: theme.spacing(4) }}>
          {copy.title}
        </AppText>
        <AppText tone="muted" style={{ marginTop: theme.spacing(1.5) }}>
          {reason === 'blocked' ? copy.blockedBody : copy.body}{' '}
          {/* Email nổi lên bằng MÀU (tone mặc định trên nền chữ phụ) — bộ chữ chỉ
              có một độ đậm cho mỗi khuôn nên không tô đậm giữa câu được. */}
          <AppText>{email}</AppText>
        </AppText>

        <OtpInput
          value={otp}
          onChangeText={onChangeOtp}
          accessibilityLabel={copy.codeLabel}
          invalid={invalid}
          autoFocus
        />

        {invalid ? (
          <AppText
            variant="caption"
            tone="danger"
            accessibilityRole="alert"
            style={{ marginTop: theme.spacing(2) }}
          >
            {fieldErrors.otp}
          </AppText>
        ) : null}

        {remaining > 0 ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(4.5) }}>
            {copy.resendIn} <AppText variant="caption">{formatCountdown(remaining)}</AppText>
          </AppText>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing(1.5),
              marginTop: theme.spacing(4.5),
            }}
          >
            <AppText variant="caption" tone="muted">
              {copy.resendPrompt}
            </AppText>
            <Pressable onPress={onResend}>
              <AppText variant="caption" tone="link">
                {copy.resendAction}
              </AppText>
            </Pressable>
          </View>
        )}

        {reason === 'signup' ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(3.5) }}>
            {messages.authForms.verifyEmail.existingAccountHint}
          </AppText>
        ) : null}

        {/* Nút ghim đáy: `marginTop: 'auto'` đẩy cả khối xuống khi nội dung ngắn,
            và vẫn nằm sau nội dung khi màn phải cuộn. */}
        <View style={{ marginTop: 'auto', paddingTop: theme.spacing(6) }}>
          {formMessage === null ? null : (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <FormMessage tone={formMessage.tone}>{formMessage.text}</FormMessage>
            </View>
          )}

          <Button
            shape="pill"
            label={pending ? messages.authForms.verifyEmail.submitting : copy.submit}
            disabled={pending || otp.length < OTP_LENGTH}
            onPress={onSubmit}
          />
        </View>
      </View>
    </Screen>
  );
}
