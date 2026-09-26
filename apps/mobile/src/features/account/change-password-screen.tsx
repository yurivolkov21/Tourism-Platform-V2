import { messages } from '@tourism/i18n';
import {
  AppText,
  Button,
  FormMessage,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  TextField,
  useTheme,
} from '@tourism/mobile-ui';
import { useEffect, useRef } from 'react';
import { type TextInput, View } from 'react-native';
import { firstInvalidField } from '@/features/auth/first-invalid-field';
import { CHANGE_PASSWORD_FIELDS, type ChangePasswordField } from './change-password-flow';

export interface ChangePasswordScreenProps {
  values: Record<ChangePasswordField, string>;
  fieldErrors: Partial<Record<ChangePasswordField, string>>;
  formMessage: { tone: 'error' | 'info'; text: string } | null;
  pending: boolean;
  onChange: (field: ChangePasswordField, value: string) => void;
  onSubmit: () => void;
}

/**
 * A6 (spec P5b-4 §3) — màn riêng, header NATIVE (`compact-head` bản vẽ =
 * `Stack.Screen` mặc định của route, không phải nút X tự vẽ như cụm auth vì
 * đây có màn phía sau để lùi về (Account hub), không phải chặng đầu một Stack.
 */
export function ChangePasswordScreen({
  values,
  fieldErrors,
  formMessage,
  pending,
  onChange,
  onSubmit,
}: ChangePasswordScreenProps) {
  const theme = useTheme();
  const copy = messages.mobile.account.password;
  const auth = messages.mobile.auth;
  const currentRef = useRef<TextInput>(null);
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    const field = firstInvalidField(fieldErrors, CHANGE_PASSWORD_FIELDS);
    if (field === 'currentPassword') currentRef.current?.focus();
    if (field === 'newPassword') newRef.current?.focus();
    if (field === 'confirmPassword') confirmRef.current?.focus();
  }, [fieldErrors]);

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(4),
          paddingBottom: theme.spacing(6),
        }}
      >
        <AppText variant="subtitle" tone="muted">
          {copy.revokeNotice}
        </AppText>

        <TextField
          ref={currentRef}
          label={copy.currentLabel}
          icon="lock"
          secure
          revealLabel={auth.showPassword}
          hideLabel={auth.hidePassword}
          value={values.currentPassword}
          error={fieldErrors.currentPassword}
          onChangeText={(next) => onChange('currentPassword', next)}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
        />
        <TextField
          ref={newRef}
          label={copy.newLabel}
          icon="lock"
          secure
          revealLabel={auth.showPassword}
          hideLabel={auth.hidePassword}
          value={values.newPassword}
          error={fieldErrors.newPassword}
          onChangeText={(next) => onChange('newPassword', next)}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          ref={confirmRef}
          label={copy.confirmLabel}
          icon="lock"
          secure
          revealLabel={auth.showPassword}
          hideLabel={auth.hidePassword}
          value={values.confirmPassword}
          error={fieldErrors.confirmPassword}
          onChangeText={(next) => onChange('confirmPassword', next)}
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
            label={pending ? copy.submitting : copy.submit}
            disabled={pending}
            onPress={onSubmit}
          />
        </View>
      </View>
    </Screen>
  );
}
