import { messages } from '@tourism/i18n';
import {
  AppText,
  Button,
  FormMessage,
  IconButton,
  Screen,
  TextField,
  useTheme,
} from '@tourism/mobile-ui';
import { View } from 'react-native';
import { InfoState } from './info-state';

export interface ForgotPasswordScreenProps {
  email: string;
  fieldErrors: { email?: string };
  formMessage: { tone: 'error' | 'info'; text: string } | null;
  pending: boolean;
  /** Đã gửi link: đổi sang khung 5b ngay tại chỗ, không đổi route. */
  sent: boolean;
  onChangeEmail: (next: string) => void;
  onSubmit: () => void;
  onBackToSignIn: () => void;
  onBack: () => void;
}

/**
 * Màn Forgot password (khung 5a, 5b). Chỉ MỘT ô email — bộ tham chiếu có thêm
 * lựa chọn gửi qua SĐT hay email phụ, hai thứ hệ thống này không có.
 *
 * Gửi xong KHÔNG đổi route: cùng một việc, cùng một chỗ trong stack — bấm back
 * từ khung 5b phải về Sign in chứ không phải về lại ô email vừa gửi.
 */
export function ForgotPasswordScreen({
  email,
  fieldErrors,
  formMessage,
  pending,
  sent,
  onChangeEmail,
  onSubmit,
  onBackToSignIn,
  onBack,
}: ForgotPasswordScreenProps) {
  const theme = useTheme();
  const copy = messages.mobile.auth.forgotPassword;

  if (sent) {
    return (
      <InfoState
        icon="mail"
        title={copy.sentTitle}
        body={messages.authForms.forgotPassword.sentBody}
        footnote={`${copy.sentTo} ${email}`}
        actionLabel={copy.backToSignIn}
        onAction={onBackToSignIn}
        exit={{ icon: 'arrow-left', label: messages.mobile.auth.back, onPress: onBack }}
      />
    );
  }

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
        <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(1.5) }}>
          {copy.body}
        </AppText>

        <TextField
          label={messages.mobile.auth.signIn.email}
          icon="mail"
          value={email}
          error={fieldErrors.email}
          onChangeText={onChangeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />

        <View style={{ marginTop: 'auto', paddingTop: theme.spacing(6) }}>
          {formMessage === null ? null : (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <FormMessage tone={formMessage.tone}>{formMessage.text}</FormMessage>
            </View>
          )}

          <Button
            shape="pill"
            label={
              pending
                ? messages.authForms.forgotPassword.submitting
                : messages.authForms.forgotPassword.submit
            }
            disabled={pending}
            onPress={onSubmit}
          />
        </View>
      </View>
    </Screen>
  );
}
