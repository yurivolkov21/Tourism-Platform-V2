import AntDesign from '@expo/vector-icons/AntDesign';
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
import { Pressable, type TextInput, View } from 'react-native';
import { AuthHero } from './auth-hero';
import { AUTH_PHOTOS } from './auth-media';
import { firstInvalidField } from './first-invalid-field';
import { OrDivider } from './or-divider';
import { SIGN_IN_FIELDS } from './sign-in-flow';

export type SignInField = (typeof SIGN_IN_FIELDS)[number];

export interface SignInScreenProps {
  values: Record<SignInField, string>;
  fieldErrors: Partial<Record<SignInField, string>>;
  formMessage: { tone: 'error' | 'info'; text: string } | null;
  pending: boolean;
  onChange: (field: SignInField, value: string) => void;
  onSubmit: () => void;
  onGoogle: () => void;
  onForgot: () => void;
  onCreateAccount: () => void;
  onClose: () => void;
}

/**
 * Màn Sign in (khung 2a, 2b). Component CHỈ vẽ: mọi giá trị và mọi hành vi đến
 * từ props, nên route giữ state còn màn thì test được ở từng trạng thái.
 */
export function SignInScreen({
  values,
  fieldErrors,
  formMessage,
  pending,
  onChange,
  onSubmit,
  onGoogle,
  onForgot,
  onCreateAccount,
  onClose,
}: SignInScreenProps) {
  const theme = useTheme();
  const copy = messages.mobile.auth.signIn;
  const auth = messages.mobile.auth;
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Kiểm ở máy xong thì con trỏ nhảy về ô sai ĐẦU TIÊN — không bắt người dùng
  // tự dò xem chỗ nào đỏ (spec §5).
  useEffect(() => {
    const field = firstInvalidField(fieldErrors, SIGN_IN_FIELDS);
    if (field === 'email') emailRef.current?.focus();
    if (field === 'password') passwordRef.current?.focus();
  }, [fieldErrors]);

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false}>
      <AuthHero
        image={AUTH_PHOTOS.signIn}
        place={copy.photoPlace}
        exit={{ icon: 'x', label: messages.mobile.appShell.close, onPress: onClose }}
      />

      <View
        style={{
          marginTop: theme.spacing(53),
          paddingHorizontal: theme.spacing(6),
          paddingBottom: theme.spacing(8),
        }}
      >
        <AppText variant="display">{copy.title}</AppText>
        <AppText tone="muted" style={{ marginTop: theme.spacing(1.5) }}>
          {copy.body}
        </AppText>

        <TextField
          ref={emailRef}
          label={copy.email}
          icon="mail"
          value={values.email}
          error={fieldErrors.email}
          onChangeText={(next) => onChange('email', next)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          ref={passwordRef}
          label={copy.password}
          icon="lock"
          secure
          revealLabel={auth.showPassword}
          hideLabel={auth.hidePassword}
          value={values.password}
          error={fieldErrors.password}
          onChangeText={(next) => onChange('password', next)}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
        />

        <Pressable
          onPress={onForgot}
          style={{ alignSelf: 'flex-end', marginVertical: theme.spacing(3) }}
        >
          <AppText variant="label" tone="link">
            {copy.forgot}
          </AppText>
        </Pressable>

        {formMessage === null ? null : (
          <View style={{ marginBottom: theme.spacing(2.5) }}>
            <FormMessage tone={formMessage.tone}>{formMessage.text}</FormMessage>
          </View>
        )}

        <Button
          shape="pill"
          label={pending ? messages.authForms.login.submitting : copy.submit}
          disabled={pending}
          onPress={onSubmit}
        />

        <OrDivider label={copy.or} />

        <Button
          shape="pill"
          variant="ghost"
          label={copy.google}
          leading={<AntDesign name="google" size={16} color={theme.colors.foreground} />}
          onPress={onGoogle}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.spacing(1.5),
            marginTop: theme.spacing(3),
          }}
        >
          <AppText variant="caption" tone="muted">
            {copy.footer}
          </AppText>
          <Pressable onPress={onCreateAccount}>
            <AppText variant="caption" tone="link">
              {copy.footerAction}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
