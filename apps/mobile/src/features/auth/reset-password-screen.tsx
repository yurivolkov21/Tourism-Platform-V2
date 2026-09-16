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
import { useEffect, useRef } from 'react';
import { type TextInput, View } from 'react-native';
import { firstInvalidField } from './first-invalid-field';
import { InfoState } from './info-state';
import { RESET_PASSWORD_FIELDS } from './reset-password-flow';

export type ResetPasswordField = (typeof RESET_PASSWORD_FIELDS)[number];

export interface ResetPasswordScreenProps {
  values: Record<ResetPasswordField, string>;
  fieldErrors: Partial<Record<ResetPasswordField, string>>;
  formMessage: { tone: 'error' | 'info'; text: string } | null;
  pending: boolean;
  /** Thiếu token hoặc token hết hạn: kênh 3, thay cả thân màn. */
  invalidLink: boolean;
  onChange: (field: ResetPasswordField, value: string) => void;
  onSubmit: () => void;
  onRequestNewLink: () => void;
  onClose: () => void;
}

/**
 * Màn Set a new password (khung 5c, 5d). Mở từ link trong email nên nút thoát là
 * X (đóng cả nhóm) chứ không phải mũi tên lùi: phía sau không có màn nào.
 */
export function ResetPasswordScreen({
  values,
  fieldErrors,
  formMessage,
  pending,
  invalidLink,
  onChange,
  onSubmit,
  onRequestNewLink,
  onClose,
}: ResetPasswordScreenProps) {
  const theme = useTheme();
  const copy = messages.mobile.auth.resetPassword;
  const auth = messages.mobile.auth;
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    const field = firstInvalidField(fieldErrors, RESET_PASSWORD_FIELDS);
    if (field === 'password') passwordRef.current?.focus();
    if (field === 'confirm') confirmRef.current?.focus();
  }, [fieldErrors]);

  if (invalidLink) {
    const invalid = messages.authForms.resetPassword.invalidToken;

    return (
      <InfoState
        icon="link"
        title={invalid.heading}
        body={invalid.body}
        actionLabel={invalid.backLink}
        onAction={onRequestNewLink}
        exit={{ icon: 'x', label: messages.mobile.appShell.close, onPress: onClose }}
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
            icon="x"
            accessibilityLabel={messages.mobile.appShell.close}
            onPress={onClose}
          />
        </View>

        <AppText variant="display" style={{ marginTop: theme.spacing(4) }}>
          {copy.title}
        </AppText>
        <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(1.5) }}>
          {copy.body}
        </AppText>

        <TextField
          ref={passwordRef}
          label={copy.newPassword}
          icon="lock"
          secure
          revealLabel={auth.showPassword}
          hideLabel={auth.hidePassword}
          value={values.password}
          error={fieldErrors.password}
          onChangeText={(next) => onChange('password', next)}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          ref={confirmRef}
          label={copy.confirmPassword}
          icon="lock"
          secure
          revealLabel={auth.showPassword}
          hideLabel={auth.hidePassword}
          value={values.confirm}
          error={fieldErrors.confirm}
          onChangeText={(next) => onChange('confirm', next)}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <View style={{ marginTop: 'auto', paddingTop: theme.spacing(6) }}>
          {formMessage === null ? null : (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <FormMessage tone={formMessage.tone}>{formMessage.text}</FormMessage>
            </View>
          )}

          <Button
            shape="pill"
            label={pending ? messages.authForms.resetPassword.submitting : copy.submit}
            disabled={pending}
            onPress={onSubmit}
          />
        </View>
      </View>
    </Screen>
  );
}
